/**
 * Zones Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const Queue = require("bull");

const {log} = require('../controllers/logger');

const Settings = require('./settings');
const Plantings = require("./plantings");

// OpenSprinker Controller
const OSPi = require("../controllers/ospi");

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const zonesSchema = schema({
  id: Number,
  name: String,
  type: Number,
  area: { type: Number, min: 0 },       // sq ft
  flowrate: { type: Number, min: 0.5 }, // gallons per hour
  irreff: { type: Number, min: 0 },     // Irrigation Efficiency %
  swhc: { type: Number, min: 0 },       // Soil Water Holding Capacity
  ib: { type: Number, min: 0 },         // Initial Water Balance (inches)
  aw: { type: Number, min: 0 },         // Available Water (inches)
  status: Boolean,                      // on/off
  started: { type: Number, min: 0 },    // Date/Time the zone was switched on

  // Agreggated Crop/Planting data for this zone
  plantings: { type: Number, min: 0 },
  initDay: { type: Number, min: 0 },
  initKc: { type: Number, min: 0 },
  devDay: { type: Number, min: 0 },
  devKc: { type: Number, min: 0 },
  midDay: { type: Number, min: 0 },
  midKc: { type: Number, min: 0 },
  lateDay: { type: Number, min: 0 },
  lateKc: { type: Number, min: 0 },
  totDay: { type: Number, min: 0 },
  totKc: { type: Number, min: 0 },
  mad: { type: Number, min: 0 },        // Max Allowable Depletion (MAD %)

  // Color coding for events in the schedule
  color: String,
  textColor: String
});

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

// Bull/Redis Jobs Queue
var ZoneQueue;

let zoneEventColors = ['#538D9E', '#408093', '#2D7489', '#296A7D', '#255F71', '#215564', '#1D4A58', '#19404B'];
let zoneTextColor = '#EBF2F4';

let ZonesInstance;

const getZonesInstance = async (callback) => {
  if (ZonesInstance) {
    callback(ZonesInstance);
    return;
  }

  ZonesInstance = await new Zones();

  await ZonesInstance.init(() => {
    log.debug(`*** Zones Initialized!`);
    callback(ZonesInstance);
  });
}

class Zones {
  constructor() {}

  async init(callback) {
    var zoneCount = await db.hlenAsync(dbKeys.dbZonesKey);
    if (!zoneCount) {
      Settings.getSettingsInstance(async (settings) => {
        zoneCount = await settings.getZones();
        log.debug(`ZoneInit Creating Zones(${dbKeys.dbZonesKey}): ${zoneCount}`);

        try {
          var multi = db.multi();

          // Fixed Zones (Master + Fertilizer)
          await multi.hset(dbKeys.dbZonesKey, MasterZoneId, JSON.stringify({ id: MasterZoneId, name:'Master', area: 0,
                                                                             type: ZoneType.control, flowrate: FlowRates.oneGPH,
                                                                             irreff: IrrEff.drip, swhc: SoilWHC.medium, ib: 0, aw: 0,
                                                                             status: false, started: 0,
                                                                             color: zoneEventColors[0], textColor: zoneTextColor
                                                                           }));
          await multi.hset(dbKeys.dbZonesKey, FertilizerZoneId, JSON.stringify({ id: FertilizerZoneId, name:'Fertilizer', area: 0,
                                                                                type: ZoneType.control, flowrate: FlowRates.oneGPH,
                                                                                irreff: IrrEff.drip, swhc: SoilWHC.medium, ib: 0, aw: 0,
                                                                                status: false, started: 0,
                                                                                color: zoneEventColors[1], textColor: zoneTextColor
                                                                              }));

          for (var i = 3; i <= zoneCount; i++) {
            var zone = { id: i, name:`Z0${i-2}`, area: 0, type: ZoneType.open,
                         flowrate: FlowRates.oneGPH, irreff: IrrEff.drip, swhc: SoilWHC.medium,
                         ib: 0, aw: 0, status: false, started: 0,
                         color: zoneEventColors[i-1], textColor: zoneTextColor };

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
      });
    }

    OSPi.getOSPiInstance(zoneCount, async (ospi) => {
        this.ospi = ospi;
    });

    // Create and start the queue that will create irrigation/fertigation events
    // based on what is demanded by the crops planted in the zone
    try {
      ZoneQueue = await new Queue('ZoneQueue', {redis: {host: 'redis'}});

      // Set Queue processor
      ZoneQueue.process(async (job, done) => {
        this.processJob(job, done);
      });

      // Create a job to calculate the irr/fert demand every morning, if job !exist
      ZoneQueue.add( { task: "Calculate zone irr/fert demand!"},
                     { repeat: { cron: '15 3 * * *' }, removeOnComplete: true } );

    } catch (err) {
      log.error(`Failed to create ZONE queue: ${err}`);
    }

    callback();
  }

  // TODO: Calculate daily water depletion for each zone based on plantings.
  // TODO: Create irrigation/fertilization events as necessary
  //
  // 1. Initial Water Balance (ib)
  // 2. Minus Crop Water Use (ETc(day) = ETo (day) x Kc (Crop coefficient))
  // 3. Irrigate until soil is recharged to Field Capacity (fc): water remaining after drainage
  //
  // Yield Threshold Depletion (YTD)   - minimum available water to avoid crop stress impacting yield
  // Maximum Allowable Depletion (MAD) - (<=YTD) management practice before irrigation
  //
  // Irrigators Equation : Q x t = d x A
  // Q - flow rate (ft3/sec)
  // t - time (hr)
  // d - depth (inches)
  // A - area (acres)
  //
  async processJob(job, done) {
    log.error(`Zone job fired @ ${new Date()}`);

    Plantings.getPlantingsInstance(async (plantingsInstance) => {
      try {
        var zones = await this.getAllZones();
        zones.forEach(async (zone) => {
          plantingsInstance.getPlantingsByZone(zone.id, async (plantings) => {
            if (plantings.length) {
              for (var i = 0; i < plantings.length; i++) {
                // TODO: *** DO THE CALCS, CREATE THE EVENT
              }
            }
          });
        });
      } catch (err) {
        log.error(`Zone processJob error: ${err}`);
      }

      done();
    });
  }

  // Returns zones that are available for assignment
  async getZones(callback) {
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

  async setZone(zone, callback) {
    try {
      var inputZone = await zonesSchema.validate(zone);
      var saveZone = JSON.parse(await db.hgetAsync(dbKeys.dbZonesKey, inputZone.id));

      saveZone.name = inputZone.name;
      saveZone.area = inputZone.area;
      saveZone.irreff = inputZone.irreff;
      saveZone.swhc = inputZone.swhc;
      saveZone.flowrate = inputZone.flowrate;
      saveZone.initDay = inputZone.initDay;
      saveZone.initKc = inputZone.initKc;
      saveZone.devDay = inputZone.devDay;
      saveZone.devKc = inputZone.devKc;
      saveZone.midDay = inputZone.midDay;
      saveZone.midKc = inputZone.midKc;
      saveZone.lateDay = inputZone.lateDay;
      saveZone.lateKc = inputZone.lateKc;
      saveZone.totDay = inputZone.totDay;
      saveZone.totKc = inputZone.totKc;
      saveZone.mad = inputZone.mad;
      saveZone.plantings = inputZone.plantings;

      let status = false, started = 0;
      if (typeof inputZone.status != 'undefined')
        status = inputZone.status;

      // Switch zone on/off if status changed
      if (saveZone.status != status) {
        log.debug(`Zone status: ${status} ${new Date()}`);
        await this.ospi.switchZone(saveZone.id, status);
      }

      if (status)
        started = Date.now();

      saveZone.status = status;
      saveZone.started = started;

      await db.hsetAsync(dbKeys.dbZonesKey, saveZone.id, JSON.stringify(saveZone));

    } catch (err) {
      log.error(`setZone(${zone.id}): ${JSON.stringify(err)}`);
    }

    callback();
  }

  // Turn on/off a zone
  async switchZone(zid, callback) {
    var zone;
    try {
      zone = JSON.parse(await db.hgetAsync(dbKeys.dbZonesKey, zid));

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
      log.error(`switchZone: Failed to switch zone: ${err}`);
    }
    callback(zone.status);
  }

  // Average the crop stage durations and Kc's for every planting per zone.
  // Result is an approximation across crops.
  // Better to group same or like crops to increase precision
  async updatePlantings(zids) {
    Plantings.getPlantingsInstance((plantingsInstance) => {
      try {
        zids.forEach(async (zid) => {
          var zone = await this.getZone(zid);

          // Clear old coefficients
          zone.initDay = zone.initKc = zone.devDay = zone.devKc = 0;
          zone.midDay = zone.midKc = zone.lateDay = zone.lateKc = 0;
          zone.totDay = zone.totKc = zone.mad = 0;

          plantingsInstance.getPlantingsByZone(zid, async (plantings) => {
            if (plantings.length) {
              for (var i = 0; i < plantings.length; i++) {
                // TODO: adjust the coefficients based on counts and spacing of crops
                var planting = plantings[i];
                var crop = await plantingsInstance.getCrop(planting.cid);

                zone.initDay += crop.initDay;
                zone.initKc += crop.initKc;
                zone.devDay += crop.devDay;
                zone.devKc += crop.devKc;
                zone.midDay += crop.midDay;
                zone.midKc += crop.midKc;
                zone.lateDay += crop.lateDay;
                zone.lateKc += crop.lateKc;
                zone.totDay += crop.totDay;
                zone.totKc += crop.totKc;
                zone.mad += planting.mad;
              }

              zone.initDay /= plantings.length;
              zone.initKc /= plantings.length;
              zone.devDay /= plantings.length;
              zone.devKc /= plantings.length;
              zone.midDay /= plantings.length;
              zone.midKc /= plantings.length;
              zone.lateDay /= plantings.length;
              zone.lateKc /= plantings.length;
              zone.totDay /= plantings.length;
              zone.totKc /= plantings.length;
              zone.mad /= plantings.length;
            }
            zone.plantings = plantings.length;

            this.setZone(zone, () => {});
          }); // getPlantingByZone
        }); // forEach zone
      } catch (err) {
        log.error(`updatePlantings Failed to get zone: ${err}`);
      }
    });
  }
}

module.exports = {
  ZonesInstance,
  getZonesInstance
};
