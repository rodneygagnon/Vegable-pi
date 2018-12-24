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

  async getCrops(callback) {
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

  async setCrop(crop) {
    try {
      var validCrop = await cropSchema.validate(crop);

      // Calculate totals
      validCrop.totDay = validCrop.initDay + validCrop.devDay +
                         validCrop.midDay + validCrop.lateDay;
      validCrop.totKc = validCrop.initDay * validCrop.initKc +
                        validCrop.devDay * validCrop.devKc +
                        validCrop.midDay * validCrop.midKc +
                        validCrop.lateDay * validCrop.lateKc;

      if (typeof validCrop.id === 'undefined' || validCrop.id === "")
        // Create a new crop id.
        validCrop.id = uuidv4();

      await db.hsetAsync(dbKeys.dbCropsKey, validCrop.id, JSON.stringify(validCrop));

      return(validCrop.id);
    } catch (err) {
      log.error(`getCrop Failed to set crop: ${err}`);
      return;
    }
  }

  async delCrop(cid) {
    try {
      await db.hdelAsync(dbKeys.dbCropsKey, cid);
    } catch (err) {
      log.error(`delCrop Failed to get crop: ${err}`);
      return;
    }
    return cid;
  }
}

module.exports = {
  CropsInstance,
  getCropsInstance
};
