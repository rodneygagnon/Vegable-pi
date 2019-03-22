/**
 * @file Zones Singleton
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const Schema = require('schm');

/** Controllers */
const { log } = require('../controllers/logger');
const { OSPiInstance } = require('../controllers/ospi');

/** Models */
const { SettingsInstance } = require('./settings');
const { StatsInstance } = require('./stats');
const { PlantingsInstance } = require('./plantings');

/** Database */
const { db } = require('./db');
const { dbKeys } = require('./db');

/** Constants */
const { MilliPerHour } = require('../../config/constants');
const { AppRateDripConversion } = require('../../config/constants');

const zonesSchema = Schema({
  id: Number,
  name: String,
  type: Number,
  length: { type: Number, min: 0 }, // sq ft
  width: { type: Number, min: 0 }, // sq ft
  area: { type: Number, min: 0 }, // sq ft
  emitterCount: { type: Number, min: 0 }, // total number of emitters
  emitterRate: { type: Number, min: 0.5 }, // emitter flow rate (gph)
  auto: Boolean,
  fertilize: Boolean,
  gph: { type: Number, min: 0 }, // total Gallons per Hour
  iph: { type: Number, min: 0 }, // total Inches per Hour
  swhc: { type: Number, min: 0.5 }, // Soil Water Holding Capacity
  status: Boolean, // on/off
  start: String, // HH:mm - time to irrigate when needed
  started: { type: Number, min: 0 }, // ISO8601 - Irrigation started
  adjusted: { type: Number, min: 0 }, // ISO8601 - Last Date aw was adjusted for depletion
  fertilized: { type: Number, min: 0 }, // ISO8601 - Last Date zone was fertilized
  availableWater: { type: Number, min: 0 }, // Available Water (inches)
  mad: { type: Number, min: 0 }, // Max Allowable Depletion (MAD %)
  plantings: { type: Number, min: 0 },
  plantedArea: { type: Number, min: 0 },

  // Color coding for events in the schedule
  color: String,
  textColor: String,
});

const ZoneType = { // Master, Fertilizer, Open
  control: 0,
  open: 1,
};
Object.freeze(ZoneType);

const MasterZoneId = 1;
const MasterZoneName = 'Master';

const FertilizerZoneId = 2;
const FertilizerZoneName = 'Fertilizer';

const noFertilizerObj = {
  n: Number((0).toFixed(0)),
  p: Number((0).toFixed(0)),
  k: Number((0).toFixed(0)),
};

// Irrigation Types and Rates and Types
const FlowRates = { // Gallons per Hour
  halfGPH: 0.5,
  oneGPH: 1.0,
  twoGPH: 2.0,
};
Object.freeze(FlowRates);

// Soil Water Holding Capacity
const SoilWHC = { // Inches
  coarse: 0.75, // Sand / Loamy-Sand
  sandy: 1.25, // Loamy-Sand / Sandy-Loam / Loam
  medium: 1.50, // Loam / Sandy-Clay-Loam (Default/Optimal)
  fine: 2.00, // Silty-Loam / Silty-Clay-Loam / Clay-Loam / Silty-Clay
};
Object.freeze(SoilWHC);

const zoneEventColors = [
  '#538D9E', // Master
  '#408093', // Fertilizer
  '#e91e63', // Z01
  '#3f51b5', // Z02
  '#03a9f4', // Z03
  '#009688', // Z04
  '#795548', // Z05
  '#607d8b', // Z06
];
const zoneTextColor = '#EBF2F4';

class Zones {
  constructor() {
    if (!Zones.ZonesInstance) {
      Zones.init();
      Zones.ZonesInstance = this;
    }
    return Zones.ZonesInstance;
  }

