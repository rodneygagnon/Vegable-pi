/**
 * Plantings Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
const {log} = require('../controllers/logger');

const uuidv4 = require('uuid/v4');
const Queue = require("bull");

const Config = require('./config');

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const plantingSchema = schema({
  id: String,          // Planting UUID
  sid: Number,         // Zone ID
  title: String,
  start: String, // ISO8601
  end: String, // ISO8601
  operations: Array     // List of things to do
});

const OPS = {
  irrgation: 0,
  fertigation: 1
}
Object.freeze(OPS);

const operationSchema = schema({
  type: Number,         // OPS
  amount: Number        // Liters
});

const PlantingsQueue = new Queue('PlantingsQueue');

let PlantingsInstance;

const getPlantingsInstance = async (callback) => {
  if (PlantingsInstance) {
   callback(PlantingsInstance);
   return;
  }

  PlantingsInstance = await new Plantings();
  log.debug("Plantings Constructed! ");
  await PlantingsInstance.init(() => {
   log.debug("Plantings Initialized! ");
   callback(PlantingsInstance);
  })
}

class Plantings {
  constructor() {
    this.config = null;
  }

  async init(callback) {
    Config.getConfigInstance(async (gConfig) => {
      this.config = gConfig;

      // Set Queue processor
      PlantingsQueue.process(async (job, done) => {
        log.debug(`ProcessQueue.process: (job):${JSON.stringify(job)}`);
        done();
      });

      callback();
    });
  }

  async getPlantings(callback) {
    var plantings = [];

    var redisPlantings = await db.hvalsAsync(dbKeys.dbPlantingsKey);

    log.debug(`getPlantings: (${redisPlantings.length})`);

    for (var i = 0; i < redisPlantings.length; i++)
      plantings[i] = await plantingSchema.validate(JSON.parse(redisPlantings[i]));

    callback(plantings);
  }

// Update a planting. Create if it doesn't exist. Delete if action=='delete'
  async updatePlanting(planting, action, callback) {
    try {
      var validPlanting = await plantingSchema.validate(planting);
      var savedPlanting = JSON.parse(await db.hgetAsync(dbKeys.dbPlantingsKey, validPlanting.id));

      if (savedPlanting) {
        if (action === 'delete') {
          log.debug(`updatePlanting(delete): savedPlanting(${JSON.stringify(savedPlanting)})`);
          await db.hdelAsync(dbKeys.dbPlantingsKey, savedPlanting.id);

          // TODO: Remove job from bull queue
        } else {
          log.debug(`updatePlanting(update): savedPlanting(${JSON.stringify(savedPlanting)})`);
          savedPlanting.sid = validPlanting.sid;
          savedPlanting.title = validPlanting.title;
          savedPlanting.start = validPlanting.start;
          savedPlanting.end = validPlanting.end;

          await db.hsetAsync(dbKeys.dbPlantingsKey, savedPlanting.id, JSON.stringify(savedPlanting));
        }
      } else {
        log.debug(`updatePlanting(create): validPlanting(${JSON.stringify(validPlanting)})`);

        // Assign a uuidv
        validPlanting.id = uuidv4();

        await db.hsetAsync(dbKeys.dbPlantingsKey, validPlanting.id, JSON.stringify(validPlanting));

        // Add event to the PlantingsQueue
        const job = await PlantingsQueue.add(validPlanting, { jobId: validPlanting.id, removeOnComplete: true });
        log.debug(`ProcessQueue.add: (job):${JSON.stringify(job)}`);
      }
    } catch (err) {
      log.error("updatePlanting Failed to save planting: " + err);
    }

    callback();
  }
}

module.exports = {
   Plantings,
   getPlantingsInstance
};
