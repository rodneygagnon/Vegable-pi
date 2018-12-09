/**
 * Zones Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const {log} = require('../controllers/logger');

const Settings = require('./settings');

// OpenSprinker Controller
const OSPi = require("../controllers/ospi");

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const zonesSchema = schema({
  id: Number,
  name: String,
  area: { type: Number, min: 0 },       // sq ft
  flowrate: { type: Number, min: 2 },   // litres per hour
  efficiency: { type: Number, min: 0 }, // irr %
  ib: { type: Number, min: 0 },         // Initial Water Balance (inches)
  aw: { type: Number, min: 0 },         // Available Water (inches)
  status: Boolean,                      // on/off
  started: { type: Number, min: 0 },    // Date/Time zone switched on.
  color: String, // Used for schedules display
  textColor: String
});

// TODO: Add soil type/characteristics to zone to more precisely calculate drainage, ib, aw

const FlowRates = { // litres per hour
  two_lph: 2,   // 1/2 gph
  four_lph: 4,  // 1 gph
  eight_lph: 8  // 2 gph
}
Object.freeze(FlowRates);

let zoneEventColors = ['#538D9E', '#408093', '#2D7489', '#296A7D', '#255F71', '#215564', '#1D4A58', '#19404B'];
let zoneTextColor = '#EBF2F4';

let ZonesInstance;

const getZonesInstance = async (callback) => {
  if (ZonesInstance) {
    callback(ZonesInstance);
    return;
  }

  ZonesInstance = await new Zones();
  log.debug("Zones Constructed! ");
  await ZonesInstance.init(() => {
    log.debug("Zones Initialized! ");
    callback(ZonesInstance);
  })
}

class Zones {
  constructor() {
    this.config = null;
  }

  async init(callback) {

    Settings.getSettingsInstance(async (gSettings) => {
      this.config = gSettings;

      OSPi.getOSPiInstance(async (gOSPi) => {
        this.ospi = gOSPi;

        var zoneCount = await db.hlenAsync(dbKeys.dbZonesKey);

        log.debug(`Zone Count(${dbKeys.dbZonesKey}): ` + zoneCount);

        if (zoneCount === 0) {
          var multi = db.multi();

          var numZones = await this.config.getZones();
          for (var i = 1; i <= numZones; i++) {
              var zone = {id: i, name:'Z0' + i, area: 0,
                          flowrate: FlowRates.two_lph, efficiency: 0.90,
                          ib: 0, aw: 0, status: false, started: 0,
                          color: zoneEventColors[i-1], textColor: zoneTextColor };

              await zonesSchema.validate(zone);

              log.debug(`Adding Zone(${i}): ` + JSON.stringify(zone));

              multi.hset(dbKeys.dbZonesKey, zone.id, JSON.stringify(zone));
          }

          await multi.execAsync((error, results) => {
            if (error)
              log.error(error);
            else
              log.debug("multi.execAsync(): " + results)
          });
        }

        callback();
      });
    });
  }

  async getZones(callback) {
    var zones = [];

    var redisZones = await db.hvalsAsync(dbKeys.dbZonesKey);
    for (var i = 0; i < redisZones.length; i++)
      zones[i] = await zonesSchema.validate(JSON.parse(redisZones[i]));

    callback(zones);
  }

  async getZone(sid) {
    var zone = null;
    try {
      zone = JSON.parse(await db.hgetAsync(dbKeys.dbZonesKey, sid));
    } catch (err) {
      log.error("getZone Failed to get zone: " + err);
    }
    return zone;
  }

  async setZone(zone, callback) {
    try {
      var inputZone = await zonesSchema.validate(zone);
      var saveZone = JSON.parse(await db.hgetAsync(dbKeys.dbZonesKey, inputZone.id));

      saveZone.name = inputZone.name;
      saveZone.area = inputZone.area;
      saveZone.efficiency = inputZone.efficiency;
      saveZone.flowrate = inputZone.flowrate;

      let status = false, started = 0;
      if (typeof inputZone.status != 'undefined')
        status = inputZone.status;

      // Switch zone on/off if status changed
      if (saveZone.status != status) {
        var start = new Date(Date.now());
        log.debug(`Zone status: ${status} ${start.toString()}`);

        await this.ospi.switchZone(saveZone.id, status);
      }

      if (status)
        started = Date.now();

      saveZone.status = status;
      saveZone.started = started;

      await db.hsetAsync(dbKeys.dbZonesKey, saveZone.id, JSON.stringify(saveZone));

    } catch (err) {
      log.error("setZone Failed to save zone: " + err);
    }

    callback();
  }

  async switchZone(sid, callback) {
    var zone;
    try {
      zone = JSON.parse(await db.hgetAsync(dbKeys.dbZonesKey, sid));

      // Switch the status
      zone.status = !zone.status;

      // Turn On/Off the zone
      await this.ospi.switchStation(zone.id, zone.status);

      if (zone.status)
        zone.started = Date.now();
      else
        // TODO: Record how much water was applied to the zone when switching OFF
        // TODO: Find and remove job from queue if one exists, may need to store job id in zone record
        zone.started = 0;

      // Save the status
      await db.hsetAsync(dbKeys.dbZonesKey, zone.id, JSON.stringify(zone));

      log.debug(`switchZone: ${zone.status ? "on" : "off"} zone(${zone.id})`);
    } catch (err) {
      log.error("setZone Failed to switch zone: " + err);
    }
    callback(zone.status);
  }
}

module.exports = {
  ZonesInstance,
  getZonesInstance
};
