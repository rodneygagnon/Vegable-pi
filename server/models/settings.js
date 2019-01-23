/**
 * @file Settings Model
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const request = require('request');
const Schema = require('schm');

const { log } = require('../controllers/logger');

const config = require('../../config/config');

const { CropsInstance } = require('./crops');
const { ETrInstance } = require('./etr');
const { db } = require('./db');
const { dbKeys } = require('./db');

const mapboxGeocodeURL = 'https://api.mapbox.com/geocoding/v5/mapbox.places/';
const mapboxAccessKeyURL = '.json?access_token=';

const settingsSchema = Schema({
  address: String,
  city: String,
  state: String,
  zip: String,
  lat: Number,
  long: Number,
  etzone: Number,
  practice: Number,
  vegable_time: String,
  mapboxKey: String,
  darkskyKey: String,
  zones: { type: Number, min: 0 },
  cimisKey: String
});

const defaultSettings = {
  address: config.default_address,
  city: config.default_city,
  state: config.default_state,
  zip: config.default_zip,
  lat: config.default_lat,
  long: config.default_long,
  etzone: config.default_etzone,
  practice: config.default_practice,
  vegable_time: config.default_vegable_time,
  mapboxKey: config.default_mapbox_key,
  darkskyKey: config.default_darksky_key,
  zones: config.zones,
  cimisKey: config.cimis_key
};

// Practice Types
const Practices = {
  Sustainable: 0,
  Organic: 1,
  Biodynamic: 2
};
Object.freeze(Practices);

/**
 * A singleton class to get and set system settings
 * @class
 */
class Settings {
  constructor() {
    if (!Settings.SettingsInstance) {
      Settings.init();

      Settings.SettingsInstance = this;
    }
    return Settings.SettingsInstance;
  }

  /**
   * Initialize the settings
   *
   * Initialize settings to the defaults
   */
  static async init() {
    const hlen = await db.hlenAsync(dbKeys.dbConfigKey);
    if (hlen === 0) { // key does not exist, store the default options
      try {
        const result = await db.hmsetAsync(dbKeys.dbConfigKey, defaultSettings);
        log.debug(`Initialized Settings: ${result}`);
      } catch (error) {
        log.error(error);
      }
    }
    log.debug('*** Settings Initialized!');
  }

  async getSettings(callback) {
    callback(await settingsSchema.validate(await db.hgetallAsync(dbKeys.dbConfigKey)));
  }

  async getETrs(callback) {
    await ETrInstance.getETrs((etrs) => {
      callback(etrs);
    });
  }

  // Get lat/long of given location
  async getLatLong(address, city, state, zip, callback) {
    let latitude = 0;
    let longitude = 0;

    const location = encodeURIComponent(`${address},${city},${state},${zip}`);
    const url = mapboxGeocodeURL + location + mapboxAccessKeyURL
                + defaultSettings.mapboxKey;

    request({
      url: url,
      json: true
    }, (error, response, body) => {
      // TODO: Fleshout error handling
      if (error) {
        log.error('Unable to connect to GeoLocation Service');
      } else {
        latitude = body.features[0].geometry.coordinates[0];
        longitude = body.features[0].geometry.coordinates[1];
      }
      callback(error, latitude, longitude);
    });
  }

  async setLocation(address, city, state, zip, etzone) {
    await this.setAddress(address);
    await this.setCity(city);
    await this.setState(state);
    await this.setZip(zip);
    await this.setETZone(etzone);

    // Get/Set Lat/Long
    this.getLatLong(address, city, state, zip, (error, latitude, longitude) => {
      this.setLat(latitude);
      this.setLong(longitude);
    });
  }

  // Return default user data
  getDefaultUser() { return config.default_username; }

  getDefaultEmail() { return config.default_email; }

  getDefaultPassword() { return config.default_password; }

  // Get/Set address
  async getAddress() {
    return await this.getSetHashKey('address', defaultSettings.address);
  }
  async setAddress(address) {
    return await this.setHashKey('address', address);
  }

  // Get/Set city
  async getCity() {
    return await this.getSetHashKey('city', defaultSettings.city);
  }
  async setCity(city) {
    return await this.setHashKey('city', city);
  }

  // Get/Set state
  async getState() {
    return await this.getSetHashKey('state', defaultSettings.state);
  }
  async setState(state) {
    return await this.setHashKey('state', state);
  }

  // Get/Set zip
  async getZip() {
    return await this.getSetHashKey('zip', defaultSettings.zip);
  }
  async setZip(zip) {
    return await this.setHashKey('zip', zip);
  }

  // Get/Set etzone
  async getETZone() {
    return await this.getSetHashKey('etzone', defaultSettings.etzone);
  }
  async setETZone(etzone) {
    return await this.setHashKey('etzone', etzone);
  }

  // Get/Set practice
  async getPractice() {
    return await this.getSetHashKey('practice', defaultSettings.practice);
  }
  async setPractice(practice) {
    return await this.setHashKey('practice', practice);
  }

  // Get/Set vegable_time
  async getVegableTime() {
    return await this.getSetHashKey('vegable_time', defaultSettings.vegable_time);
  }
  async setVegableTime(vegable_time) {
    return await this.setHashKey('vegable_time', vegable_time);
  }

  // Get/Set lat
  async getLat() {
    return await this.getSetHashKey('lat', defaultSettings.lat);
  }
  async setLat(lat) {
    return await this.setHashKey('lat', lat);
  }

  // Get/Set long
  async getLong() {
    return await this.getSetHashKey('long', defaultSettings.long);
  }
  async setLong(long) {
    return await this.setHashKey('long', long);
  }

  getMapBoxKey() {
    return this.getSetHashKey('mapboxKey', defaultSettings.mapboxKey);
  }

  getDarkSkyKey() {
    return this.getSetHashKey('darkskyKey', defaultSettings.darkskyKey);
  }

  getCimisKey() {
    return this.getSetHashKey('cimisKey', defaultSettings.cimisKey);
  }

  getZones() {
    return this.getSetHashKey('zones', defaultSettings.zones);
  }

  // get value at hashKey, or set and return default
  async getSetHashKey(hashKey, defaultValue) {
    try {
      let value = await db.hgetAsync(dbKeys.dbConfigKey, hashKey);
      if (value === null) {
        await db.hsetAsync(dbKeys.dbConfigKey, hashKey, defaultValue);
        value = defaultValue;
      }
      return value;
    } catch (error) {
        log.error(error);
    }
    return null;
  }

  async setHashKey(hashKey, value) {
    try {
        if (typeof value !== 'undefined') {
          await db.hsetAsync(dbKeys.dbConfigKey, hashKey, value);
        } else {
          log.error(`setHashKey: Undefined value for ${hashKey}`);
        }
    } catch (error) {
        log.error(error);
    }
  }
}

const SettingsInstance = new Settings();
Object.freeze(SettingsInstance);

module.exports = {
  SettingsInstance
};
