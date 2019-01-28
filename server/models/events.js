/**
 * @file Events Singleton
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const uuidv4 = require('uuid/v4');
const Queue = require('bull');
const Schema = require('schm');

/** Controllers */
const { log } = require('../controllers/logger');

/** Models */
const { ZonesInstance } = require('./zones');

/** Database */
const { db } = require('./db');
const { dbKeys } = require('./db');

/** Constants */
const { milli_per_hour } = require('../../config/constants');

const eventSchema = Schema({
  id: String,                     // Event UUID
  zid: Number,                    // Zone ID
  title: String,
  start: String,                  // ISO8601
  amt: { type: Number, min: 0 },  // inches of water to apply
  fertilizer: String,             // NPK fertilizer
  color: String,
  textColor: String,
  repeatDow: Array,
  repeatEnd: String               // ISO8601
});

// Bull/Redis Jobs Queue
let EventsQueue;

class Events {
  constructor() {
    if (!Events.EventsInstance) {
      Events.init();

      Events.EventsInstance = this;
    }
    return Events.EventsInstance;
  }

  static async init() {
    try {
      EventsQueue = new Queue('EventsQueue', { redis: { host: 'redis' } });

      // Set Queue processor
      EventsQueue.process(async (job, done) => {
        EventsInstance.processJob(job, done);
      });
    } catch (err) {
      log.error(`Failed to create EVENTS queue: ${err}`);
    }
    log.debug('*** Events Initialized!');
  }

  async getEvents(start, end, callback) {
    const events = [];
    const startRange = (new Date(start)).getTime() / 1000;
    const endRange = (new Date(end)).getTime() / 1000;

    log.debug(`getEvents: from ${startRange} to ${endRange}`);

    try {
      const redisEvents = await db.zrangebyscoreAsync(dbKeys.dbEventsKey, startRange, endRange);

      log.debug(`getEvents: (${redisEvents.length})`);

      for (let i = 0; i < redisEvents.length; i++) {
        // If this is a repeating event, we have to create the appropriate number of
        // individual events within the range requested (end-start)
        let masterRepeatEnd;
        const masterEvent = await eventSchema.validate(JSON.parse(redisEvents[i]));

        // Set the color to that of the zone
        const zone = await ZonesInstance.getZone(masterEvent.zid);
        masterEvent.color = zone.color;
        masterEvent.textColor = zone.textColor;

        // Add the masterEvent. If it is repeating, create and add the children
        // for display during the date range given
        events.push(masterEvent);

        // If not repeating, continue ...
        if (typeof masterEvent.repeatDow === 'undefined' || masterEvent.repeatDow === '7' /* none */) {
          continue;
        }

        // ... otherwise, create repeating events for the given timeframe
        if (typeof masterEvent.repeatEnd === 'undefined') {
          masterRepeatEnd = new Date(masterEvent.start);
        } else {
          masterRepeatEnd = new Date(masterEvent.repeatEnd);
        }

        // Find the follow on dates
        for (let j = 0; j < masterEvent.repeatDow.length; j++) {
          const repeatDow = masterEvent.repeatDow[j];

          // Clone the object and calculate the next day increment
          let nextEvent = JSON.parse(JSON.stringify(masterEvent));
          let nextStart = new Date(masterEvent.start);
          let nextAmt = new Date(masterEvent.amt);
          let nextDay = (7 + repeatDow - nextStart.getDay()) % 7;

          log.debug(`getEvents: Master Event (${JSON.stringify(masterEvent)})`);
          log.debug(`getEvents: Next Day: (${nextDay})`);

          nextStart.setDate(nextStart.getDate() + (nextDay !== 0 ? nextDay : 7));

          while (nextStart <= masterRepeatEnd) {
            nextEvent.start = nextStart;
            nextEvent.amt = nextAmt;

            log.debug(`getEvents: Next Event: (${nextEvent.start})`);
            events.push(nextEvent);

            // Clone the object
            nextEvent = JSON.parse(JSON.stringify(nextEvent));
            nextStart = new Date(nextEvent.start);
            nextAmt = new Date(nextEvent.amt);
            nextDay = (7 + repeatDow - nextStart.getDay()) % 7;

            log.debug(`getEvents: Next Day: (${nextDay})`);

            nextStart.setDate(nextStart.getDate() + (nextDay !== 0 ? nextDay : 7));
          }
        }
      }
    } catch (err) {
      log.error(`getEvents Failed: ${err}`);
    }

    callback(events);
  }

  async setEvent(event) {
    let eid = null;

    try {
      const validEvent = await eventSchema.validate(event);
      const validStart = (new Date(validEvent.start)).getTime() / 1000;

      if (typeof validEvent.id === 'undefined' || validEvent.id === '') {
        // Create a new event id.
        validEvent.id = uuidv4();
      } else {
        // Find and remove the old event
        const removeEvent = await this.findEvent(validEvent.id);

        if (removeEvent) {
          // Remove the event and the job from event queue.
          // We'll add back an updated job if necessary
          await this.delJob(removeEvent.id);
          await db.zremAsync(dbKeys.dbEventsKey, JSON.stringify(removeEvent));
        }
      }

      // Add the event and schedule a job
      await db.zaddAsync(dbKeys.dbEventsKey, validStart, JSON.stringify(validEvent));
      this.scheduleJob(validEvent);

      eid = validEvent.id;

    } catch (err) {
      log.error(`setEvent Failed to set event: ${JSON.stringify(err)}`);
    }
    return (eid);
  }

