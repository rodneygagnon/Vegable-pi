/**
 * Stats Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const {log} = require('../controllers/logger');

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const statsSchema = schema({
  started: { type: Number, min: 0 },        // ISO8601 - Irrigation started
  stopped: { type: Number, min: 0 },        // ISO8601 - Irrigation stopped
  amount: { type: Number, min: 0 },         // gallons
  fertilized: Boolean
});

class Stats {
  constructor() {
    if (!Stats.StatsInstance) {
      Stats.StatsInstance = this;
    }
    return Stats.StatsInstance;
  }

  async saveStats(zid, started, stopped, amount, fertilized) {
    try {
      var validStats = await statsSchema.validate({ started: started, stopped: stopped,
                                                    amount: amount, fertilized: fertilized
                                                  });

      await db.zaddAsync(dbKeys.dbStatsKey + zid, started, JSON.stringify(validStats));

    } catch (err) {
      log.error(`saveStats Failed to save statistics: ${JSON.stringify(err)}`);
    }
  }

  async getStats(zid, start, end) {
    var stats = [];

    var redisStats = await db.zrangebyscoreAsync(dbKeys.dbStatsKey + zid, start, end);
    for (var i = 0; i < redisStats.length; i++)
      stats.push(await statsSchema.validate(JSON.parse(redisStats[i])));

    return(stats);
  }
}

const StatsInstance = new Stats();
Object.freeze(StatsInstance);

module.exports = {
  StatsInstance
}
