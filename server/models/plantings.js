/**
 * Plantings Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const {log} = require('../controllers/logger');

const uuidv4 = require('uuid/v4');

const Crops = require('./crops');
const Weather = require('../controllers/weather');

const {db} = require('./db');
const {dbKeys} = require('./db');

const oneDay = 24*60*60*1000; // hours*minutes*seconds*milliseconds

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

let PlantingsInstance;

const getPlantingsInstance = async (callback) => {
  if (PlantingsInstance) {
   callback(PlantingsInstance);
   return;
  }

  PlantingsInstance = await new Plantings();
  await PlantingsInstance.init(() => {
   log.debug("*** Plantings Initialized! ");
   callback(PlantingsInstance);
  })
}

class Plantings {
  constructor() {}

  async init(callback) {
    // Initialize crops
    Crops.getCropsInstance((crops) => {
      this.crops = crops;
    });

    Weather.getWeatherInstance((weather) => {
      this.weather = weather;
    });

    callback();
  }

  async getAllPlantings(callback) {
    var plantings = [];

    var redisPlantings = await db.zrangebyscoreAsync(dbKeys.dbPlantingsKey, '-inf', '+inf');
    for (var i = 0; i < redisPlantings.length; i++) {
      plantings[i] = await plantingSchema.validate(JSON.parse(redisPlantings[i]));
    }
    callback(plantings);
  }

  async getPlantingsByZone(zid, callback) {
    var plantings = [];

    // get all plantings for given zone
    var redisPlantings = await db.zrangebyscoreAsync(dbKeys.dbPlantingsKey, zid, zid);

    log.debug(`getPlantingsByZone: Zone(${zid}) Plantings(${redisPlantings.length})`);

    for (var i = 0; i < redisPlantings.length; i++)
      plantings[i] = await plantingSchema.validate(JSON.parse(redisPlantings[i]));

    callback(plantings);
  }

  // Calculate the cumulative ETc for the plantings in this zone between the given dates
  async getETcByZone(zid, start, end, callback) {
    var dailyETc = 0;
    var totalDays = Math.round(Math.abs((end.getTime() - start.getTime())/(oneDay)));

    // Get daily weather for given date range
    var dailyETo = await this.weather.getDailyETo(start, end);

    this.getPlantingsByZone(zid, (plantings) => {
        plantings.forEach(async (planting) => {
          // Get the crop Kc's for this planting and calculate the age
          // of the crop at the start of this range
          var crop = await this.getCrop(planting.cid);
          var plantingDate = new Date(planting.date);
          var age = planting.age +
                      Math.round(Math.abs((start.getTime() - plantingDate.getTime())/(oneDay)));

          // Caclulate this crop stages in order to extract the appropriate Kc
          var initStage = crop.initDay;
          var devStage = initStage + crop.devDay;
          var midStage = devStage + crop.midDay;

          // For each day on the given range, accumulate the dailyETc using the ETo and Kc
          // TODO: adjust the precision by acounting for crop density, canopy, shading, ...
          for (var day = 0; day < totalDays; day++) {
            dailyETc += dailyETo[day] *
                          ((age <= initStage ? crop.initKc :
                            (age <= devStage ? crop.devKc :
                              (age <= midStage ? crop.midKc : crop.lateKc))) * planting.count);
            age++;
          }
        });
    });

    // Return the zone's ETc for the given date range
    callback(dailyETc);
  }

  async getCrop(cid) {
    return (await this.crops.getCrop(cid));
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

module.exports = {
   Plantings,
   getPlantingsInstance
};
