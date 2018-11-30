/**
 * Service Configuration Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const {log} = require('../controllers/logger');

const settings = require("../settings");

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const configSchema = schema({
  address: String,
  city: String,
  state: String,
  zip: String,
  mapboxKey: String,
  darkskyKey: String,
  zones: { type: Number, min: 0 }
});

let ConfigInstance;

var defaultConfig = { address : settings.default_address,
                      city : settings.default_city,
                      state : settings.default_state,
                      zip : settings.default_zip,
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