  static async init() {
    let zoneCount = await db.hlenAsync(dbKeys.dbZonesKey);
    if (!zoneCount) {
      zoneCount = await SettingsInstance.getZones();
      log.debug(`*** Zone.init Creating Zones(${dbKeys.dbZonesKey}): ${zoneCount}`);

      try {
        const multi = db.multi();

        // Fixed Zones (Master + Fertilizer)
        await multi.hset(dbKeys.dbZonesKey, MasterZoneId,
          JSON.stringify({
            id: MasterZoneId,
            name: MasterZoneName,
            type: ZoneType.control,
            length: 1,
            width: 1,
            area: 1,
            emitterCount: 1,
            emitterRate: FlowRates.oneGPH,
            auto: true,
            fertilize: true,
            gph: (1 * FlowRates.oneGPH),
            iph: (((1 * FlowRates.oneGPH) * AppRateDripConversion) / 1),
            swhc: SoilWHC.medium,
            availableWater: 0,
            mad: 0,
            status: false,
            start: '00:00',
            started: 0,
            adjusted: 0,
            fertilized: 0,
            plantings: 0,
            plantedArea: 0,
            color: zoneEventColors[0],
            textColor: zoneTextColor,
          }));
        await multi.hset(dbKeys.dbZonesKey, FertilizerZoneId,
          JSON.stringify({
            id: FertilizerZoneId,
            name: FertilizerZoneName,
            type: ZoneType.control,
            length: 1,
            width: 1,
            area: 1,
            emitterCount: 1,
            emitterRate: FlowRates.oneGPH,
            auto: true,
            fertilize: true,
            gph: (1 * FlowRates.oneGPH),
            iph: (((1 * FlowRates.oneGPH) * AppRateDripConversion) / 1),
            swhc: SoilWHC.medium,
            availableWater: 0,
            mad: 0,
            status: false,
            start: '00:00',
            started: 0,
            adjusted: 0,
            fertilized: 0,
            plantings: 0,
            plantedArea: 0,
            color: zoneEventColors[1],
            textColor: zoneTextColor,
          }));

        for (let i = 3; i <= zoneCount; i++) {
          const zone = {
            id: i,
            name: `Z0${i - 2}`,
            type: ZoneType.open,
            length: 1,
            width: 1,
            area: 1,
            emitterCount: 1,
            emitterRate: FlowRates.oneGPH,
            auto: true,
            fertilize: true,
            gph: (1 * FlowRates.oneGPH),
            iph: (((1 * FlowRates.oneGPH) * AppRateDripConversion) / 1),
            swhc: SoilWHC.medium,
            mad: 100,
            availableWater: 0,
            status: false,
            start: '00:00',
            started: 0,
            adjusted: 0,
            fertilized: 0,
            plantings: 0,
            plantedArea: 0,
            color: zoneEventColors[i - 1],
            textColor: zoneTextColor,
          };

          await zonesSchema.validate(zone);

          log.debug(`  Adding Zone(${i}): ${JSON.stringify(zone)}`);

          await multi.hset(dbKeys.dbZonesKey, zone.id, JSON.stringify(zone));
        }

        await multi.execAsync((error, results) => {
          if (error) {
            log.error(error);
          } else {
            log.debug(`ZoneInit multi.execAsync(): ${results}`);
          }
        });
      } catch (err) {
        log.error(`ZoneInit: ${JSON.stringify(err)}`);
      }
    }

    log.debug('*** Zones Initialized!');
  }

  // Returns zones that are available for assignment
  async getPlantingZones(callback) {
    callback(await this.getZonesByType(ZoneType.open));
  }

  // Returns control zones
  async getControlZones(callback) {
    callback(await this.getZonesByType(ZoneType.control));
  }

  async getZonesByType(type) {
    const zones = await this.getAllZones();

    const zonesByType = [];
    for (let i = 0; i < zones.length; i++) {
      if (zones[i].type === type) {
        zonesByType.push(zones[i]);
      }
    }

    return zonesByType;
  }

  async getZonesByStatus(status) {
    const zones = await this.getAllZones();

    const zonesByStatus = [];
    for (let i = 0; i < zones.length; i++) {
      if (zones[i].status === status) {
        zonesByStatus.push(zones[i]);
      }
    }

    return zonesByStatus;
  }

  async getZonesByTypeStatus(type, status) {
    const zones = await this.getAllZones();

    const zonesByTypeStatus = [];
    for (let i = 0; i < zones.length; i++) {
      if (zones[i].type === type && zones[i].status === status) {
        zonesByTypeStatus.push(zones[i]);
      }
    }

    return zonesByTypeStatus;
  }

  async getAllZones() {
    const zones = [];

    const redisZones = await db.hvalsAsync(dbKeys.dbZonesKey);
    redisZones.sort();

    for (let i = 0; i < redisZones.length; i++) {
      zones[i] = await zonesSchema.validate(JSON.parse(redisZones[i]));
    }

    // sort by name
    await zones.sort((a, b) => {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });

    return zones;
  }

  getMasterZone() { return (this.getZone(MasterZoneId)); }

  getFertilizerZone() { return (this.getZone(FertilizerZoneId)); }

  async getZone(zid) {
    let zone = null;
    try {
      zone = JSON.parse(await db.hgetAsync(dbKeys.dbZonesKey, zid));
    } catch (err) {
      log.error(`getZone(${zid}) Failed to get zone: ${err}`);
    }
    return zone;
  }

