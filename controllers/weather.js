/**
 * Weather Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const {log} = require('./logger');

const request = require('request');
const Config = require('../model/config');
const GeoLocation = require('./geolocation')

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
    this.geolocation = null;
  }

  async init(callback) {
    var gConfig;
    var gGeoLocation;

    Config.getConfigInstance((gConfig) => {
      GeoLocation.getGeoLocationInstance((gGeoLocation) => {
        this.config = gConfig;
        this.geolocation = gGeoLocation;
        callback();
      });
    });
  }

  // Get Temperature
  async getConditions(callback)
  {
    let urlPrefix = darkskyWeatherURL + await this.config.getDarkSkyKey() + '/';

    this.geolocation.getLatLong((error, latitude, longitude) => {
      if (error) {
        log.error('Unable to get location');
        callback(error);
      } else {
        var url =  urlPrefix + longitude + ',' + latitude;

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
    });
  }
  // Get Temperature
  async getTemperature(callback)
  {
    let urlPrefix = darkskyWeatherURL + await this.config.getDarkSkyKey() + '/';

    this.geolocation.getLatLong((error, latitude, longitude) => {
      if (error) {
        log.error('Unable to get location');
        callback(error);
      } else {
        var url =  urlPrefix + longitude + ',' + latitude;

        request({
          url: url,
          json: true
        }, (error, response, body) => {
          // TODO: Fleshout error handling
          var temp;
          if (error)
            log.error('Unable to connect to Dark Sky');
          else
            temp = body.currently.temperature;

          callback(error, temp)
         });
      }
    });
  }
}

module.exports = {
  Weather,
  getWeatherInstance
};
