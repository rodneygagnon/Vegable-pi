/**
 * @file Vegable Controller
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const Queue = require('bull');

const { log } = require('./logger');
const { WeatherInstance } = require('./weather');

const { SettingsInstance } = require('../models/settings');
const { UsersInstance } = require('../models/users');
const { EventsInstance } = require('../models/events');
const { PlantingsInstance } = require('../models/plantings');
const { ZonesInstance } = require('../models/zones');

/** Bull/Redis Jobs Queue to hold daily recurring job to evaluate depletions */
let VegableQueue;

/**
 * A singleton class to determine when to schedule irrigation/fertigation events
 * @class
 */
class Vegable {
  constructor() {
    if (!Vegable.VegableInstance) {
      Vegable.init();
      Vegable.VegableInstance = this;
    }
    return Vegable.VegableInstance;
  }

  /**
   * Initialize the Vegable service
   *
   * Create and start the queue that will create irrigation/fertigation events
   * based on what is demanded by the crops planted in the zone. It will run
   * once a day at the time configured in Settings
   *
   */
  static async init() {
    let vegableTime;
    let crontab;

    try {
      VegableQueue = await new Queue('VegableQueue', { redis: { host: 'redis' } });

      // Set Queue processor to calculate the irr/fert demand
      VegableQueue.process(async (job, done) => {
        log.debug(`VegableQueue.process-ing @ ${new Date()}`);

        // End date for processing is yesterday (last time we grabbed weather data)
        const endProcessDate = new Date();
        endProcessDate.setDate(endProcessDate.getDate() - 1);

        // If events are created, they will run tomorrow at the zone's designated start time
        const nextScheduleDate = new Date();
        nextScheduleDate.setDate(nextScheduleDate.getDate() + 1);

        const eids = await VegableInstance.scheduleEvents(endProcessDate, nextScheduleDate);

        log.debug(`VegableQueue.process-ed & scheduled ${eids.length} events`);

        done();
      });

      // Create a job to calculate the irr/fert demand every morning
      vegableTime = (await SettingsInstance.getVegableTime()).split(':');
      crontab = `${vegableTime[1]} ${vegableTime[0]} * * *`;

      log.debug(`VegableQueue process schedule ${vegableTime} - ${crontab}`);

      VegableQueue.add({ task: 'Calculate zone irr/fert demand!' },
                       { repeat: { cron: crontab }, removeOnComplete: true });
    } catch (err) {
      log.error(`Failed to create VEGABLE queue: ${err}`);
    }
    log.debug('*** Vegable Initialized!');
  }

  /**
   * Schedule irrigation/fertilization events as necessary
   *
   *  If the zone was never adjusted and there are plantings
   *    1. Recharge to the zone's soil water holding capacity (swhc)
   *    2. Record adjustment
   *  else
   *    1. Subtract depletion (ETc(day) = ETo (day) x Kc (Crop coefficient))
   *       since the last time the zone was adjusted until endProcessDate from
   *       available water (availableWater)
   *    2. If the available water is less than the Maximum Allowable Depletion (MAD),
   *       create an event to irrigate until soil is recharged to Field Capacity
   *       (swhc - water remaining after drainage)
   *
   * (NOTE: calculations are still approximations and need vetting and measurements)
   *
   * @param   {date}  endProcessDate   end date to process depletions
   * @param   {date}  nextScheduleDate the day/time to schedule an event (if necessary)
   *
   * @returns {array} eids             array of event id's that were created
   */
  async scheduleEvents(endProcessDate, nextScheduleDate) {
    const eids = [];
    try {
      let i;

      const zones = await ZonesInstance.getAllZones();

      for (i = 0; i < zones.length; i++) {
        const zone = zones[i];
        let precip;
        let etc;
        let fertilizer;

        // If this zone was never adjusted, we'll get the last 10 days
        // to guess-timate its current available water.
        // TODO: this is a crude approximation. needs improvement
        if (!zone.adjusted) {
          const startProcessDate = new Date(endProcessDate);
          startProcessDate.setDate(startProcessDate.getDate() - 10);

          precip = await WeatherInstance.getPrecip(startProcessDate, endProcessDate);
          etc = await PlantingsInstance.getETcByZone(zone.id, startProcessDate, endProcessDate);
          fertilizer = await PlantingsInstance.getFertilizerByZone(zone.id, startProcessDate, endProcessDate,
                                                                   new Date(zone.fertilized));
        } else {
          precip = await WeatherInstance.getPrecip(new Date(zone.adjusted), endProcessDate);
          etc = await PlantingsInstance.getETcByZone(zone.id, new Date(zone.adjusted), endProcessDate);
          fertilizer = await PlantingsInstance.getFertilizerByZone(zone.id, new Date(zone.adjusted), endProcessDate,
                                                                   new Date(zone.fertilized));
        }

        // Soil water change
        const waterDelta = precip - etc;

        if (waterDelta >= 0) {
          zone.availableWater = ((zone.availableWater + waterDelta) > zone.swhc
                                  ? zone.swhc : zone.availableWater + waterDelta);
        } else {
          zone.availableWater = ((zone.availableWater + waterDelta) < 0
                                  ? 0 : zone.availableWater + waterDelta);
        }

        // If zone has plantings, schedule event if necessary
        if (zone.plantings) {
          const startTime = zone.start.split(':');
          nextScheduleDate.setHours(startTime.length < 2 ? 0 : startTime[0]);
          nextScheduleDate.setMinutes(startTime.length < 2 ? 0 : startTime[1]);

          // Create an irrigation event if the zone needs water
          if (zone.availableWater < (zone.swhc * (zone.mad / 100))) {
            eids.push(await EventsInstance.setEvent({
                                                      zid: zone.id,
                                                      title: `(auto) ${zone.name} Event`,
                                                      start: nextScheduleDate.toString(),
                                                      amt: zone.swhc - zone.availableWater,
                                                      fertilizer: fertilizer
                                                    }));
          }
        }

        // Record that we've adjusted the zone up to endProcessDate
        zone.adjusted = endProcessDate.getTime();
        await ZonesInstance.setZone(zone);
      }
    } catch (err) {
      log.error(`Vegable scheduleEvents error: ${err}`);
      throw (err);
    }
    return (eids);
  }

  async validateUser(username, password, callback) {
    callback(null, await UsersInstance.validateUser(username, password));
  }

  async getUser(email, callback) {
    callback(null, await UsersInstance.getUser(email));
  }
}

const VegableInstance = new Vegable();
Object.freeze(VegableInstance);

module.exports = {
  VegableInstance
};
