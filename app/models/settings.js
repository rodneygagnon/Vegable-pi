/**
 * Service Configuration Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const {log} = require('../controllers/logger');

const config = require("../../config/config");
const GeoLocation = require('../controllers/geolocation')

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const settingsSchema = schema({
  address: String,
  city: String,
  state: String,
  zip: String,
  lat: Number,
  long: Number,
  mapboxKey: String,
  darkskyKey: String,
  zones: { type: Number, min: 0 }
});

let SettingsInstance;

var defaultSettings = { address : config.default_address,
                        city : config.default_city,
                        state : config.default_state,
                        zip : config.default_zip,
                        lat : config.default_lat,
                        long : config.default_long,
                        mapboxKey : config.default_mapbox_key,
                        darkskyKey : config.default_darksky_key,
                        zones : config.zones
                      };

const getSettingsInstance = async (callback) => {
  if (SettingsInstance) {
    callback(SettingsInstance);
    return;
  }

  SettingsInstance = await new Settings();
  log.debug("Settings Constructed! ");
  await SettingsInstance.init(() => {
    log.debug("Settings Initialized! ");
    callback(SettingsInstance);
  })
}

class Settings {
  constructor() {
    this.geolocation = null;
  }

  async init(callback) {
    var hlen = await db.hlenAsync(dbKeys.dbConfigKey);
    if (hlen === 0) { // key does not exist, store the default options
      try {
        var result = await db.hmsetAsync(dbKeys.dbConfigKey, defaultSettings);
        log.debug("Initialized Settings: " + result);
      } catch (error) {
        log.error(error);
      }
    }
    callback();
  }

  async getSettings(callback) {
    var config = await configSchema.validate(await db.hgetallAsync(dbKeys.dbConfigKey));

    callback(config);
  }

  async setLocation(address, city, state, zip) {
    await this.setAddress(address);
    await this.setCity(city);
    await this.setState(state);
    await this.setZip(zip);

    // Get/Set Lat/Long
    GeoLocation.getGeoLocationInstance(await this.getMapBoxKey(), (gGeoLocation) => {
      gGeoLocation.getLatLong(address, city, state, zip, (error, latitude, longitude) => {
        this.setLat(latitude);
        this.setLong(longitude);
      });
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

  getIftttUrl() {
    return this.getSetHashKey('iftttUrl', defaultSettings.iftttUrl);
  }

  getZones() {
    return this.getSetHashKey('zones', defaultSettings.zones);
  }

  // get value at hashKey, or set and return default
  async getSetHashKey(hashKey, defaultValue) {
    try {
      var value = await db.hgetAsync(dbKeys.dbConfigKey, hashKey);
      if (value === null) {
        var result = await db.hsetAsync(dbKeys.dbConfigKey, hashKey,
                                        defaultValue);
        value = defaultValue;
      }
      return value;
    } catch (error) {
        log.error(error);
    }
  }

  async setHashKey(hashKey, value) {
    try {
        if (value)
          await db.hsetAsync(dbKeys.dbConfigKey, hashKey, value);
        else
          log.debug(`setHashKey: Undefined value for ${hashKey}`);
    } catch (error) {
        log.error(error);
    }
  }
}

module.exports = {
  Settings,
  getSettingsInstance
};
