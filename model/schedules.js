/**
 * Schedules Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
const uuidv4 = require('uuid/v4');
const Queue = require("bull");

const Config = require('./config');

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const scheduleSchema = schema({
  id: String,          // Schedule UUID
  sid: Number,         // Station ID
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

const SchedulesQueue = new Queue('SchedulesQueue');

let SchedulesInstance;

const getSchedulesInstance = async (callback) => {
  if (SchedulesInstance) {
   callback(SchedulesInstance);
   return;
  }

  SchedulesInstance = await new Schedules();
  console.log("Schedules Constructed! ");
  await SchedulesInstance.init(() => {
   console.log("Schedules Initialized! ");
   callback(SchedulesInstance);
  })
}

class Schedules {
  constructor() {
    this.config = null;
  }

  async init(callback) {
    Config.getConfigInstance(async (gConfig) => {
      this.config = gConfig;

      // Set Queue processor
      SchedulesQueue.process(async (job, done) => {
        console.log(`ProcessQueue.process: (job):${JSON.stringify(job)}`);
        done();
      });

      callback();
    });
  }

  async getSchedules(callback) {
    var schedules = [];

    var redisSchedules = await db.hvalsAsync(dbKeys.dbSchedulesKey);

    console.log(`getSchedules: (${redisSchedules.length})`);

    for (var i = 0; i < redisSchedules.length; i++)
      schedules[i] = await scheduleSchema.validate(JSON.parse(redisSchedules[i]));

    callback(schedules);
  }

// Update a schedule. Create if it doesn't exist. Delete if action=='delete'
  async updateSchedule(schedule, action, callback) {
    try {
      var validSchedule = await scheduleSchema.validate(schedule);
      var savedSchedule = JSON.parse(await db.hgetAsync(dbKeys.dbSchedulesKey, validSchedule.id));

      if (savedSchedule) {
        if (action === 'delete') {
          console.log(`updateSchedule(delete): savedSchedule(${JSON.stringify(savedSchedule)})`);
          await db.hdelAsync(dbKeys.dbSchedulesKey, savedSchedule.id);

          // TODO: Remove job from bull queue
        } else {
          console.log(`updateSchedule(update): savedSchedule(${JSON.stringify(savedSchedule)})`);
          savedSchedule.sid = validSchedule.sid;
          savedSchedule.title = validSchedule.title;
          savedSchedule.start = validSchedule.start;
          savedSchedule.end = validSchedule.end;

          await db.hsetAsync(dbKeys.dbSchedulesKey, savedSchedule.id, JSON.stringify(savedSchedule));
        }
      } else {
        console.log(`updateSchedule(create): validSchedule(${JSON.stringify(validSchedule)})`);

        // Assign a uuidv
        validSchedule.id = uuidv4();

        await db.hsetAsync(dbKeys.dbSchedulesKey, validSchedule.id, JSON.stringify(validSchedule));

        // Add event to the SchedulesQueue
        const job = await SchedulesQueue.add(validSchedule, { jobId: validSchedule.id, removeOnComplete: true });
        console.log(`ProcessQueue.add: (job):${JSON.stringify(job)}`);
      }
    } catch (err) {
      console.log("updateSchedule Failed to save schedule: " + err);
    }

    callback();
  }
}

module.exports = {
   Schedules,
   getSchedulesInstance
};
