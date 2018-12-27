/**
 * ET Reference Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const csvFilePath='/usr/app/config/ETReferenceTable.csv';
const csv=require('csvtojson');

const {log} = require('../controllers/logger');

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const etrSchema = schema({
  zone: Number,
  title: String,
  desc: String,
  jan: Number,
  feb: Number,
  mar: Number,
  apr: Number,
  may: Number,
  jun: Number,
  jul: Number,
  aug: Number,
  sep: Number,
  oct: Number,
  nov: Number,
  dec: Number,
  tot: Number
});

let ETrInstance;

const getETrInstance = async (callback) => {
  if (ETrInstance) {
    callback(ETrInstance);
    return;
  }

  ETrInstance = await new ETr();
  await ETrInstance.init(() => {
    log.debug("*** ETrs Initialized! ");
    callback(ETrInstance);
  })
}

class ETr {
  constructor() {}

  async init(callback) {
    try {
      var etrCnt = await db.hlenAsync(dbKeys.dbETrKey);

      // Create ET reference table if necessary
      if (etrCnt === 0) {
        var etrs = [];
        csv()
          .fromFile(csvFilePath)
          .then(async (etrs) => {
            log.debug(`ETrs: ${etrs.length}`);

            etrs.forEach(async (etr) => {
              var validETr = await etrSchema.validate(etr);

              log.debug(`Adding ETr(${validETr.zone}): ` + JSON.stringify(validETr));

              await db.hsetAsync(dbKeys.dbETrKey, validETr.zone, JSON.stringify(validETr));
            });
          });
      }
    } catch (err) {
      log.error(`ETr.init: failed to set ET reference table (${err})`);
    }

    callback();
  }

  async getETrs(callback) {
    var etrs = [];

    var redisETrs = await db.hvalsAsync(dbKeys.dbETrKey);
    for (var i = 0; i < redisETrs.length; i++)
      etrs[i] = await etrSchema.validate(JSON.parse(redisETrs[i]));

    // sort by name
    await etrs.sort((a, b) => {
      if (a.zone < b.zone) return -1;
      if (a.zone > b.zone) return 1;
      return 0;
    });

    callback(etrs);
  }

  async getEtr(zone) {
    var etr = null;
    try {
      etr = JSON.parse(await db.hgetAsync(dbKeys.dbETrKey, zone));
    } catch (err) {
      log.error(`getETr Failed to get etr: ${err}`);
    }
    return etr;
  }
}

module.exports = {
  ETrInstance,
  getETrInstance
};
