/**
 * ET Reference Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */

const Schema = require('schm');

const csvFilePath = '/usr/app/config/ETReferenceTable.csv';
const csv = require('csvtojson');

const { log } = require('../controllers/logger');

const { db } = require('./db');
const { dbKeys } = require('./db');

const etrSchema = Schema({
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
  tot: Number,
});

class ETr {
  constructor() {
    if (!ETr.ETrInstance) {
      ETr.init();

      ETr.ETrInstance = this;
    }
    return ETr.ETrInstance;
  }

  static async init() {
    try {
      const etrCnt = await db.hlenAsync(dbKeys.dbETrKey);

      // Create ET reference table if necessary
      if (etrCnt === 0) {
        csv()
          .fromFile(csvFilePath)
          .then(async (etrs) => {
            log.debug(`ETrs: ${etrs.length}`);

            etrs.forEach(async (etr) => {
              const validETr = await etrSchema.validate(etr);

              log.debug(`Adding ETr(${validETr.zone}): ${JSON.stringify(validETr)}`);

              await db.hsetAsync(dbKeys.dbETrKey, validETr.zone, JSON.stringify(validETr));
            });
          });
      }
    } catch (err) {
      log.error(`ETr.init: failed to set ET reference table (${err})`);
    }

    log.debug('*** ETr Initialized!');
  }

  async getETrs(callback) {
    const etrs = [];

    const redisETrs = await db.hvalsAsync(dbKeys.dbETrKey);
    for (let i = 0; i < redisETrs.length; i++) {
      etrs.push(etrSchema.validate(JSON.parse(redisETrs[i])));
    }

    // sort by name
    await etrs.sort((a, b) => {
      if (a.zone < b.zone) return -1;
      if (a.zone > b.zone) return 1;
      return 0;
    });

    callback(await Promise.all(etrs));
  }

  async getETr(zone) {
    let etr = null;
    try {
      etr = JSON.parse(await db.hgetAsync(dbKeys.dbETrKey, zone));
    } catch (err) {
      log.error(`getETr Failed to get etr: ${err}`);
    }
    return etr;
  }

  async getDailyETr(etzone, startDate, endDate) {
    const dailyETr = [];
    const etrZone = await this.getETr(etzone);

    for (let day = startDate; day <= endDate; day.setDate(day.getDate() + 1)) {
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
        default:
          dailyETr.push(etrZone.dec / 31);
          break;
      }
    }

    return (dailyETr);
  }
}

const ETrInstance = new ETr();
Object.freeze(ETrInstance);

module.exports = {
  ETrInstance,
};
