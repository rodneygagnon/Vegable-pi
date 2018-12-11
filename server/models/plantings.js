/**
 * Plantings Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const {log} = require('../controllers/logger');

const uuidv4 = require('uuid/v4');

const Settings = require('./settings');

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const plantingSchema = schema({
  id: String,       // Planting UUID
  zid: Number,      // Zone ID
  title: String,
  date: String,     // ISO8601
  initDay: Number,  // Agreggated Crop data for this planting
  initKc: Number,
  devDay: Number,
  devKc: Number,
  midDay: Number,
  midKc: Number,
  lateDay: Number,
  lateKc: Number,
  totDay: Number,
  totKc: Number,
  cids: Array       // Crop Ids
});

let PlantingsInstance;

const getPlantingsInstance = async (callback) => {
  if (PlantingsInstance) {
   callback(PlantingsInstance);
   return;
  }

  PlantingsInstance = await new Plantings();
  log.debug("Plantings Constructed! ");
  await PlantingsInstance.init(() => {
   log.debug("Plantings Initialized! ");
   callback(PlantingsInstance);
  })
}

class Plantings {
  constructor() {
    this.config = null;
  }

  async init(callback) {
    Settings.getSettingsInstance(async (gSettings) => {
      this.config = gSettings;

      callback();
    });
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

  // Update a planting. Create if it doesn't exist. Delete if action=='delete'
  async updatePlanting(planting, action, callback) {
    log.debug(`updatePlanting: (${JSON.stringify(planting)})`);

    try {
      var validPlanting = await plantingSchema.validate(planting);
      var savedPlanting = null;

      // id is set if we are updating/deleting a planting, go find it
      if (typeof planting.id !== 'undefined' && planting.id !== "") {
        var plantings = await db.zrangebyscoreAsync(dbKeys.dbPlantingsKey,
                                                    planting.zid, planting.zid);

        log.debug(`updatePlanting (updating): (${JSON.stringify(validPlanting)})`);

        try {
          plantings.forEach((p) => {
            if (p.zid === validPlanting.zid) {
              savedPlanting = p;
              throw BreakException;
            }
          });
        } catch (e) {
          if (e !== BreakException) throw (e);
        }
      }

      if (savedPlanting) {
        var removePlanting = JSON.stringify(savedPlanting);

        if (action === 'delete') { // DELETE a planting

          log.debug(`updatePlanting(delete): del old planting(${removePlanting})`);

          await db.zremAsync(dbKeys.dbPlantingsKey, removePlanting);

        } else { // UPDATE a planting
          savedPlanting.zid = validPlanting.zid;
          savedPlanting.title = validPlanting.title;
          savedPlanting.date = validPlanting.date;
          savedPlanting.cids = validPlanting.cids;

          // TODO: calcuate the aggregate crop data for this planting

          log.debug(`updatePlanting(update): add new planting(${JSON.stringify(savedPlanting)})`);

          var zcnt = await db.zaddAsync(dbKeys.dbPlantingsKey, savedPlanting.zid, JSON.stringify(savedPlanting));
          if (zcnt > 0) {
            log.debug(`updatePlanting(update): del old planting(${removePlanting})`);

            await db.zremAsync(dbKeys.dbEventsKey, removePlanting);
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
      log.error("updatePlanting Failed to save planting: " + err);
    }

    callback();
  }
}

module.exports = {
   Plantings,
   getPlantingsInstance
};
