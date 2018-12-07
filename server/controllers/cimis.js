/**
 * California Irrigation Management Information System (CIMIS)
 *
 * CIMIS Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const {log} = require('./logger');

const request = require('request');

const Settings = require('../models/settings');

const cimisURL = 'http://et.water.ca.gov/api/data?appKey=';

let CimisInstance;

const getCimisInstance = async (callback) => {
  if (CimisInstance) {
    callback(CimisInstance);
    return;
  }

  CimisInstance = await new Cimis();
  log.debug("Cimis Constructed! ");
  CimisInstance.init(() => {
    log.debug("Cimis Initialized! ");
    callback(CimisInstance);
  });
}

class Cimis {
  constructor() {
    this.config = null;
  }

  async init(callback) {
    var gSettings;

    Settings.getSettingsInstance((gSettings) => {
      this.config = gSettings;

      // Test CIMIS API

      // Get yesterday's date
      var d = new Date();
      d.setDate(d.getDate() - 1);

      log.debug(`CIMIS Date: ${d}`);

      this.getConditions(d, (error, conditions) => {
        log.debug(`CIMIS Conditions: ${JSON.stringify(conditions)}`);
      });

      callback();
    });
  }

  // Get Conditions
  async getConditions(date, callback)
  {
    var targetDate = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();

    var url = cimisURL + await this.config.getCimisKey() + '&targets=' + await this.config.getZip() +
              '&startDate=' + targetDate + '&endDate=' + targetDate;

    log.debug(`CIMIS URL: ${url}`);

    request({
      url: url,
      json: true
    }, (error, response, body) => {
      // TODO: Fleshout error handling
      if (error)
        log.error('Unable to connect to CIMIS');

      callback(error, body);
    });
  }
}

module.exports = {
  Cimis,
  getCimisInstance
};
