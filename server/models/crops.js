/**
 * Crops Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const csvFilePath='/usr/app/config/CropTables-GenericCAClimate.csv';
const csv=require('csvtojson');

const {log} = require('../controllers/logger');

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const cropSchema = schema({
  name: String,
  type: String,
  plantMonth: Number,
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
  log.debug("Crops Constructed! ");
  await CropsInstance.init(() => {
    log.debug("Crops Initialized! ");
    callback(CropsInstance);
  })
}

class Crops {
  constructor() {
  }

  async init(callback) {
    var cropCnt = await db.zcount(dbKeys.dbCropsKey, '-inf', '+inf');

    // Create default crops if necessary
    if (cropCnt == 0) {
      var crops = [];
      csv()
        .fromFile(csvFilePath)
        .then((crops) => {
          log.debug(`Crops: ${crops.length}`);

          crops.forEach((crop) => {
            this.addCrop(crop);
          });
        })
    }

    callback();
  }

  // Add a crop to the database.
  async addCrop(crop) {
    log.debug(`addCrop: (${JSON.stringify(crop)})`);

    try {
      var validCrop = await cropSchema.validate(crop);

      // use the plantMonth as the score. there should only be one crop entry per plantMonth
      if (!await db.zaddAsync(dbKeys.dbCropsKey, crop.plantMonth, JSON.stringify(crop)))
        log.debug(`addCrop(FAILED)`);
    } catch (err) {
      log.error(`addCrop(FAILED): ${err}`);
    }
}

  async getAllCrops(callback) {
    callback(await db.zrangebyscoreAsync(dbKeys.dbCropsKey, '-inf', '+inf'));
  }

  async getCropsByMonth(month, callback) {
    callback(await db.zrangebyscoreAsync(dbKeys.dbCropsKey, month, month));
  }

}

module.exports = {
  CropsInstance,
  getCropsInstance
};
