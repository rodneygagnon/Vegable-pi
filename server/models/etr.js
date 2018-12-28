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

  async getETr(zone) {
    var etr = null;
    try {
      etr = JSON.parse(await db.hgetAsync(dbKeys.dbETrKey, zone));
    } catch (err) {
      log.error(`getETr Failed to get etr: ${err}`);
    }
    return etr;
  }

  async getDailyETr(etzone, startDate, endDate) {
    var dailyETr = [];
    var etrZone = await this.getETr(etzone);

    for (var day = startDate; day <= endDate; day.setDate(day.getDate() + 1)) {
      switch (day.getMonth()) {
        case 0:
          dailyETr.push(etrZone.jan / 31);
          break;
        case 1:
          dailyETr.push(etrZone.feb / 28);
          break;
        case 2:
          dailyETr.push(etrZone.mar / 31);
          break;
        case 3:
          dailyETr.push(etrZone.apr / 30);
          break;
        case 4:
          dailyETr.push(etrZone.may / 31);
          break;
        case 5:
          dailyETr.push(etrZone.jun / 30);
          break;
        case 6:
          dailyETr.push(etrZone.jul / 31);
          break;
        case 7:
          dailyETr.push(etrZone.aug / 30);
          break;
        case 8:
          dailyETr.push(etrZone.sep / 30);
          break;
        case 9:
          dailyETr.push(etrZone.oct / 31);
          break;
        case 10:
          dailyETr.push(etrZone.nov / 30);
          break;
        case 11:
          dailyETr.push(etrZone.dec / 31);
          break;
      }
    }

    return(dailyETr);
  }
}

module.exports = {
  ETrInstance,
  getETrInstance
};
