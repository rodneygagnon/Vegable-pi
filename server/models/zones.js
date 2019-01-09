/**
 * @file Zones Singleton
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */
'use strict';

/** Controllers */
const {log} = require('../controllers/logger');
const {OSPiInstance} = require("../controllers/ospi");

/** Models */
const {SettingsInstance} = require('./settings');
const {StatsInstance} = require('./stats');
const {PlantingsInstance} = require('./plantings');

/** Database */
const {db} = require("./db");
const {dbKeys} = require("./db");

/** Constants */
const {gpm_cfs} = require('../../config/constants');
const {sqft_acre} = require('../../config/constants');
const {milli_per_hour} = require('../../config/constants');

const schema = require("schm");
const zonesSchema = schema({
  id: Number,
  name: String,
  type: Number,
  area: { type: Number, min: 0 },           // sq ft
  flowrate: { type: Number, min: 0.5 },     // gallons per hour
  irreff: { type: Number, min: 0.5 },       // Irrigation Efficiency %
  swhc: { type: Number, min: 0.5 },         // Soil Water Holding Capacity
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

const ZoneType = { // Master, Fertilizer, Open
  control: 0,
  open: 1
};
Object.freeze(ZoneType);

const MasterZoneId = 1;
const MasterZoneName = 'Master';

const FertilizerZoneId = 2;
const FertilizerZoneName = 'Fertilizer';

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
        await multi.hset(dbKeys.dbZonesKey, MasterZoneId, JSON.stringify({ id: MasterZoneId, name:MasterZoneName, area: 0,
                                                                           type: ZoneType.control, flowrate: FlowRates.oneGPH,
                                                                           irreff: IrrEff.drip, swhc: SoilWHC.medium, availableWater: 0, mad: 100,
                                                                           status: false, start: '00:00', started: 0, recharged: 0, adjusted: 0,
                                                                           plantings: 0, color: zoneEventColors[0], textColor: zoneTextColor
                                                                         }));
        await multi.hset(dbKeys.dbZonesKey, FertilizerZoneId, JSON.stringify({ id: FertilizerZoneId, name:FertilizerZoneName, area: 0,
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

  async getZonesByStatus(status) {
    var zones = await this.getAllZones();

    var zonesByStatus = [];
    for (var i = 0; i < zones.length; i++) {
      if (zones[i].status === status)
        zonesByStatus.push(zones[i]);
    }

    return zonesByStatus;
  }

  async getZonesByTypeStatus(type, status) {
    var zones = await this.getAllZones();

    var zonesByTypeStatus = [];
    for (var i = 0; i < zones.length; i++) {
      if (zones[i].type === type && zones[i].status === status)
        zonesByTypeStatus.push(zones[i]);
    }

    return zonesByTypeStatus;
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

  async getMasterZone() { return(await this.getZone(MasterZoneId)); }
  async getFertilizerZone() { return(await this.getZone(FertilizerZoneId)); }

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
   * @param   {boolean}   fertilize whether or not to include fertilization
   * @param   {callback}  callback
   *
   * @returns {boolean}   status    current status of zone
   */
  async switchZone(zid, fertilize, callback) {
    try {
      var switchZone = JSON.parse(await db.hgetAsync(dbKeys.dbZonesKey, zid));

      if (switchZone.type === ZoneType.control) {
        if (switchZone.status) {
          // zone is on. if master, turn everything off. other
          if (switchZone.id === MasterZoneId) {
            // turn everything OFF
            var allActiveZones = await this.getZonesByStatus(true);
            for (var i = 0; i < allActiveZones.length; i++) {
              var zone = allActiveZones[i];

              // Save Planting Zone Stats
              if (zone.type === ZoneType.open) {
                var amount = Number((((Date.now() - zone.started) / milli_per_hour) * zone.flowrate).toFixed(2));
                StatsInstance.saveStats(zone.id, zone.started, Date.now(), amount, fertilize);

                zone.availableWater += ((((Date.now() - zone.started) / milli_per_hour) * (zone.flowrate / gpm_cfs)) / (zone.area / sqft_acre)) * zone.irreff;
              }

              if (zone.id === switchZone.id)
                switchZone.status = false;
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
          var amount = Number((((Date.now() - switchZone.started) / milli_per_hour) * switchZone.flowrate).toFixed(2));
          StatsInstance.saveStats(switchZone.id, switchZone.started, Date.now(), amount, fertilize);

          switchZone.availableWater += ((((Date.now() - switchZone.started) / milli_per_hour) * (switchZone.flowrate / gpm_cfs)) / (switchZone.area / sqft_acre)) * switchZone.irreff;

          // Switch OFF a planting zone
          switchZone.status = false;
          switchZone.started = 0;

          await OSPiInstance.switchStation(switchZone.id, switchZone.status);
          await db.hsetAsync(dbKeys.dbZonesKey, switchZone.id, JSON.stringify(switchZone));

        } else {
          // Switch ON the planting zone
          switchZone.status = true;
          switchZone.started = Date.now();
          await OSPiInstance.switchStation(switchZone.id, switchZone.status);
          await db.hsetAsync(dbKeys.dbZonesKey, switchZone.id, JSON.stringify(switchZone));
        }

        var activePlantingZones = await this.getZonesByTypeStatus(ZoneType.open, true);

        // Switch on/off Master(Fertilizer) zone(s) if no other planting zone is on
        if ((switchZone.status && activePlantingZones.length === 1) ||
            (!switchZone.status && activePlantingZones.length === 0)) {
          var controlZone;
          if (fertilize) {
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
      log.error(`switchZone: Failed to switch zone: ${err}`);
    }
    callback(switchZone.status);
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
