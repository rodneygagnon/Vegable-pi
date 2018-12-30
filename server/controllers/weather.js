/**
 * Weather Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const {log} = require('./logger');

const request = require('request');
const Queue = require("bull");

const {SettingsInstance} = require('../models/settings');
const {ETrInstance} = require('../models/etr');

const darkskyWeatherURL = 'https://api.darksky.net/forecast/';
const cimisURL = 'http://et.water.ca.gov/api/data?appKey=';

const {db} = require("../models/db");
const {dbKeys} = require("../models/db");

const schema = require("schm");
const weatherSchema = schema({
  date: String,   // yyyy-mm-dd
  eto: Number,    // evapotranspiration (inches)
  solar: Number,  // Solar Radiation (Ly/Day)
  wind: Number    // Avg Wind Speed (mph)
});

// Bull/Redis Jobs Queue
var WeatherQueue;

class Weather {
  constructor() {
    if (!Weather.WeatherInstance) {
      Weather.init();

      Weather.WeatherInstance = this;
    }
    return Weather.WeatherInstance;
  }

  static async init() {
    try {
    	WeatherQueue = new Queue('WeatherQueue', {redis: {host: 'redis'}});

      // Set Queue processor
      WeatherQueue.process(async (job, done) => {
        this.processJob(job, done);
      });

      // Get the weather every morning @ 3am
      WeatherQueue.add( {task: "Get Weather!"},
                        { repeat: { cron: '0 3 * * *' }, removeOnComplete: true } );

    } catch (err) {
      log.error(`WeatherInit: Failed to create WEATHER queue: ${err}`);
    }
    log.debug(`*** Weather Initialized!`);
  }

  async processJob(job, done) {
    // Get yesterday's date
    var d = new Date();
    d.setDate(d.getDate() - 1);

    log.debug(`processJob: Getting CIMIS @ (${d})`);

    var dateString = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    var dateScore = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) +
                                      ('0' + d.getDate()).slice(-2);

    this.getCimisConditions(dateString, async (error, conditions) => {
      if (error || typeof conditions.Data === 'undefined'
                || typeof conditions.Data.Providers === 'undefined') {
        log.error(`processJob: CIMIS error (${error}), Data (${conditions.Data}), Providers (${conditions.Data.Providers})`);
        // TODO: give our best guess by grabbing the previous day's conditions and storing as today's
      } else {
        // Add weather entry to Database
        var cimisRecord = conditions.Data.Providers[0].Records[0];
        var weather = await weatherSchema.validate({ date: cimisRecord.Date,
                                                     eto: cimisRecord.DayAsceEto.Value,
                                                     solar: cimisRecord.DaySolRadAvg.Value,
                                                     wind: cimisRecord.DayWindSpdAvg.Value });

        var zcnt = await db.zaddAsync(dbKeys.dbWeatherKey, dateScore, JSON.stringify(weather));
        if (zcnt > 0) {
          log.debug(`processJob: CIMIS conditions (${dateScore}) : ${JSON.stringify(weather)}`);
        }
      }
    });

    done();
  }

  // Return the ETo for a given date range.
  // Default to ETr table if we don't have CIMIS data for particular day
  async getDailyETo(startDate, endDate) {
    var dailyETo = [];
    var etzone = await SettingsInstance.getETZone();

    //var dailyETr = await this.etr.getDailyETr(etzone, new Date(startDate), new Date(endDate));
    var dailyETr = await ETrInstance.getDailyETr(etzone, new Date(startDate), new Date(endDate));

    // For each day of the given range, push Cimis ETo or ETr if it doesn't exist
    for (var i = 0, day = startDate; day <= endDate; i++, day.setDate(day.getDate() + 1)) {
      var cimisDate = day.getFullYear() + ('0' + (day.getMonth() + 1)).slice(-2) +
                                          ('0' + day.getDate()).slice(-2);
      var cimisETo = await db.zrangebyscoreAsync(dbKeys.dbWeatherKey, cimisDate, cimisDate);

      if (cimisETo === null || cimisETo === "")
        dailyETo.push(Number(cimisETo));
      else
        dailyETo.push(dailyETr[i]);
    }

    return(dailyETo);
  }

  // Get Conditions
  async getConditions(callback)
  {
    var url = darkskyWeatherURL + await SettingsInstance.getDarkSkyKey() + '/' +
              await SettingsInstance.getLong() + ',' + await SettingsInstance.getLat();

    request({
      url: url,
      json: true
    }, (error, response, body) => {
      // TODO: Fleshout error handling
      if (error)
        log.error(`getConditions: ${error}`);

      callback(error, body.currently);
    });
  }

  // Get Conditions
  async getCimisConditions(targetDate, callback)
  {
    var url = cimisURL + await SettingsInstance.getCimisKey() + '&targets=' + await SettingsInstance.getZip() +
              '&startDate=' + targetDate + '&endDate=' + targetDate;

    request({
      url: url,
      json: true
    }, (error, response, body) => {
      // TODO: Fleshout error handling
      if (error)
        log.error(`getCimisConditions: ${error}`);

      callback(error, body);
    });
  }

}

const WeatherInstance = new Weather();
Object.freeze(WeatherInstance);

module.exports = {
  WeatherInstance
}
