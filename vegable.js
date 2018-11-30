/*
 * Vegable Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
const fs = require('fs');

// Logging
const {log} = require('./controllers/logger');

// Data Model
const Config = require("./model/config");
const Users = require("./model/users");
const Zones = require("./model/zones");
const Plantings = require("./model/plantings");

// Web Services Controllers
const GeoLocation = require("./controllers/geolocation");
const Weather = require("./controllers/weather");

// OpenSprinker Controller
const OSPi = require("./controllers/ospi");

var VegableInstance = null;

var gConfig;
var gZones;
var gUsers;
var gPlantings;
var gWeather;
var gOSPi;

const getVegableInstance = async (callback) => {
  if (VegableInstance) {
    callback(VegableInstance);
    return;
  }

  VegableInstance = await new Vegable();
  log.debug("Vegable Constructed!");
  await VegableInstance.init(() => {
    log.debug("Vegable Initialized!");
    callback(VegableInstance);
  })
}

class Vegable {
  constructor() {
    this.rpiRevision = 0;
    this.rpiVersion = 0;
  }

  async init(callback) {
    // Read the RPi System before initilizing OSPi
    await this.getRPiInformation();

    // Initialize Options
    Config.getConfigInstance((gConfig) => {
      this.config = gConfig;

      // Get users
      Users.getUsersInstance((gUsers) => {
        this.users = gUsers;
      });

      // Get zones
      Zones.getZonesInstance((gZones) => {
        this.zones = gZones;
        Plantings.getPlantingsInstance((gPlantings) => {
          this.plantings = gPlantings;
        });
      });

      callback();
    });
  }

  async validateUser(username, password, callback) {
    callback (null, await this.users.validateUser(username, password));
  }

  async getUser(email, callback) {
    callback(null, await this.users.getUser(email));
  }

  getRPiInformation() {
    // Get Device Info
    var obj = fs.readFileSync('/proc/cpuinfo', 'utf8');
    var lines = obj.split('\n');

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      if (line.startsWith('Revision'))
        this.rpiRevision = line.split(':')[1].trim();

      if (line.startsWith('Serial'))
          this.rpiSerial = line.split(':')[1].trim();
    }
    log.debug("RPI Info: Revision(", this.rpiRevision, ") Serial(", this.rpiSerial, ")");
  }
}

module.exports = {
  Vegable,
  getVegableInstance
};
