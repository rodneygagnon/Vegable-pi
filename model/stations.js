/**
 * Stations Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
const {log} = require('../controllers/logger');

const Config = require('./config');

// OpenSprinker Controller
const OSPi = require("../controllers/ospi");

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const stationsSchema = schema({
  id: Number,
  name: String,
  description: String,
  flowrate: { type: Number, min: 0 }, // litres per minute
  status: Boolean,
  started: { type: Number, min: 0 } // Date/Time station swtiched on.
});

let StationsInstance;

const getStationsInstance = async (callback) => {
  if (StationsInstance) {
    callback(StationsInstance);
    return;
  }

  StationsInstance = await new Stations();
  log.debug("Stations Constructed! ");
  await StationsInstance.init(() => {
    log.debug("Stations Initialized! ");
    callback(StationsInstance);
  })
}

class Stations {
  constructor() {
    this.config = null;
  }

  async init(callback) {

    Config.getConfigInstance(async (gConfig) => {
      this.config = gConfig;

      OSPi.getOSPiInstance(async (gOSPi) => {
        this.ospi = gOSPi;

        var stationCount = await db.hlenAsync(dbKeys.dbStationsKey);

        log.debug(`Station Count(${dbKeys.dbStationsKey}): ` + stationCount);

        if (stationCount === 0) {
          var multi = db.multi();

          var numStations = await this.config.getStations();
          for (var i = 1; i <= numStations; i++) {
              var station = {id: i, name:'S0' + i, description: 'This is station S0' + i,
                             status: false, started: 0, flowrate: 0};

              await stationsSchema.validate(station);

              log.debug(`Adding Station(${i}): ` + JSON.stringify(station));

              multi.hset(dbKeys.dbStationsKey, station.id, JSON.stringify(station));
          }

          await multi.execAsync((error, results) => {
            if (error)
              log.error(error);
            else
              log.debug("multi.execAsync(): " + results)
          });
        }

        callback();
      });
    });
  }

  async getStations(callback) {
    var stations = [];

    var redisStations = await db.hvalsAsync(dbKeys.dbStationsKey);
    for (var i = 0; i < redisStations.length; i++)
      stations[i] = await stationsSchema.validate(JSON.parse(redisStations[i]));

    callback(stations);
  }

  async setStation(station, callback) {
    try {
      var inputStation = await stationsSchema.validate(station);
      var saveStation = JSON.parse(await db.hgetAsync(dbKeys.dbStationsKey, inputStation.id));

      log.debug(`setStation: inputStation(${JSON.stringify(inputStation)})`);

      saveStation.name = inputStation.name;
      saveStation.description = inputStation.description;
      saveStation.flowrate = inputStation.flowrate;

      let status = false, started = 0;
      if (typeof inputStation.status != 'undefined')
        status = inputStation.status;

      // Switch station on/off if status changed
      if (saveStation.status != status) {
        var start = new Date(Date.now());
        log.debug(`Station status: ${status} ${start.toString()}`);

        await this.ospi.switchStation(saveStation.id, status);
      }

      if (status)
        started = Date.now();

      saveStation.status = status;
      saveStation.started = started;

      log.debug(`setStation: saveStation(${JSON.stringify(saveStation)})`);

      await db.hsetAsync(dbKeys.dbStationsKey, saveStation.id, JSON.stringify(saveStation));

    } catch (err) {
      log.error("setStation Failed to save station: " + err);
    }

    callback();
  }

  async switchStation(sid, callback) {
    try {
      var station = JSON.parse(await db.hgetAsync(dbKeys.dbStationsKey, sid));

      // Switch the status
      station.status = !station.status;

      // Turn On/Off the station
      await this.ospi.switchStation(station.id, station.status);

      if (station.status)
        station.started = Date.now();
      else
        station.started = 0;

      // Save the status
      await db.hsetAsync(dbKeys.dbStationsKey, station.id, JSON.stringify(station));

      log.debug(`switchStation: station(${JSON.stringify(station)})`);
    } catch (err) {
      log.error("setStation Failed to switch station: " + err);
    }
    callback();
  }
}

module.exports = {
  StationsInstance,
  getStationsInstance
};
