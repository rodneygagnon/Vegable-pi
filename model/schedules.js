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
const Zones = require('./zones');

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const scheduleSchema = schema({
  id: String,          // Schedule UUID
  sid: Number,         // Zone ID
  title: String,
  start: String, // ISO8601
  end: String, // ISO8601
  color: String,
  textColor: String,
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

      // Get zones
      Zones.getZonesInstance((gZones) => {
        this.zones = gZones;
      });

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
        // If this is a repeating schedule, we have to create the appropriate number of
        // individual schedules within the range requested (end-start)
        var masterSchedule = await scheduleSchema.validate(JSON.parse(redisSchedules[i]));

        // Add the masterSchedule. If it is repeating, create and add the children for display during the date range given
        schedules.push(masterSchedule);

        // If not repeating, continue ...
        if (typeof masterSchedule.repeatDow === 'undefined' || masterSchedule.repeatDow === '7' /* none */)
          continue;

        // ... otherwise, create repeating schedules for the given timeframe
        var masterRepeatEnd;
        if (typeof masterSchedule.repeatEnd == 'undefined')
          masterRepeatEnd = new Date(masterSchedule.end);
        else
          masterRepeatEnd = new Date(masterSchedule.repeatEnd);

        // Find the follow on dates
        for (var j = 0; j < masterSchedule.repeatDow.length; j++) {
          var repeatDow = masterSchedule.repeatDow[j];

          log.debug(`getSchedules: Master Schedule (${JSON.stringify(masterSchedule)})`);

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
    } catch (err) {
      log.error("getSchedules Failed: " + err);
    }

    callback(schedules);
  }

// Update a schedule. Create if it doesn't exist. Delete if action=='delete'
  async updateSchedule(schedule, action, callback) {
    log.debug(`updateSchedule: (${JSON.stringify(schedule)})`);

    try {
      var validSchedule = await scheduleSchema.validate(schedule);
      var zone = await this.zones.getZone(validSchedule.sid);

      // Set colors based on zone
      validSchedule.color = zone.color;
      validSchedule.textColor = zone.textColor;

      let validStart = (new Date(validSchedule.start)).getTime() / 1000;
      let savedSchedule = null;

      // id is set if we are updating/deleting a schedule, go find it
      if (typeof schedule.id !== 'undefined' && schedule.id !== "") {
        var scheduleCnt = await db.zcount(dbKeys.dbSchedulesKey, '-inf', '+inf');
        log.debug(`updateSchedule(count): ${scheduleCnt}`);

        var cnt = 0, start = 0, end = 5;
        while (cnt < scheduleCnt && !savedSchedule) {
          var schedules = await db.zrangeAsync(dbKeys.dbSchedulesKey, start, end);

          for (var i = 0; i < schedules.length; i++) {
            var schedule = JSON.parse(schedules[i]);
            if (schedule.id === validSchedule.id) {
              savedSchedule = schedule;
              log.debug(`updateSchedule(found): del old schedule(${JSON.stringify(savedSchedule)})`);
              break;
            }
          }

          start = end;
          end += end;
          cnt += schedules.length;
        }
      }

      if (savedSchedule) {
        // Remove the job from schedule queue. We'll add back an updated job if necessary
        var job = await SchedulesQueue.getJob(savedSchedule.id);
        if (job)
          job.remove();

        var removeSchedule = JSON.stringify(savedSchedule);

        if (action === 'delete') { // DELETE a schedule
          log.debug(`updateSchedule(delete): del old schedule(${removeSchedule})`);
          await db.zremAsync(dbKeys.dbSchedulesKey, removeSchedule);

        } else { // UPDATE a schedule
          savedSchedule.sid = validSchedule.sid;
          savedSchedule.color = validSchedule.color;
          savedSchedule.textColor = validSchedule.textColor;
          savedSchedule.title = validSchedule.title;
          savedSchedule.start = validSchedule.start;
          savedSchedule.end = validSchedule.end;
          savedSchedule.repeatDow = validSchedule.repeatDow;
          savedSchedule.repeatEnd = validSchedule.repeatEnd;

          log.debug(`updateSchedule(update): add new schedule(${JSON.stringify(savedSchedule)})`);

          var zcnt = await db.zaddAsync(dbKeys.dbSchedulesKey, validStart, JSON.stringify(savedSchedule));
          if (zcnt > 0) {
            log.debug(`updateSchedule(update): del old schedule(${removeSchedule})`);

            await db.zremAsync(dbKeys.dbSchedulesKey, removeSchedule);
            this.scheduleJob(savedSchedule);
          }
        }

      // CREATE a new schedule
      } else {
        log.debug(`updateSchedule(create): validSchedule(${JSON.stringify(validSchedule)})`);

        // Assign a uuidv
        validSchedule.id = uuidv4();

        await db.zaddAsync(dbKeys.dbSchedulesKey, validStart, JSON.stringify(validSchedule));

        this.scheduleJob(validSchedule);
      }
    } catch (err) {
      log.error("updateSchedule Failed to save schedule: " + err);
    }

    callback();
  }

  async scheduleJob(schedule) {
    // Add event to the SchedulesQueue. Calculate when it should be processed next.
    var now = new Date();

    var repeatEnd, repeatOpts;
    if (typeof schedule.repeatDow === 'undefined' || schedule.repeatDow === '7' /* none */) {
      repeatOpts = {};
      repeatEnd = new Date(schedule.end);
    } else {
      var start = new Date(schedule.start);
      var dow = (Array.isArray(schedule.repeatDow) ? schedule.repeatDow.join(", ") : schedule.repeatDow);

      repeatOpts = `{ cron: '${start.getMinutes()} ${start.getHours()} * * ${dow}'}`;
      repeatEnd = new Date(schedule.repeatEnd);
    }

    // Calculate when to process this job
    var delay = repeatEnd.getTime() - now.getTime();
    if (delay < 0) {
      log.debug(`scheduleJob: nothing to do, job has expired(${repeatEnd.toLocaleString()})`);
      return;
    }

    log.debug(`ProcessQueue.add: (repeatOpts):${JSON.stringify(repeatOpts)}`);

    const job = await SchedulesQueue.add(schedule, { jobId: schedule.id, delay: delay, repeatOpts: repeatOpts, removeOnComplete: true });

    log.debug(`ProcessQueue.add: (job):${JSON.stringify(job)}`);
  }
}

module.exports = {
   Schedules,
   getSchedulesInstance
};
