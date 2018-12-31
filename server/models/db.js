/**
 * Database (redis)
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const {log} = require('../controllers/logger');

var bluebird = require("bluebird");
var redis = require('redis');

const dbKeys = {
  dbConfigKey: 'config',
  dbZonesKey: 'zones',
  dbStatsKey: 'stats_',   // stats by zone => statis_<zone id>
  dbUsersKey: 'users',
  dbCropsKey: 'crops',
  dbEventsKey: 'events',
  dbPlantingsKey: 'plantings',
  dbWeatherKey: 'weather',
  dbETrKey: 'etr'
};

bluebird.promisifyAll(redis);

var db = redis.createClient({host: 'redis'});

db.on('error', function (err) {
  log.error('DB Error ' + err)
})

module.exports = {
  db,
  dbKeys
};
