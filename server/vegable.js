/*
 * Vegable Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */

// Data Models
const Settings = require("./models/settings");
const Users = require("./models/users");
const Events = require("./models/events");

// Controllers
const {log} = require('./controllers/logger');
const Weather = require("./controllers/weather");

var VegableInstance = null;

const getVegableInstance = async (callback) => {
  if (VegableInstance) {
    callback(VegableInstance);
    return;
  }

  VegableInstance = await new Vegable();
  await VegableInstance.init(() => {
    log.debug("*** Vegable Initialized!");
    callback(VegableInstance);
  })
}

class Vegable {
  constructor() {
    this.rpiRevision = 0;
    this.rpiVersion = 0;
  }

  // Initialize the Vegable service
  async init(callback) {

    Settings.getSettingsInstance((settings) => {
      this.config = settings;

      // Manage Users
      Users.getUsersInstance((users) => {
        this.users = users;
      });

      // Manage Weather
      Weather.getWeatherInstance((weather) => {
        this.weather = weather;
      });

      // Manage Events
      Events.getEventsInstance((events) => {
        this.events = events;
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
}

module.exports = {
  Vegable,
  getVegableInstance
};
