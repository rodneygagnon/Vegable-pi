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

const Settings = require('../models/settings');

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

let WeatherInstance;

const getWeatherInstance = async (callback) => {
  if (WeatherInstance) {
    callback(WeatherInstance);
    return;
  }

  WeatherInstance = await new Weather();
  WeatherInstance.init(() => {
    log.debug("*** Weather Initialized! ");
    callback(WeatherInstance);
  });
}

class Weather {
  constructor() {
    this.config = null;
  }

  async init(callback) {
    Settings.getSettingsInstance(async (settings) => {
      this.config = settings;

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

      callback();
    });
  }

  async processJob(job, done) {
    // Get yesterday's date
    var d = new Date();
    d.setDate(d.getDate() - 1);

    log.debug(`processJob: Getting CIMIS @ (${d})`);

    var dateString = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();

    this.getCimisConditions(dateString, async (error, conditions) => {
      if (error || typeof conditions.Data === 'undefined'
                || typeof conditions.Data.Providers === 'undefined') {
        log.error(`processJob: CIMIS error (${error}), Data (${conditions.Data}), Providers (${conditions.Data.Providers})`);
        // TODO: give our best guess by grabbing the previous day's conditions and storing as today's
      } else {
        // Add weather entry to Database
        var dateScore = d.getTime();
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

  // Get Conditions
  async getConditions(callback)
  {
    var url = darkskyWeatherURL + await this.config.getDarkSkyKey() + '/' +
              await this.config.getLong() + ',' + await this.config.getLat();

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
    var url = cimisURL + await this.config.getCimisKey() + '&targets=' + await this.config.getZip() +
              '&startDate=' + targetDate + '&endDate=' + targetDate;

    request({
      url: url,
      json: true
    }, (error, response, body) => {
      callback(error, body);
    });
  }

}

module.exports = {
  Weather,
  getWeatherInstance
};
