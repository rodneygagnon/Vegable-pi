/**
 * Plantings Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const {log} = require('../controllers/logger');

const uuidv4 = require('uuid/v4');
const Queue = require("bull");

const Settings = require('./settings');

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const plantingSchema = schema({
  id: String,       // Planting UUID
  sid: Number,      // Zone ID
  title: String,
  date: String,     // ISO8601
  cids: Array      // Crop Ids
});

var PlantingsQueue;

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
    Settings.getSettingsInstance(async (gSettings) => {
      this.config = gSettings;

      try {
        PlantingsQueue = new Queue('PlantingsQueue', {redis: {host: 'redis'}});

        // Set Queue processor
        PlantingsQueue.process(async (job, done) => {
          this.processJob(job, done);
        });
      } catch (err) {
        log.error("Failed to create queue: ", + err);
      }

      // Process the ETc every morning at 4:15am PT
      PlantingsQueue.add({task: "Process ETc!"}, { repeatOpts: { cron: '15 4 * * *' } });

      callback();
    });
  }

  // Calculate the ETc for all of the crops associated with each planting
  async processJob(job, done) {
    // // Get yesterday's date
    // var d = new Date();
    // d.setDate(d.getDate() - 1);
    //
    // var dateString = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    //
    // this.getCimisConditions(dateString, async (error, conditions) => {
    //   // Add weather entry to Database
    //   var dateScore = d.getTime() / 1000;
    //   var cimisRecord = conditions.Data.Providers[0].Records[0];
    //   var weather = await weatherSchema.validate({ date: cimisRecord.Date,
    //                                                eto: cimisRecord.DayAsceEto.Value,
    //                                                solar: cimisRecord.DaySolRadAvg.Value,
    //                                                wind: cimisRecord.DayWindSpdAvg.Value });
    //
    //   var zcnt = await db.zaddAsync(dbKeys.dbWeatherKey, dateScore, JSON.stringify(weather));
    //   if (zcnt > 0) {
    //     log.debug(`processJob: CIMIS conditions (${dateScore}) : ${JSON.stringify(weather)}`);
    //   }
    // });

    done();
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
