/**
 * Schedules Singleton
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
  log.debug("Schedules Constructed! ");
  await SchedulesInstance.init(() => {
   log.debug("Schedules Initialized! ");
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
        log.debug(`ProcessQueue.process: (job):${JSON.stringify(job)}`);
        done();
      });

      callback();
    });
  }

  async getSchedules(start, end, callback) {
    var schedules = [];
    var startRange = (new Date(start)).getTime() / 1000;
    var endRange = (new Date(end)).getTime() / 1000;

    log.debug(`getSchedules: from ${startRange} to ${endRange}`);

    var redisSchedules
    try {
      redisSchedules = await db.zrangebyscoreAsync(dbKeys.dbSchedulesKey, startRange, endRange);

      log.debug(`getSchedules: (${redisSchedules.length})`);

      for (var i = 0; i < redisSchedules.length; i++) {
        // If this is a repeating schedule, we have to create the appropriate number of individual
        // individual schedules within the range requested (end-start)
        var masterSchedule = await scheduleSchema.validate(JSON.parse(redisSchedules[i]));

        // Add the masterSchedule. If it is repeating, create and add the children for display during the date range given
        log.debug(`getSchedules: Master Schedule (${masterSchedule.start})`);
        schedules.push(masterSchedule);

        if (typeof masterSchedule.repeatDow != 'undefined' || masterSchedule.repeatDow != '7' /* none */) {
          // Repeating schedule
          var masterRepeatEnd;
          if (typeof masterSchedule.repeatEnd == 'undefined')
            masterRepeatEnd = new Date(masterSchedule.end);
          else
            masterRepeatEnd = new Date(masterSchedule.repeatEnd);

          // Find the follow on dates
          for (var j = 0; j < masterSchedule.repeatDow.length; j++) {
            var repeatDow = masterSchedule.repeatDow[j];

            // Clone th object and calculate the next day increment
            var nextSchedule = JSON.parse(JSON.stringify(masterSchedule));
            var nextStart = new Date(masterSchedule.start);
            var nextEnd = new Date(masterSchedule.end);
            var nextDay = (7 + repeatDow - nextStart.getDay()) % 7;

            log.debug(`getSchedules: Next Day: (${nextDay})`);

            nextStart.setDate(nextStart.getDate() + (nextDay != 0 ? nextDay : 7));
            nextEnd.setDate(nextEnd.getDate() + (nextDay != 0 ? nextDay : 7));

            while (nextStart <= masterRepeatEnd) {
              nextSchedule.start = nextStart;
              nextSchedule.end = nextEnd;

              log.debug(`getSchedules: Next Schedule: (${nextSchedule.start})`);
              schedules.push(nextSchedule);

              // Clone the object
              nextSchedule = JSON.parse(JSON.stringify(nextSchedule));
              nextStart = new Date(nextSchedule.start);
              nextEnd = new Date(nextSchedule.end);
              nextDay = (7 + repeatDow - nextStart.getDay()) % 7;

              log.debug(`getSchedules: Next Day: (${nextDay})`);

              nextStart.setDate(nextStart.getDate() + (nextDay != 0 ? nextDay : 7));
              nextEnd.setDate(nextEnd.getDate() + (nextDay != 0 ? nextDay : 7));
            }
          }
        }
      }
    } catch (err) {
      log.error("getSchedules Failed: " + err);
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
          log.debug(`updateSchedule(delete): savedSchedule(${removeSchedule})`);
          await db.zremAsync(dbKeys.dbSchedulesKey, removeSchedule);

          // TODO: Remove job from bull queue
        } else {
          log.debug(`updateSchedule(update): savedSchedule(${JSON.stringify(savedSchedule)})`);
          savedSchedule.sid = validSchedule.sid;
          savedSchedule.title = validSchedule.title;
          savedSchedule.start = validSchedule.start;
          savedSchedule.end = validSchedule.end;
          savedSchedule.repeatDow = validSchedule.repeatDow;
          savedSchedule.repeatEnd = validSchedule.repeatEnd;

          await db.zaddAsync(dbKeys.dbSchedulesKey, validStart, JSON.stringify(savedSchedule));
        }
      } else {
        log.debug(`updateSchedule(create): validSchedule(${JSON.stringify(validSchedule)})`);

        // Assign a uuidv
        validSchedule.id = uuidv4();

        await db.zaddAsync(dbKeys.dbSchedulesKey, validStart, JSON.stringify(validSchedule));

        // Add event to the SchedulesQueue
        const job = await SchedulesQueue.add(validSchedule, { jobId: validSchedule.id, removeOnComplete: true });
        log.debug(`ProcessQueue.add: (job):${JSON.stringify(job)}`);
      }
    } catch (err) {
      log.error("updateSchedule Failed to save schedule: " + err);
    }

    callback();
  }
}

module.exports = {
   Schedules,
   getSchedulesInstance
};
