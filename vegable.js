/*
 * Vegable Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
const {log} = require('./controllers/logger');

// Load Env Settings

const Settings = require("./settings");

var fs = require('fs');

// Data Model
Config = require("./model/config");
Zones = require("./model/zones");
Plantings = require("./model/plantings");

// Web Services Controllers
const GeoLocation = require("./controllers/geolocation");
const Weather = require("./controllers/weather");

// OpenSprinker Controller
const OSPi = require("./controllers/ospi");

let VegableInstance;

var gConfig;
var gZones;
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

      //Get weather
      Weather.getWeatherInstance((gWeather) => {
        var temperature;
        gWeather.getTemperature((error, temperature) => {
          if (error)
            log.error(error);
          else
            log.debug(`Current Temperature: ${temperature}`);
        });
      });

      // Get zones
      Zones.getZonesInstance((gZones) => {
        Plantings.getPlantingsInstance((gPlantings) => {
        });
      });

      callback();
    });
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
