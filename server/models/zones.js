/**
 * Zones Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const {log} = require('../controllers/logger');

const {SettingsInstance} = require('./settings');
const {StatsInstance} = require('./stats');
const {PlantingsInstance} = require('./plantings');

// OpenSprinker Controller
const {OSPiInstance} = require("../controllers/ospi");

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const zonesSchema = schema({
  id: Number,
  name: String,
  type: Number,
  area: { type: Number, min: 0 },           // sq ft
  flowrate: { type: Number, min: 0.5 },     // gallons per hour
  irreff: { type: Number, min: 0.5 },         // Irrigation Efficiency %
  swhc: { type: Number, min: 0.5 },           // Soil Water Holding Capacity
  status: Boolean,                          // on/off
  start: String,                            // HH:mm - time to irrigate when needed
  started: { type: Number, min: 0 },        // ISO8601 - Irrigation started
  recharged: { type: Number, min: 0 },      // ISO8601 - Last Date the zone was recharged
  adjusted: { type: Number, min: 0 },       // ISO8601 - Last Date aw was adjusted for depletion
  availableWater: { type: Number, min: 0 }, // Available Water (inches)
  mad: { type: Number, min: 0 },            // Max Allowable Depletion (MAD %)
  plantings: { type: Number, min: 0 },

  // Color coding for events in the schedule
  color: String,
  textColor: String
});

const gpm_cfs = 448.83;
const sqft_acre = 43560;

const min_per_hour = 60;
const milli_per_hour = min_per_hour * 60000;

const MasterZoneId = 1;
const FertilizerZoneId = 2;

const ZoneType = { // Master, Fertilizer, Open
  control: 0,
  open: 1
};
Object.freeze(ZoneType);

// Irrigation Types and Rates and Types
const FlowRates = { // Gallons per Hour
  halfGPH: 0.5,
  oneGPH: 1.0,
  twoGPH: 2.0
};
Object.freeze(FlowRates);

const IrrEff = { // Percentage
  spray: 0.8,
  drip: 0.9
};
Object.freeze(IrrEff);

// Soil Water Holding Capacity
const SoilWHC = { // Inches
  coarse: 0.75, // Sand / Loamy-Sand
  sandy: 1.25,  // Loamy-Sand / Sandy-Loam / Loam
  medium: 1.50, // Loam / Sandy-Clay-Loam (Default/Optimal)
  fine: 2.00    // Silty-Loam / Silty-Clay-Loam / Clay-Loam / Silty-Clay
};
Object.freeze(SoilWHC);

let zoneEventColors = ['#538D9E', '#408093', '#2D7489', '#296A7D', '#255F71', '#215564', '#1D4A58', '#19404B'];
let zoneTextColor = '#EBF2F4';

class Zones {
  constructor() {
    if (!Zones.ZonesInstance) {
      Zones.init();
      Zones.ZonesInstance = this;
    }
    return Zones.ZonesInstance;
  }

  static async init() {
    var zoneCount = await db.hlenAsync(dbKeys.dbZonesKey);
    if (!zoneCount) {
      zoneCount = await SettingsInstance.getZones();
      log.debug(`*** Zone.init Creating Zones(${dbKeys.dbZonesKey}): ${zoneCount}`);

      try {
        var multi = db.multi();

        // Fixed Zones (Master + Fertilizer)
        await multi.hset(dbKeys.dbZonesKey, MasterZoneId, JSON.stringify({ id: MasterZoneId, name:'Master', area: 0,
                                                                           type: ZoneType.control, flowrate: FlowRates.oneGPH,
                                                                           irreff: IrrEff.drip, swhc: SoilWHC.medium, availableWater: 0, mad: 100,
                                                                           status: false, start: '00:00', started: 0, recharged: 0, adjusted: 0,
                                                                           plantings: 0, color: zoneEventColors[0], textColor: zoneTextColor
                                                                         }));
        await multi.hset(dbKeys.dbZonesKey, FertilizerZoneId, JSON.stringify({ id: FertilizerZoneId, name:'Fertilizer', area: 0,
                                                                              type: ZoneType.control, flowrate: FlowRates.oneGPH,
                                                                              irreff: IrrEff.drip, swhc: SoilWHC.medium, availableWater: 0, mad: 100,
                                                                              status: false, start: '00:00', started: 0, recharged: 0, adjusted: 0,
                                                                              plantings: 0, color: zoneEventColors[1], textColor: zoneTextColor
                                                                            }));

        for (var i = 3; i <= zoneCount; i++) {
          var zone = { id: i, name:`Z0${i-2}`, area: 1, type: ZoneType.open,
                       flowrate: FlowRates.oneGPH, irreff: IrrEff.drip, swhc: SoilWHC.medium,
                       mad: 100, availableWater: 0, status: false, start: '00:00', started: 0, recharged: 0, adjusted: 0,
                       plantings: 0, color: zoneEventColors[i-1], textColor: zoneTextColor };

          await zonesSchema.validate(zone);

          log.debug(`  Adding Zone(${i}): ` + JSON.stringify(zone));

          await multi.hset(dbKeys.dbZonesKey, zone.id, JSON.stringify(zone));
        }

        await multi.execAsync((error, results) => {
          if (error)
            log.error(error);
          else
            log.debug(`ZoneInit multi.execAsync(): ${results}`)
        });
      } catch (err) {
        log.error(`ZoneInit: ${JSON.stringify(err)}`);
      }
    }

    log.debug(`*** Zones Initialized!`);
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
    var zones = await this.getAllZones();

    var zonesByType = [];
    for (var i = 0; i < zones.length; i++) {
      if (zones[i].type === type)
        zonesByType.push(zones[i]);
    }

    return zonesByType;
  }

  async getAllZones() {
    var zones = [];

    var redisZones = await db.hvalsAsync(dbKeys.dbZonesKey);
    for (var i = 0; i < redisZones.length; i++)
      zones[i] = await zonesSchema.validate(JSON.parse(redisZones[i]));

    // sort by name
    await zones.sort((a, b) => {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });

    return zones;
  }

  async getMasterZone() { await this.getZone(MasterZoneId); }
  async getFertilizerZone() { await this.getZone(FertilizerZoneId); }

  async getZone(zid) {
    var zone = null;
    try {
      zone = JSON.parse(await db.hgetAsync(dbKeys.dbZonesKey, zid));
    } catch (err) {
      log.error(`getZone(${zid}) Failed to get zone: ${err}`);
    }
    return zone;
  }

  async setZone(zone) {
    try {
      var inputZone = await zonesSchema.validate(zone);
      var saveZone = JSON.parse(await db.hgetAsync(dbKeys.dbZonesKey, inputZone.id));

      saveZone.name = inputZone.name;
      saveZone.area = inputZone.area;
      saveZone.irreff = inputZone.irreff;
      saveZone.swhc = inputZone.swhc;
      saveZone.flowrate = inputZone.flowrate;
      saveZone.start = inputZone.start;
      saveZone.mad = inputZone.mad;
      if (typeof inputZone.availableWater !== 'undefined')
        saveZone.availableWater = inputZone.availableWater;
      if (typeof inputZone.adjusted !== 'undefined')
        saveZone.adjusted = inputZone.adjusted;
      if (typeof inputZone.plantings !== 'undefined')
        saveZone.plantings = inputZone.plantings;

      // if incoming status is defined and different than the current status,
      // switch the zone and start/save stats
      if (typeof inputZone.status !== 'undefined' &&
                 saveZone.status !== inputZone.status) {
        if (saveZone.status) {
          // Save the stats
          // TODO: keep track of fertilization
          var fertilized = false;
          var amount = Number((((Date.now() - zone.started) / milli_per_hour) * zone.flowrate).toFixed(2));
          StatsInstance.saveStats(saveZone.id, saveZone.started, Date.now(), amount, fertilized);
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
      log.error(`setZone(${zone.id}): ${JSON.stringify(err)}`);
    }
  }

  // Turn on/off a zone
  async switchZone(zid, callback) {
    var zone;
    try {
      zone = JSON.parse(await db.hgetAsync(dbKeys.dbZonesKey, zid));

      if (zone.status) {
        // Save the stats
        // TODO: keep track of fertilization
        // TODO: Find and remove job from queue if one exists, may need to store job id in zone record
        var fertilized = false;
        var amount = Number((((Date.now() - zone.started) / milli_per_hour) * zone.flowrate).toFixed(2));
        StatsInstance.saveStats(zone.id, zone.started, Date.now(), amount, fertilized);

        zone.availableWater += ((((Date.now() - zone.started) / milli_per_hour) * (zone.flowrate / gpm_cfs)) / (zone.area / sqft_acre)) * zone.irreff;
        zone.started = 0;
      } else {
        // Start the stats
        zone.started = Date.now();
      }

      // Switch the status
      zone.status = !zone.status;

      // Turn On/Off the zone
      await OSPiInstance.switchStation(zone.id, zone.status);

      await db.hsetAsync(dbKeys.dbZonesKey, zone.id, JSON.stringify(zone));

      log.debug(`switchZone: switched zone (${zone.id}) status: ${zone.status}`);
    } catch (err) {
      log.error(`switchZone: Failed to switch zone: ${err}`);
    }
    callback(zone.status);
  }

  // Average the MAD and record the number of plantings in this zone
  async updatePlantings(zids) {
    try {
      for (var i = 0; i < zids.length; i++) {
        var zone = await this.getZone(zids[i]);

        if (zone === 'undefined' || zone === null)
          throw(`Invalid zone id (${zids[i]})`);

        zone.mad = 0;

        var plantings = await PlantingsInstance.getPlantingsByZone(zids[i]);
        if (plantings.length) {
          for (var i = 0; i < plantings.length; i++)
            zone.mad += plantings[i].mad;

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
  ZonesInstance
}