  async delEvent(event) {
    let eid = null;

    try {
      const validEvent = await eventSchema.validate(event);
      const removeEvent = await this.findEvent(validEvent.id);

      if (removeEvent) {
        // Remove the job from event queue
        await this.delJob(removeEvent.id);
        await db.zremAsync(dbKeys.dbEventsKey, JSON.stringify(removeEvent));

        eid = removeEvent.id;
      }
    } catch (err) {
      log.error(`delEvent Failed to del event: ${err}`);
    }

    return (eid);
  }

  async delJob(id) {
    const job = await EventsQueue.getJob(id);
    if (job) {
      log.debug(`delJob: job (${id}) deleted!`);
      job.remove();
    }
  }

  async findEvent(eid) {
    const eventCnt = await db.zcountAsync(dbKeys.dbEventsKey, '-inf', '+inf');

    let cnt = 0;
    let start = 0;
    let end = 20; // get 'end' per page
    while (cnt < eventCnt) {
      const events = await db.zrangeAsync(dbKeys.dbEventsKey, start, end);

      for (let i = 0; i < events.length; i++) {
        const event = JSON.parse(events[i]);
        if (event.id === eid) {
          return(event);
        }
      }

      start = end;
      end += end;
      cnt += events.length;
    }

    return (null);
  }

  async scheduleJob(event) {
    // Add event to the EventsQueue. Calculate when it should be processed next.
    const now = new Date();

    log.trace(`Events::scheduleJob(ENTER): (${JSON.stringify(event)})`);

    let jobOpts = null;
    let delay;
    if (typeof event.repeatDow === 'undefined' || event.repeatDow === '7' /* none */) {
      // Skip it if we are not repeating and the start time is in the past
      delay = (new Date(event.start)).getTime() - now.getTime();
      if (delay > 0) {
        jobOpts = { jobId: event.id, delay: delay, removeOnComplete: true };
      }
    } else {
      // Skip it if the repeat has expired
      delay = (new Date(event.repeatEnd)).getTime() - now.getTime();
      if (delay > 0) {
        const start = new Date(event.start);
        const dow = (Array.isArray(event.repeatDow) ? event.repeatDow.join(',') : event.repeatDow);
        const repeatOpts = { cron: `${start.getMinutes()} ${start.getHours()} * * ${dow}` };

        jobOpts = { jobId: event.id, delay: delay, repeat: repeatOpts, removeOnComplete: true };
      }
    }

    if (jobOpts) {
      log.trace(`Events::scheduleJob(QUEUED): (${JSON.stringify(event)})`);
      const job = await EventsQueue.add(event, jobOpts);
    } else {
      log.debug(`Events::scheduleJob(skip): nothing to do, job has expired(${JSON.stringify(event)})`);
    }
  }

  async processJob(job, done) {
    const zone = await ZonesInstance.getZone(job.data.zid);

    log.trace(`Events::processJob(ENTER): (${JSON.stringify(job)})`);

    // If the job.id !== job.data.id (original event.id), then we created this job to turn the
    // zone off at a specified time. If the station was turned off manually, log & do nothing.
    if (job.id === job.data.id) {
      // We are meant to turn the zone ON
      if (!zone.status) {
        // Switch ON the station and create a job to turn it off
        ZonesInstance.switchZone(job.data.zid, job.data.fertilizer, async (status) => {
          const irrTime = (job.data.amt / zone.iph) * milli_per_hour;
          const nextJob = await EventsQueue.add(job.data, { jobId: uuidv4(),
                                                            delay: irrTime,
                                                            removeOnComplete: true });

          log.trace(`Events::process(1) zone ${zone.id} switched ${zone.status === true ? 'ON' : 'OFF'}`);
          done();
        });
      } else {
        log.debug(`Events::process(1) zone ${zone.id} already ${zone.status === true ? 'ON' : 'OFF'}`);
        done();
      }
    } else {
      // We are meant to turn the zone OFF
      if (zone.status) {
        // Switch OFF the station
        log.trace(`Events::process(2) zone ${zone.id} switched ${zone.status === true ? 'ON' : 'OFF'}`);
        ZonesInstance.switchZone(job.data.zid, job.data.fertilizer, async (status) => {
          done();
        });
      } else {
        log.debug(`Events::process(2) zone ${zone.id} already ${zone.status === true ? 'ON' : 'OFF'}`);
        done();
      }
    }
  }
}

const EventsInstance = new Events();
Object.freeze(EventsInstance);

module.exports = {
  EventsInstance
};
