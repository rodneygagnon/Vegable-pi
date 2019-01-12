/**
 * @file Crop Singleton
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
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
  initDay: Number,
  initKc: Number,
  initN: Number,
  initP: Number,
  initK: Number,
  initFreq: Number,
  devDay: Number,
  devKc: Number,
  devN: Number,
  devP: Number,
  devK: Number,
  devFreq: Number,
  midDay: Number,
  midKc: Number,
  midN: Number,
  midP: Number,
  midK: Number,
  midFreq: Number,
  lateDay: Number,
  lateKc: Number,
  lateN: Number,
  lateP: Number,
  lateK: Number,
  lateFreq: Number
});

class Crops {
  constructor() {
    if (!Crops.CropsInstance) {
      Crops.init();

      Crops.CropsInstance = this;
    }
    return Crops.CropsInstance;
  }

  static async init() {
    var cropCnt = await db.hlenAsync(dbKeys.dbCropsKey);

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
    log.debug(`*** Crops Initialized!`);
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

      if (typeof validCrop.id === 'undefined' || validCrop.id === "")
        // Create a new crop id.
        validCrop.id = uuidv4();

      await db.hsetAsync(dbKeys.dbCropsKey, validCrop.id, JSON.stringify(validCrop));

      return(validCrop.id);
    } catch (err) {
      log.error(`setCrop Failed to set crop: ${err}`);
      return;
    }
  }

  async delCrop(cid) {
    try {
      await db.hdelAsync(dbKeys.dbCropsKey, cid);
    } catch (err) {
      log.error(`delCrop Failed to del crop: ${err}`);
      return;
    }
    return cid;
  }
}

const CropsInstance = new Crops();
Object.freeze(CropsInstance);

module.exports = {
  CropsInstance
}
