
// var level = require('level')
// var db = level('./vdb', { valueEncoding: 'json' })

var bluebird = require("bluebird");
var redis = require('redis');

const dbKeys = {
  dbConfigKey: 'config',
  dbStationsKey: 'stations',
  dbProgramsKey: 'programs'
};

bluebird.promisifyAll(redis);

var db = redis.createClient()

db.on('error', function (err) {
  console.log('DB Error ' + err)
})

module.exports = {
  db,
  dbKeys
};
