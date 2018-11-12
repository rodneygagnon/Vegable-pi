'use strict';

const request = require('request');
const Config = require('../model/config');

const mapboxGeocodeURL = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';
const mapboxAccessKeyURL = '.json?access_token=';

let GeoLocationInstance;

const getGeoLocationInstance = async (callback) => {
  if (GeoLocationInstance) {
    callback(GeoLocationInstance);
    return;
  }

  GeoLocationInstance = await new GeoLocation();
  console.log("GeoLocation Constructed! ");
  GeoLocationInstance.init(() => {
    console.log("GeoLocation Initialized! ");
    callback(GeoLocationInstance);
  })
}

class GeoLocation {
  constructor() {
    this.config = null;
  }

  async init(callback) {
    var gConfig;

    Config.getConfigInstance((gConfig) => {
      this.config = gConfig;
      callback();
    });
  }

  // Get lat/long of given or default address
  async getLatLong(callback)
  {
    this.latitude = 0;
    this.longitude = 0;

    var address = await this.config.getAddress() + ',' + await this.config.getCity() + ',' +
                  await this.config.getState() + ',' + await this.config.getZip();
    var url = mapboxGeocodeURL + encodeURIComponent(address) +
              mapboxAccessKeyURL + await this.config.getMapBoxKey();

    console.log('getLatLong url: ' + url);

    request({
      url: url,
      json: true
    }, (error, response, body) => {
      // TODO: Fleshout error handling
      if (error) {
        console.log('Unable to connect to GeoLocation Service');
      } else {
        this.place = body.features[0].place_name;
        this.latitude = body.features[0].geometry.coordinates[0];
        this.longitude = body.features[0].geometry.coordinates[1];

        console.log(`Place: ${this.place}`);
        console.log(`Latitude: ${this.latitude}`);
        console.log(`Longitude: ${this.longitude}`);

      }
      callback(error, this.latitude, this.longitude);
    });
  }
}

module.exports = {
  GeoLocation,
  getGeoLocationInstance
};
