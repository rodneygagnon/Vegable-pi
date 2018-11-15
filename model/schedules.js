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
  repeatDow: Array,
  repeatEnd: String, // ISO8601
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

  async getSchedules(start, end, callback) {
    var schedules = [];
    var startRange = (new Date(start)).getTime() / 1000;
    var endRange = (new Date(end)).getTime() / 1000;

    console.log(`getSchedules: from ${startRange} to ${endRange}`);

    var redisSchedules
    try {
      redisSchedules = await db.zrangebyscoreAsync(dbKeys.dbSchedulesKey, startRange, endRange);

      console.log(`getSchedules: (${redisSchedules.length})`);

      for (var i = 0; i < redisSchedules.length; i++)
        schedules[i] = await scheduleSchema.validate(JSON.parse(redisSchedules[i]));

    } catch (err) {
      console.log("getSchedules Failed: " + err);
    }

    callback(schedules);
  }

// Update a schedule. Create if it doesn't exist. Delete if action=='delete'
  async updateSchedule(schedule, action, callback) {
    try {
      var validSchedule = await scheduleSchema.validate(schedule);
      let validStart = (new Date(validSchedule.start)).getTime() / 1000;

      var schedules = await db.zrangebyscoreAsync(dbKeys.dbSchedulesKey, validStart, validStart)

      let savedSchedule;
      for (var i = 0; i < schedules.length; i++) {
        var schedule = JSON.parse(schedules[i]);
        if (schedule.id === validSchedule.id) {
          savedSchedule = schedule;
          break;
        }
      }

      if (savedSchedule) {
        if (action === 'delete') {
          var removeSchedule = JSON.stringify(savedSchedule);
          console.log(`updateSchedule(delete): savedSchedule(${removeSchedule})`);
          await db.zremAsync(dbKeys.dbSchedulesKey, removeSchedule);

          // TODO: Remove job from bull queue
        } else {
          console.log(`updateSchedule(update): savedSchedule(${JSON.stringify(savedSchedule)})`);
          savedSchedule.sid = validSchedule.sid;
          savedSchedule.title = validSchedule.title;
          savedSchedule.start = validSchedule.start;
          savedSchedule.end = validSchedule.end;
          savedSchedule.repeatDow = validSchedule.repeatDow;
          savedSchedule.repeatEnd = validSchedule.repeatEnd;

          await db.zaddAsync(dbKeys.dbSchedulesKey, validStart, JSON.stringify(savedSchedule));
        }
      } else {
        console.log(`updateSchedule(create): validSchedule(${JSON.stringify(validSchedule)})`);

        // Assign a uuidv
        validSchedule.id = uuidv4();

        await db.zaddAsync(dbKeys.dbSchedulesKey, validStart, JSON.stringify(validSchedule));

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
