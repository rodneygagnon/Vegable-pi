/**
 * Crops Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const csvFilePath='/usr/app/config/CropTables-GenericCAClimate.csv';
const csv=require('csvtojson');

const uuidv4 = require('uuid/v4');

const {log} = require('../controllers/logger');

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const cropSchema = schema({
  id: String,
  name: String,
  type: String,
  initDay: Number,
  initKc: Number,
  devDay: Number,
  devKc: Number,
  midDay: Number,
  midKc: Number,
  lateDay: Number,
  lateKc: Number,
  totDay: Number,
  totKc: Number
});

let CropsInstance;

const getCropsInstance = async (callback) => {
  if (CropsInstance) {
    callback(CropsInstance);
    return;
  }

  CropsInstance = await new Crops();
  await CropsInstance.init(() => {
    log.debug("*** Crops Initialized! ");
    callback(CropsInstance);
  })
}

class Crops {
  constructor() {}

  async init(callback) {
    var cropCnt = await db.hlenAsync(dbKeys.dbCropsKey);

    log.debug(`Crop Count(${dbKeys.dbCropsKey}): ` + cropCnt);

    // Create default crops if necessary
    if (cropCnt === 0) {
      var crops = [];
      csv()
        .fromFile(csvFilePath)
        .then(async (crops) => {
          log.debug(`Crops: ${crops.length}`);

          crops.forEach(async (crop) => {
            var validCrop = await cropSchema.validate(crop);

            validCrop.id = uuidv4();

            log.debug(`Adding Crop(${validCrop.id}): ` + JSON.stringify(validCrop));

            await db.hsetAsync(dbKeys.dbCropsKey, validCrop.id, JSON.stringify(validCrop));
          });
        });
    }
    callback();
  }

  async getAllCrops(callback) {
    var crops = [];

    var redisCrops = await db.hvalsAsync(dbKeys.dbCropsKey);
    for (var i = 0; i < redisCrops.length; i++)
      crops[i] = await cropSchema.validate(JSON.parse(redisCrops[i]));

    // sort by name
    await crops.sort((a, b) => {
      if (a.name < b.name) return -1;
      if (a.name > b.name) return 1;
      return 0;
    });

    callback(crops);
  }

  async getCrop(cid) {
    var crop = null;
    try {
      crop = JSON.parse(await db.hgetAsync(dbKeys.dbCropsKey, cid));
    } catch (err) {
      log.error(`getCrop Failed to get crop: ${err}`);
    }
    return crop;
  }

  // Update a planting. Create if it doesn't exist. Delete if action=='delete'
  async updateCrop(crop, action, callback) {
    log.debug(`updateCrop: (${JSON.stringify(crop)})`);

    try {
      var validCrop = await cropSchema.validate(crop);

      // id is set if we are updating/deleting a crop, go find it
      if (typeof crop.id !== 'undefined' && crop.id !== "") {
        var savedCrop = JSON.parse(await db.hgetAsync(dbKeys.dbCropsKey, crop.id));

        if (savedCrop) {
          if (action === 'delete') { // DELETE a crop
            log.debug(`updateCrop(delete): del old crop(${savedCrop})`);

            await db.hdelAsync(dbKeys.dbCropsKey, savedCrop.id);
          } else { // UPDATE a planting
            savedCrop.name = validCrop.name;
            savedCrop.type = validCrop.type;
            savedCrop.initDay = validCrop.initDay;
            savedCrop.initKc = validCrop.initKc;
            savedCrop.devDay = validCrop.devDay;
            savedCrop.devKc = validCrop.devKc;
            savedCrop.midDay = validCrop.midDay;
            savedCrop.midKc = validCrop.midKc;
            savedCrop.lateDay = validCrop.lateDay;
            savedCrop.lateKc = validCrop.lateKc;

            // Calculate totals
            savedCrop.totDay = savedCrop.initDay + savedCrop.devDay +
                               savedCrop.midDay + savedCrop.lateDay;
            savedCrop.totKc = savedCrop.initDay * savedCrop.initKc +
                              savedCrop.devDay * savedCrop.devKc +
                              savedCrop.midDay * savedCrop.midKc +
                              savedCrop.lateDay * savedCrop.lateKc;

            log.debug(`updateCrop(update): update crop(${JSON.stringify(savedCrop)})`);

            await db.hsetAsync(dbKeys.dbCropsKey, savedCrop.id, JSON.stringify(savedCrop));
          }
        }
      } else { // CREATE a new crop
        // Assign a uuidv
        validCrop.id = uuidv4();

        // Calculate totals
        validCrop.totDay = validCrop.initDay + validCrop.devDay +
                           validCrop.midDay + validCrop.lateDay;
        validCrop.totKc = validCrop.initDay * validCrop.initKc +
                          validCrop.devDay * validCrop.devKc +
                          validCrop.midDay * validCrop.midKc +
                          validCrop.lateDay * validCrop.lateKc;

        log.debug(`updateCrop(create): validCrop(${JSON.stringify(validCrop)})`);

        await db.hsetAsync(dbKeys.dbCropsKey, validCrop.id, JSON.stringify(validCrop));
      }
    } catch (err) {
      log.error(`updateCrop Failed to save crop: ${err}`);
    }
    callback();
  }
}

module.exports = {
  CropsInstance,
  getCropsInstance
};