  async setZone(zone) {
    try {
      const inputZone = await zonesSchema.validate(zone);
      const saveZone = JSON.parse(await db.hgetAsync(dbKeys.dbZonesKey, inputZone.id));

      saveZone.name = inputZone.name;
      saveZone.length = inputZone.length;
      saveZone.width = inputZone.width;
      saveZone.area = inputZone.length * inputZone.width;
      saveZone.emitterCount = inputZone.emitterCount;
      saveZone.emitterRate = inputZone.emitterRate;
      saveZone.gph = saveZone.emitterCount * saveZone.emitterRate;
      saveZone.iph = (saveZone.gph * AppRateDripConversion) / saveZone.area;
      saveZone.swhc = inputZone.swhc;
      saveZone.start = inputZone.start;
      saveZone.mad = inputZone.mad;

      if (typeof inputZone.auto !== 'undefined') {
        saveZone.auto = inputZone.auto;
      } else {
        saveZone.auto = false;
      }

      if (typeof inputZone.fertilize !== 'undefined') {
        saveZone.fertilize = inputZone.fertilize;
      } else {
        saveZone.fertilize = false;
      }

      if (typeof inputZone.color !== 'undefined' && inputZone.color !== '') {
        saveZone.color = inputZone.color;
      }
      if (typeof inputZone.availableWater !== 'undefined') {
        saveZone.availableWater = inputZone.availableWater;
      }
      if (typeof inputZone.adjusted !== 'undefined') {
        saveZone.adjusted = inputZone.adjusted;
      }
      if (typeof inputZone.fertilized !== 'undefined') {
        saveZone.fertilized = inputZone.fertilized;
      }
      if (typeof inputZone.plantings !== 'undefined') {
        saveZone.plantings = inputZone.plantings;
      }
      if (typeof inputZone.plantedArea !== 'undefined') {
        saveZone.plantedArea = inputZone.plantedArea;
      }

      // if incoming status is defined and different than the current status,
      // switch the zone and start/save stats (TODO: fertilized stats are incorrect)
      if (typeof inputZone.status !== 'undefined'
          && saveZone.status !== inputZone.status) {
        if (saveZone.status) {
          // Save the stats
          const runTime = (Date.now() - saveZone.started) / MilliPerHour;
          StatsInstance.saveStats(saveZone.id, saveZone.started, Date.now(),
            saveZone.gph * runTime, (saveZone.started === saveZone.fertilized));
          saveZone.started = 0;
        } else {
          // Start the stats
          saveZone.started = Date.now();
        }

        await OSPiInstance.switchStation(saveZone.id, inputZone.status);
        saveZone.status = inputZone.status;

        log.debug(`setZone: switched zone (${inputZone.id}) status: ${inputZone.status}`);
      }
      await db.hsetAsync(dbKeys.dbZonesKey, saveZone.id, JSON.stringify(saveZone));
    } catch (err) {
      log.error(`setZone(${zone.id}): zone (${JSON.stringify(zone)}) err (${JSON.stringify(err)})`);
    }
  }

