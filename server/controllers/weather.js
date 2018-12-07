/**
 * Weather Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const {log} = require('./logger');

const request = require('request');

const Settings = require('../models/settings');

const darkskyWeatherURL = 'https://api.darksky.net/forecast/';
const cimisURL = 'http://et.water.ca.gov/api/data?appKey=';

let WeatherInstance;

const getWeatherInstance = async (callback) => {
  if (WeatherInstance) {
    callback(WeatherInstance);
    return;
  }

  WeatherInstance = await new Weather();
  log.debug("Weather Constructed! ");
  WeatherInstance.init(() => {
    log.debug("Weather Initialized! ");
    callback(WeatherInstance);
  });
}

class Weather {
  constructor() {
    this.config = null;
  }

  async init(callback) {
    var gSettings;

    Settings.getSettingsInstance((gSettings) => {
      this.config = gSettings;

      // ==== Test CIMIS API ====
      // Get yesterday's date
      var d = new Date();
      d.setDate(d.getDate() - 1);

      this.getCimisConditions(d, (error, conditions) => {
        log.debug(`CIMIS Conditions: ${JSON.stringify(conditions)}`);
      });
      // ==== Test CIMIS API ====

      callback();
    });
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
        log.error('Unable to connect to Dark Sky');

      callback(error, body.currently);
    });
  }

  // Get Conditions
  async getCimisConditions(date, callback)
  {
    var targetDate = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();

    var url = cimisURL + await this.config.getCimisKey() + '&targets=' + await this.config.getZip() +
              '&startDate=' + targetDate + '&endDate=' + targetDate;

    log.debug(`CIMIS URL: ${url}`);

    request({
      url: url,
      json: true
    }, (error, response, body) => {
      // TODO: Fleshout error handling
      if (error)
        log.error('Unable to connect to CIMIS');

      callback(error, body);
    });
  }

}

module.exports = {
  Weather,
  getWeatherInstance
};
