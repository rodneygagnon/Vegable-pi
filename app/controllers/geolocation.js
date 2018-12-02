/**
 * Geolocation Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const {log} = require('./logger');

const request = require('request');

const mapboxGeocodeURL = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';
const mapboxAccessKeyURL = '.json?access_token=';

let GeoLocationInstance;

const getGeoLocationInstance = async (key, callback) => {
  if (GeoLocationInstance) {
    callback(GeoLocationInstance);
    return;
  }

  GeoLocationInstance = await new GeoLocation(key);
  log.debug("GeoLocation Constructed! ");
  GeoLocationInstance.init(() => {
    log.debug("GeoLocation Initialized! ");
    callback(GeoLocationInstance);
  })
}

class GeoLocation {
  constructor(key) {
    this.key = key;
  }

  async init(callback) {
    callback();
  }

  // Get lat/long of given location
  async getLatLong(address, city, state, zip, callback)
  {
    this.latitude = 0;
    this.longitude = 0;

    var location = encodeURIComponent(address + ',' + city + ',' + state + ',' + zip);
    var url = mapboxGeocodeURL + location + mapboxAccessKeyURL + await this.key;

    request({
      url: url,
      json: true
    }, (error, response, body) => {
      // TODO: Fleshout error handling
      if (error) {
        log.error('Unable to connect to GeoLocation Service');
      } else {
        this.place = body.features[0].place_name;
        this.latitude = body.features[0].geometry.coordinates[0];
        this.longitude = body.features[0].geometry.coordinates[1];
      }
      callback(error, this.latitude, this.longitude);
    });
  }
}

module.exports = {
  GeoLocation,
  getGeoLocationInstance
};
