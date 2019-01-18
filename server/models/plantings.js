/**
 * @file Plantings Singleton
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */
'use strict';

const uuidv4 = require('uuid/v4');

/** Controllers */
const {log} = require('../controllers/logger');
const {WeatherInstance} = require('../controllers/weather');

/** Models */
const {CropsInstance} = require('./crops');

/** Database */
const {db} = require('./db');
const {dbKeys} = require('./db');

/** Constants */
const {milli_per_day} = require('../../config/constants');

const schema = require('schm');
const plantingSchema = schema({
  id: String,       // Planting UUID
  zid: Number,      // Zone ID
  title: String,
  date: String,     // ISO8601
  cid: String,
  age: { type: Number, min: 0 },       // Age (days) of the crop at planting (seed = 0)
  mad: { type: Number, min: 0 },       // Max Allowable Depletion (MAD %)
  count: { type: Number, default: 1 },
  spacing: { type: Number, default: 1} // Inches
});

class Plantings {
  constructor() {
    if (!Plantings.PlantingsInstance) {
      Plantings.PlantingsInstance = this;
      log.debug(`*** Plantings Initialized!`);
    }
    return Plantings.PlantingsInstance;
  }

  async getAllPlantings(callback) {
    var plantings = [];

    var redisPlantings = await db.zrangebyscoreAsync(dbKeys.dbPlantingsKey, '-inf', '+inf');
    for (var i = 0; i < redisPlantings.length; i++) {
      plantings[i] = await plantingSchema.validate(JSON.parse(redisPlantings[i]));
    }
    callback(plantings);
  }

  async getPlantingsByZone(zid) {
    var plantings = [];

    // get all plantings for given zone
    var redisPlantings = await db.zrangebyscoreAsync(dbKeys.dbPlantingsKey, zid, zid);

    for (var i = 0; i < redisPlantings.length; i++)
      plantings[i] = await plantingSchema.validate(JSON.parse(redisPlantings[i]));

    return(plantings);
  }

  // Calculate the cumulative ETc for the plantings in this zone between the given dates
  // if there are no plantings, return the ETo because some water should have been depleted
  //
  // TODO: the depletion when there is no planting should account for a default (bare soil/cover crop/...), not ETo
  async getETcByZone(zid, start, end) {
    var ETc = 0, ETo = 0;

    var dailyETo = await WeatherInstance.getDailyETo(new Date(start), new Date(end));
    for (var etoDay = 0; etoDay < dailyETo.length; etoDay++)
      ETo += dailyETo[etoDay];

    var plantings = await this.getPlantingsByZone(zid);
    for (var i = 0; i < plantings.length; i++) {
      var planting = plantings[i];

      // Get the crop Kc's for this planting and calculate the age
      // of the crop at the start of this range
      var crop = await this.getCrop(planting.cid);
      var plantingDate = new Date(planting.date);
      var age = planting.age +
                  Math.round(Math.abs((start.getTime() - plantingDate.getTime())/(milli_per_day)));

      // Caclulate this crop stages in order to extract the appropriate Kc
      var initStage = crop.initDay;
      var devStage = initStage + crop.devDay;
      var midStage = devStage + crop.midDay;

      // For each day on the given range, accumulate the dailyETc using the ETo and Kc
      // TODO: adjust the precision by acounting for crop density, canopy, shading, ...
      for (var day = 0; day < dailyETo.length; day++) {
        ETc += dailyETo[day] *
                    (age <= initStage ? crop.initKc :
                      (age <= devStage ? crop.devKc :
                        (age <= midStage ? crop.midKc : crop.lateKc)));
        age++;
      }
    }

    // Return the zone's ETc for the given date range
    return(ETc > 0 ? ETc : ETo);
  }

