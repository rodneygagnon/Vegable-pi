/**
 * Database (redis)
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
const {log} = require('../controllers/logger');

var bluebird = require("bluebird");
var redis = require('redis');

const dbKeys = {
  dbConfigKey: 'config',
  dbZonesKey: 'zones',
  dbSchedulesKey: 'schedules',
  dbPlantingsKey: 'plantings'
};

bluebird.promisifyAll(redis);

var db = redis.createClient()

db.on('error', function (err) {
  log.error('DB Error ' + err)
})

module.exports = {
  db,
  dbKeys
};