  /**
   * Switch on/off irrigation zones
   *
   *  If the zone is a control zone
   *    and is the Master zone and the Master zone is ON, switch all zones OFF
   *    or is the Fertilizer zone, just switch it ON/OFF as requested
   *  If the zone is a planting zone
   *    1. We will need to also switch the Master and Fertilizer (zones)
   *    2. If we are switching the zone off, only switch off the Master/Fertilizer
   *       zone(s) if there are no other zones currently on
   *
   * @param   {number}    zid       id of the zone to turn on or off
   * @param   {string}   fertilizer  NPK mix to add to zone
   * @param   {callback}  callback
   *
   * @returns {boolean}   status    current status of zone
   */
  async switchZone(zid, fertilizer, callback) {
    let switchZone;
    let runTime;
    try {
      switchZone = JSON.parse(await db.hgetAsync(dbKeys.dbZonesKey, zid));

      if (switchZone === null) {
        log.error(`switchZone: Unkown Zone ID (${zid})`);
        callback(false);
        return;
      }

      let fertilizerObj;
      if (switchZone.fertilize) {
        fertilizerObj = JSON.parse(fertilizer);
      } else {
        fertilizerObj = noFertilizerObj;
      }

      const fertilized = (fertilizerObj.n || fertilizerObj.p || fertilizerObj.k) ? true : false;

      if (switchZone.type === ZoneType.control) {
        if (switchZone.status) {
          // zone is on. if master, turn everything off. other
          if (switchZone.id === MasterZoneId) {
            // turn everything OFF
            const allActiveZones = await this.getZonesByStatus(true);
            for (let i = 0; i < allActiveZones.length; i++) {
              const zone = allActiveZones[i];

              // Save Planting Zone Stats
              if (zone.type === ZoneType.open) {
                runTime = (Date.now() - zone.started) / MilliPerHour;
                zone.availableWater += zone.iph * runTime;
                StatsInstance.saveStats(zone.id, zone.started, Date.now(),
                  zone.gph * runTime, fertilizer);
              }

              if (zone.id === switchZone.id) {
                switchZone.status = false;
              }
              zone.status = false;
              zone.started = 0;

              await OSPiInstance.switchStation(zone.id, zone.status);
              await db.hsetAsync(dbKeys.dbZonesKey, zone.id, JSON.stringify(zone));
            } // For each zone
          } else { // switch off the fertilizer zone
            switchZone.status = false;
            switchZone.started = 0;
            await OSPiInstance.switchStation(switchZone.id, switchZone.status);
            await db.hsetAsync(dbKeys.dbZonesKey, switchZone.id, JSON.stringify(switchZone));
          }
        } else {
          // Switch on the control zone
          switchZone.status = true;
          switchZone.started = Date.now();
          await OSPiInstance.switchStation(switchZone.id, switchZone.status);
          await db.hsetAsync(dbKeys.dbZonesKey, switchZone.id, JSON.stringify(switchZone));
        }
      } else {
        if (switchZone.status) {
          // Save Planting Zone Stats
          runTime = (Date.now() - switchZone.started) / MilliPerHour;
          switchZone.availableWater += switchZone.iph * runTime;
          StatsInstance.saveStats(switchZone.id, switchZone.started, Date.now(),
            switchZone.gph * runTime, fertilizer);

          // Switch OFF a planting zone
          switchZone.status = false;
          switchZone.started = 0;

          await OSPiInstance.switchStation(switchZone.id, switchZone.status);
          await db.hsetAsync(dbKeys.dbZonesKey, switchZone.id, JSON.stringify(switchZone));
        } else {
          // Switch ON the planting zone
          switchZone.status = true;
          switchZone.started = Date.now();

          if (fertilized) {
            switchZone.fertilized = switchZone.adjusted;
          }

          await OSPiInstance.switchStation(switchZone.id, switchZone.status);
          await db.hsetAsync(dbKeys.dbZonesKey, switchZone.id, JSON.stringify(switchZone));
        }

        const activePlantingZones = await this.getZonesByTypeStatus(ZoneType.open, true);

        // Switch on/off Master(Fertilizer) zone(s) if no other planting zone is on
        if ((switchZone.status && activePlantingZones.length === 1)
            || (!switchZone.status && activePlantingZones.length === 0)) {
          let controlZone;
          if (fertilized) {
            controlZone = await this.getFertilizerZone();
            controlZone.status = switchZone.status;
            controlZone.started = switchZone.started;
            await OSPiInstance.switchStation(controlZone.id, controlZone.status);
            await db.hsetAsync(dbKeys.dbZonesKey, controlZone.id, JSON.stringify(controlZone));
          }

          controlZone = await this.getMasterZone();
          controlZone.status = switchZone.status;
          controlZone.started = switchZone.started;
          await OSPiInstance.switchStation(controlZone.id, controlZone.status);
          await db.hsetAsync(dbKeys.dbZonesKey, controlZone.id, JSON.stringify(controlZone));
        }
      }
    } catch (err) {
      log.error(`switchZone: Failed to switch zone(${zid}): ${err}`);
    }
    callback(switchZone.status);
  }

  // Average the MAD and record the number of plantings in this zone
  async updatePlantings(zids) {
    try {
      for (let i = 0; i < zids.length; i++) {
        const zone = await this.getZone(zids[i]);

        if (zone === 'undefined' || zone === null) {
          log.error(`updatePlantings: Invalid zone id (${zids[i]})`);
          return;
        }

        zone.plantedArea = 0;
        zone.mad = 0;

        const plantings = await PlantingsInstance.getPlantingsByZone(zids[i]);
        if (plantings.length) {
          for (let j = 0; j < plantings.length; j++) {
            zone.plantedArea += plantings[j].area;
            zone.mad += plantings[j].mad;
          }
          zone.mad /= plantings.length;
        }
        zone.plantings = plantings.length;

        await this.setZone(zone);
      }
    } catch (err) {
      log.error(`updatePlantings Failed to update planting for zones(${zids}): ${err}`);
    }
  }
}

const ZonesInstance = new Zones();
Object.freeze(ZonesInstance);

module.exports = {
  ZonesInstance,
};