  // Calculate the fertilizer applications for the plantings in this zone between the given dates
  async getFertilizerByZone(zid, start, end, lastFertilized) {
    var plantings = await this.getPlantingsByZone(zid);
    var fertilizer = JSON.stringify({ n: 0, p: 0, k: 0 });

    if (plantings.length === 0) {
      return(fertilizer);
    }

    log.debug(`getFertilizerByZone: zid(${zid}) start(${start}) end(${end}) lastFert(${lastFertilized})`);

    var fertApplications = [];
    do {
      for (var i = 0; i < plantings.length; i++) {
        var planting = plantings[i];
        var plantingDate = new Date(planting.date);

        // Adjust the dates if necessary.
        // - If end is before planting, we won't fertilize.
        // - Else if start is before planting, move start up to planting
        if (end < plantingDate)
          break;
        else if (start < plantingDate) {
          start = plantingDate;
        }

        // Get the crop and caclulate this crop stages in order to extract the NPK
        var crop = await this.getCrop(planting.cid);
        var initStage = crop.initDay;
        var devStage = initStage + crop.devDay;
        var midStage = devStage + crop.midDay;

        var age = planting.age +
                    Math.round(Math.abs((start.getTime() - plantingDate.getTime())/(milli_per_day)));
        var lastAgeFertilized = (lastFertilized < plantingDate ? 0 : planting.age +
                    Math.round(Math.abs((lastFertilized.getTime() - plantingDate.getTime())/(milli_per_day))));

        log.error(`getFertilizerByZone: age(${age}) lastAgeFert(${lastAgeFertilized}) stages(${initStage}:${devStage}:${midStage})`);

        // If the crop wants fertilizer at a particular stage and
        // it hasn't been fertilized during this stage yet, record what the crop needs
        if (age <= initStage) {
          if (crop.initFreq && lastAgeFertilized === 0) {
            log.error(`getFertilizerByZone(INIT): n(${crop.initN}) p(${crop.initN}) k(${crop.initK})`);
            fertApplications.push({ date: start, crops: planting.count, n: crop.initN, p: crop.initP, k: crop.initK });
          }
        } else if (age <= devStage) {
          if (crop.devFreq && lastAgeFertilized < initStage) {
            log.error(`getFertilizerByZone(DEV): n(${crop.devN}) p(${crop.devN}) k(${crop.devK})`);
            fertApplications.push({ date: start, crops: planting.count, n: crop.devN, p: crop.devP, k: crop.devK });
          }
        } else if (age <= midStage) {
          if (crop.midFreq && lastAgeFertilized < devStage) {
            log.error(`getFertilizerByZone(MID): n(${crop.midN}) p(${crop.midN}) k(${crop.midK})`);
            fertApplications.push({ date: start, crops: planting.count, n: crop.midN, p: crop.midP, k: crop.midK });
          }
        } else {
          if (crop.lateFreq && lastAgeFertilized < midStage) {
            log.error(`getFertilizerByZone(LATE): n(${crop.lateN}) p(${crop.lateN}) k(${crop.lateK})`);
            fertApplications.push({ date: start, crops: planting.count, n: crop.lateN, p: crop.lateP, k: crop.lateK });
          }
        }
      }

      start.setDate(start.getDate() + 1);
    } while (start < end);

    // We should now have a list of fertilizer applications for the crops planted in
    // the given zone over the specified time frame. Let's crudely return a weighted average (for now)
    if (fertApplications.length) {
      var crops = 0, n = 0, p = 0, k = 0;
      for (var app = 0; app < fertApplications.length; app++) {
        var fertApp = fertApplications[app];

        crops += fertApp.crops;
        n += fertApp.crops * fertApp.n;
        p += fertApp.crops * fertApp.p;
        k += fertApp.crops * fertApp.k;
      }

      fertilizer = JSON.stringify({ n: Number((n / crops).toFixed(0)),
                                    p: Number((p / crops).toFixed(0)),
                                    k: Number((k / crops).toFixed(0))
                                  });
    }

    return(fertilizer);
  }

  async getCrop(cid) {
    return (await CropsInstance.getCrop(cid));
  }

  async setPlanting(planting) {
    var pid;
    var zids = [];

    try {
      var validPlanting = await plantingSchema.validate(planting);

      zids.push(validPlanting.zid);

      if (typeof validPlanting.id === 'undefined' || validPlanting.id === "") {
        // Create a new planting id.
        validPlanting.id = uuidv4();
      } else {
        // Find and remove the old planting
        var plantings = await db.zrangebyscoreAsync(dbKeys.dbPlantingsKey, '-inf', '+inf');

        for (var i = 0; i < plantings.length; i++) {
          var pObj = JSON.parse(plantings[i]);
          if (pObj.id === validPlanting.id) {
            // Record if it was moved to another zone
            if (pObj.zid !== validPlanting.zid)
              zids.push(pObj.zid);

            // Remove the old planting
            await db.zremAsync(dbKeys.dbPlantingsKey, JSON.stringify(pObj));
            break;
          }
        }
      }
      pid = validPlanting.id;

      await db.zaddAsync(dbKeys.dbPlantingsKey, validPlanting.zid, JSON.stringify(validPlanting));

    } catch (err) {
      log.error(`setPlanting Failed to set planting: ${err}`);
    }
    return({id: pid, zids: zids});
  }

  async getPlanting(pid) {
    var planting = null;
    try {
      // Find planting
      var plantings = await db.zrangebyscoreAsync(dbKeys.dbPlantingsKey, '-inf', '+inf');

      for (var i = 0; i < plantings.length; i++) {
        var pObj = JSON.parse(plantings[i]);
        if (pObj.id === pid) {
          planting = pObj;
          break;
        }
      }
    } catch (err) {
      log.error(`getPlanting Failed to get planting: ${err}`);
    }
    return planting;
  }

  async delPlanting(planting) {
    var pid;
    var zids = [];

    try {
      var validPlanting = await plantingSchema.validate(planting);

      await db.zremAsync(dbKeys.dbPlantingsKey, JSON.stringify(validPlanting));

      pid = validPlanting.id;
      zids.push(validPlanting.zid);
    } catch (err) {
      log.error(`delPlanting Failed to del planting: ${err}`);
    }

    return({id: pid, zids: zids});
  }

}

const PlantingsInstance = new Plantings();
Object.freeze(PlantingsInstance);

module.exports = {
  PlantingsInstance
}
