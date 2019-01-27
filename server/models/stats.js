/**
 * @file Statistics Singleton
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const Schema = require('schm');

const { log } = require('../controllers/logger');

const { db } = require('./db');
const { dbKeys } = require('./db');

const statsSchema = Schema({
  zid: Number, // Zone ID
  started: { type: Number, min: 0 }, // ISO8601 - Irrigation started
  stopped: { type: Number, min: 0 }, // ISO8601 - Irrigation stopped
  amount: { type: Number, min: 0 }, // gallons
  fertilizer: String, // NPK values
});

/**
 * A singleton class to handle stats
 * @class
 */
class Stats {
  constructor() {
    if (!Stats.StatsInstance) {
      Stats.StatsInstance = this;
    }
    return Stats.StatsInstance;
  }

  async saveStats(zid, started, stopped, amount, fertilizer) {
    try {
      const validStats = await statsSchema.validate({
        zid,
        started,
        stopped,
        amount,
        fertilizer,
      });

      const scoreDate = new Date(started);
      const score = `${scoreDate.getFullYear()}`
                  + `${('0' + scoreDate.getMonth()).slice(-2)}`
                  + `${('0' + scoreDate.getDate()).slice(-2)}`;

      await db.zaddAsync(dbKeys.dbStatsKey, score, JSON.stringify(validStats));
    } catch (err) {
      log.error(`saveStats Failed to save statistics: ${JSON.stringify(err)}`);
    }
  }

  async getStats(zid, start, end) {
    const stats = [];
    const startDate = new Date(Number(start));
    const startScore = `${startDate.getFullYear()}`
                + `${('0' + startDate.getMonth()).slice(-2)}`
                + `${('0' + startDate.getDate()).slice(-2)}`;
    const endDate = new Date(Number(end));
    const endScore = `${endDate.getFullYear()}`
                + `${('0' + endDate.getMonth()).slice(-2)}`
                + `${('0' + endDate.getDate()).slice(-2)}`;

    log.error(`getStats(${zid}) from ${startScore} to ${endScore}`);

    const redisStats = await db.zrangebyscoreAsync(dbKeys.dbStatsKey, startScore, endScore);

    for (let i = 0; i < redisStats.length; i++) {
      const stat = await statsSchema.validate(JSON.parse(redisStats[i]));

      // Only return stats for a particular zone if requested
      if (typeof zid === 'undefined' || stat.zid == zid) {
        log.error(`getStats(${zid}) found ${redisStats[i]}`);
        stats.push(stat);
      }
    }

    log.error(`getStats(${zid}) returning ${stats.length} stats record(s)`);

    return (stats);
  }

  async clearStats() {
    await db.delAsync(dbKeys.dbStatsKey);
  }
}

const StatsInstance = new Stats();
Object.freeze(StatsInstance);

module.exports = {
  StatsInstance,
};
