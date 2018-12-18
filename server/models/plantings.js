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

const {db} = require('./db');
const {dbKeys} = require('./db');

const schema = require('schm');
const plantingSchema = schema({
  id: String,       // Planting UUID
  zid: Number,      // Zone ID
  title: String,
  date: String,     // ISO8601
  cid: String,
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

    log.debug(`getPlantingsByZone: (${redisPlantings.length})`);

    for (var i = 0; i < redisPlantings.length; i++)
      plantings[i] = await plantingSchema.validate(JSON.parse(redisPlantings[i]));

    callback(plantings);
  }

  async getCrop(cid) {
    return (await this.crops.getCrop(cid));
  }

  // Update a planting. Create if it doesn't exist. Delete if action=='delete'
  async updatePlanting(planting, action, callback) {
    log.debug(`updatePlanting: (${JSON.stringify(planting)})`);

    // Keep track of which zones need to be notified of a planting change
    var zoneIds = [];

    try {
      var validPlanting = await plantingSchema.validate(planting);

      zoneIds.push(validPlanting.zid);

      var savedPlanting = null;

      // id is set if we are updating/deleting a planting, go find it
      if (typeof planting.id !== 'undefined' && planting.id !== "") {
        var plantings = await db.zrangebyscoreAsync(dbKeys.dbPlantingsKey, '-inf', '+inf');

        log.debug(`updatePlanting (updating): (${JSON.stringify(validPlanting)})`);

        for (var i = 0; i < plantings.length; i++) {
          var pObj = JSON.parse(plantings[i]);
          if (pObj.id === validPlanting.id) {
            savedPlanting = pObj;
            break;
          }
        }
      }

      if (savedPlanting) {
        var removePlanting = JSON.stringify(savedPlanting);

        if (action === 'delete') { // DELETE a planting
          log.debug(`updatePlanting(delete): del old planting(${removePlanting})`);

          await db.zremAsync(dbKeys.dbPlantingsKey, removePlanting);
        } else { // UPDATE a planting
          if (savedPlanting.zid !== validPlanting.zid)
            zoneIds.push(savedPlanting.zid);

          savedPlanting.zid = validPlanting.zid;
          savedPlanting.title = validPlanting.title;
          savedPlanting.date = validPlanting.date;
          savedPlanting.cid = validPlanting.cid;
          savedPlanting.count = validPlanting.count;
          savedPlanting.spacing = validPlanting.spacing;
          savedPlanting.mad = validPlanting.mad;

          log.debug(`updatePlanting(update): add new planting(${JSON.stringify(savedPlanting)})`);

          var zcnt = await db.zaddAsync(dbKeys.dbPlantingsKey, savedPlanting.zid, JSON.stringify(savedPlanting));
          if (zcnt > 0) {
            log.debug(`updatePlanting(update): del old planting(${removePlanting})`);

            await db.zremAsync(dbKeys.dbPlantingsKey, removePlanting);
          }
        }

      // CREATE a new planting
      } else {
        log.debug(`updatePlanting(create): validPlanting(${JSON.stringify(validPlanting)})`);

        // Assign a uuidv
        validPlanting.id = uuidv4();

        await db.zaddAsync(dbKeys.dbPlantingsKey, validPlanting.zid, JSON.stringify(validPlanting));
      }
    } catch (err) {
      log.error(`updatePlanting Failed to save planting: ${err}`);
    }

    callback(zoneIds);
  }
}

module.exports = {
   Plantings,
   getPlantingsInstance
};
