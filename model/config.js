/**
 * Service Configuration Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const {log} = require('../controllers/logger');

const settings = require("../settings");
const GeoLocation = require('../controllers/geolocation')

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const configSchema = schema({
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

let ConfigInstance;

var defaultConfig = { address : settings.default_address,
                      city : settings.default_city,
                      state : settings.default_state,
                      zip : settings.default_zip,
                      lat : settings.default_lat,
                      long : settings.default_long,
                      mapboxKey : settings.default_mapbox_key,
                      darkskyKey : settings.default_darksky_key,
                      zones : settings.zones
                    };

const getConfigInstance = async (callback) => {
  if (ConfigInstance) {
    callback(ConfigInstance);
    return;
  }

  ConfigInstance = await new Config();
  log.debug("Config Constructed! ");
  await ConfigInstance.init(() => {
    log.debug("Config Initialized! ");
    callback(ConfigInstance);
  })
}

class Config {
  constructor() {
    this.geolocation = null;
  }

  async init(callback) {
    var hlen = await db.hlenAsync(dbKeys.dbConfigKey);
    if (hlen === 0) { // key does not exist, store the default options
      try {
        var result = await db.hmsetAsync(dbKeys.dbConfigKey, defaultConfig);
        log.debug("Initialized Config: " + result);
      } catch (error) {
        log.error(error);
      }
    }
    callback();
  }

  async getConfig(callback) {
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

  // Get/Set address
  async getAddress() {
    return await this.getSetHashKey('address', defaultConfig.address);
  }
  async setAddress(address) {
    return await this.setHashKey('address', address);
  }

  // Get/Set city
  async getCity() {
    return await this.getSetHashKey('city', defaultConfig.city);
  }
  async setCity(city) {
    return await this.setHashKey('city', city);
  }

  // Get/Set state
  async getState() {
    return await this.getSetHashKey('state', defaultConfig.state);
  }
  async setState(state) {
    return await this.setHashKey('state', state);
  }

  // Get/Set zip
  async getZip() {
    return await this.getSetHashKey('zip', defaultConfig.zip);
  }
  async setZip(zip) {
    return await this.setHashKey('zip', zip);
  }

  // Get/Set lat
  async getLat() {
    return await this.getSetHashKey('lat', defaultConfig.lat);
  }
  async setLat(lat) {
    return await this.setHashKey('lat', lat);
  }

  // Get/Set long
  async getLong() {
    return await this.getSetHashKey('long', defaultConfig.long);
  }
  async setLong(long) {
    return await this.setHashKey('long', long);
  }

  getMapBoxKey() {
    return this.getSetHashKey('mapboxKey', defaultConfig.mapboxKey);
  }

  getDarkSkyKey() {
    return this.getSetHashKey('darkskyKey', defaultConfig.darkskyKey);
  }

  getIftttUrl() {
    return this.getSetHashKey('iftttUrl', defaultConfig.iftttUrl);
  }

  getZones() {
    return this.getSetHashKey('zones', defaultConfig.zones);
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
  Config,
  getConfigInstance
};
