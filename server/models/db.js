/**
 * Database (redis)
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */

const bluebird = require('bluebird');
const redis = require('redis');

const { log } = require('../controllers/logger');

const dbKeys = {
  dbConfigKey: 'config',
  dbZonesKey: 'zones',
  dbStatsKey: 'stats_', // stats by zone => statis_<zone id>
  dbUsersKey: 'users',
  dbCropsKey: 'crops',
  dbEventsKey: 'events',
  dbPlantingsKey: 'plantings',
  dbWeatherKey: 'weather',
  dbForecastKey: 'forecast',
  dbETrKey: 'etr'
};

bluebird.promisifyAll(redis);

const db = redis.createClient({ host: 'redis' });

db.on('error', (err) => {
  log.error(`DB Error: ${err}`);
});

module.exports = {
  db,
  dbKeys
};
