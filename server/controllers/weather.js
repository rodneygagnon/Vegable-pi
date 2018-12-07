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
}

module.exports = {
  Weather,
  getWeatherInstance
};
