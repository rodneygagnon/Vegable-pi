// Load Env Settings
const Settings = require("./settings");

var fs = require('fs');

// Data Model
Config = require("./model/config");
Stations = require("./model/stations");
Programs = require("./model/programs");

// Web Services Controllers
const GeoLocation = require("./controllers/geolocation");
const Weather = require("./controllers/weather");

// OpenSprinker Controller
const OSPi = require("./controllers/ospi");

let VegableInstance;

var gConfig;
var gStations;
var gPrograms;
var gWeather;
var gOSPi;

const getVegableInstance = async (callback) => {
  if (VegableInstance) {
    callback(VegableInstance);
    return;
  }

  VegableInstance = await new Vegable();
  console.log("Vegable Constructed! ");
  await VegableInstance.init(() => {
    console.log("Vegable Initialized! ");
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
            console.error(error);
          else
            console.log(`Current Temperature: ${temperature}`);
        });
      });

      // Get stations
      Stations.getStationsInstance((gStations) => {
        Programs.getProgramsInstance((gPrograms) => {
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
    console.log("RPI Info: Revision(", this.rpiRevision, ") Serial(", this.rpiSerial, ")");
  }

}

module.exports = {
  Vegable,
  getVegableInstance
};