/**
 * Events Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const uuidv4 = require('uuid/v4');
const Queue = require("bull");

const {log} = require('../controllers/logger');

const {db} = require("./db");
const {dbKeys} = require("./db");

const {ZonesInstance} = require('./zones');

const schema = require("schm");
const eventSchema = schema({
  id: String,                     // Event UUID
  sid: Number,                    // Zone ID
  title: String,
  start: String,                  // ISO8601
  amt: { type: Number, min: 0 },  // inches of water to apply
  fertilize: Boolean,             // fertigate?
  color: String,
  textColor: String,
  repeatDow: Array,
  repeatEnd: String               // ISO8601
});

const gpm_cfs = 448.83;
const sqft_acre = 43560;

// Bull/Redis Jobs Queue
var EventsQueue;

class Events {
  constructor() {
    if (!Events.EventsInstance) {
      Events.init();

      Events.EventsInstance = this;
    }
    return Events.EventsInstance;
  }

  static async init() {
    try {
    	EventsQueue = new Queue('EventsQueue', {redis: {host: 'redis'}});

      // Set Queue processor
      EventsQueue.process(async (job, done) => {
        EventsInstance.processJob(job, done);
      });
    } catch (err) {
      log.error("Failed to create EVENTS queue: ", + err);
    }
    log.debug(`*** Events Initialized!`);
  }

  async getEvents(start, end, callback) {
    var events = [];
    var startRange = (new Date(start)).getTime() / 1000;
    var endRange = (new Date(end)).getTime() / 1000;

    log.debug(`getEvents: from ${startRange} to ${endRange}`);

    var redisEvents
    try {
      redisEvents = await db.zrangebyscoreAsync(dbKeys.dbEventsKey, startRange, endRange);

      log.debug(`getEvents: (${redisEvents.length})`);

      for (var i = 0; i < redisEvents.length; i++) {
        // If this is a repeating event, we have to create the appropriate number of
        // individual events within the range requested (end-start)
        var masterEvent = await eventSchema.validate(JSON.parse(redisEvents[i]));

        // Add the masterEvent. If it is repeating, create and add the children for display during the date range given
        events.push(masterEvent);

        // If not repeating, continue ...
        if (typeof masterEvent.repeatDow === 'undefined' || masterEvent.repeatDow === '7' /* none */)
          continue;

        // ... otherwise, create repeating events for the given timeframe
        var masterRepeatEnd;
        if (typeof masterEvent.repeatEnd == 'undefined')
          masterRepeatEnd = new Date(masterEvent.start);
        else
          masterRepeatEnd = new Date(masterEvent.repeatEnd);

        // Find the follow on dates
        for (var j = 0; j < masterEvent.repeatDow.length; j++) {
          var repeatDow = masterEvent.repeatDow[j];

          log.debug(`getEvents: Master Event (${JSON.stringify(masterEvent)})`);

          // Clone th object and calculate the next day increment
          var nextEvent = JSON.parse(JSON.stringify(masterEvent));
          var nextStart = new Date(masterEvent.start);
          var nextAmt = new Date(masterEvent.amt);
          var nextDay = (7 + repeatDow - nextStart.getDay()) % 7;

          log.debug(`getEvents: Next Day: (${nextDay})`);

          nextStart.setDate(nextStart.getDate() + (nextDay != 0 ? nextDay : 7));

          while (nextStart <= masterRepeatEnd) {
            nextEvent.start = nextStart;
            nextEvent.amt = nextAmt;

            log.debug(`getEvents: Next Event: (${nextEvent.start})`);
            events.push(nextEvent);

            // Clone the object
            nextEvent = JSON.parse(JSON.stringify(nextEvent));
            nextStart = new Date(nextEvent.start);
            nextAmt = new Date(nextEvent.amt);
            nextDay = (7 + repeatDow - nextStart.getDay()) % 7;

            log.debug(`getEvents: Next Day: (${nextDay})`);

            nextStart.setDate(nextStart.getDate() + (nextDay != 0 ? nextDay : 7));
          }
        }
      }
    } catch (err) {
      log.error("getEvents Failed: " + err);
    }

    callback(events);
  }

  async setEvent(event) {
    var eid = null;

    try {
      var validEvent = await eventSchema.validate(event);
      var validStart = (new Date(validEvent.start)).getTime() / 1000;

      if (typeof validEvent.id === 'undefined' || validEvent.id === "") {
        // Create a new event id.
        validEvent.id = uuidv4();
        log.debug(`setEvent: new event ${validEvent.id}`);
      } else {
        // Find and remove the old event
        var removeEvent = await this.findEvent(validEvent.id);

        if (removeEvent) {
          // Remove the event and the job from event queue.
          // We'll add back an updated job if necessary
          await this.delJob(removeEvent.id);
          await db.zremAsync(dbKeys.dbEventsKey, JSON.stringify(removeEvent));
        }
      }

      // Add the event and schedule a job
      await db.zaddAsync(dbKeys.dbEventsKey, validStart, JSON.stringify(validEvent));
      this.scheduleJob(validEvent);

      eid = validEvent.id;

    } catch (err) {
      log.error(`setEvent Failed to set event: ${JSON.stringify(err)}`);
    }
    return(eid);
  }

  async delEvent(event) {
    var eid = null;

    try {
      var validEvent = await eventSchema.validate(event);
      var removeEvent = await this.findEvent(validEvent.id);

      if (removeEvent) {
        // Remove the job from event queue
        await this.delJob(removeEvent.id);
        await db.zremAsync(dbKeys.dbEventsKey, JSON.stringify(removeEvent));

        eid = removeEvent.id;
      }
    } catch (err) {
      log.error(`delEvent Failed to del event: ${err}`);
    }

    return(eid);
  }

  async delJob(id) {
    var job = await EventsQueue.getJob(id);
    if (job) {
      log.debug(`delJob: job (${id}) deleted!`);
      job.remove();
    }
  }

  async findEvent(eid) {
    var eventCnt = await db.zcountAsync(dbKeys.dbEventsKey, '-inf', '+inf');

    var cnt = 0, start = 0;
    var end = 20; // get 'end' per page
    while (cnt < eventCnt) {
      var events = await db.zrangeAsync(dbKeys.dbEventsKey, start, end);

      for (var i = 0; i < events.length; i++) {
        var event = JSON.parse(events[i]);
        if (event.id === eid)
          return(event);
      }

      start = end;
      end += end;
      cnt += events.length;
    }

    return(null);
  }

  async scheduleJob(event) {
    // Add event to the EventsQueue. Calculate when it should be processed next.
    var now = new Date();

    var jobOpts = null, repeatOpts, delay;
    if (typeof event.repeatDow === 'undefined' || event.repeatDow === '7' /* none */) {
      // Skip it if we are not repeating and the start time is in the past
      delay = (new Date(event.start)).getTime() - now.getTime();
      if (delay > 0)
        jobOpts = { jobId: event.id, delay: delay, removeOnComplete: true };
    } else {
      // Skip it if the repeat has expired
      delay = (new Date(event.repeatEnd)).getTime() - now.getTime();
      if (delay > 0) {
        var start = new Date(event.start);
        var dow = (Array.isArray(event.repeatDow) ? event.repeatDow.join(",") : event.repeatDow);
        var repeatOpts = { cron: `${start.getMinutes()} ${start.getHours()} * * ${dow}`};

        jobOpts = { jobId: event.id, delay: delay, repeat: repeatOpts, removeOnComplete: true };
      }
    }

    if (jobOpts) {
      log.debug(`Events::scheduleJob(add): event (${JSON.stringify(event)} jobOpts ${JSON.stringify(jobOpts)}`);
      const job = await EventsQueue.add(event, jobOpts);
    } else {
      log.debug(`Events::scheduleJob(skip): nothing to do, job has expired(${JSON.stringify(event)})`);
    }
  }

  async processJob(job, done) {
    log.debug(`Events::process-ing job(${JSON.stringify(job)}`);

    var status;
    var zone = await ZonesInstance.getZone(job.data.sid);

    // If the job.id !== job.data.id (original event.id), then we created this job to turn the
    // zone off at a specified time. If the station was turned off manually, log & do nothing.
    if (job.id === job.data.id) {
      // We are meant to turn the zone ON
      if (!zone.status) {
        // Switch ON the station and create a job to turn it off
        ZonesInstance.switchZone(job.data.sid, job.data.fertilize, async (status) => {
          // Calculate irrigation time (minutes) to recharge the zone
          // Irrigators Equation : Q x t = d x A
          //   Q - flow rate (cfs)
          //   t - time (hr)
          //   d - depth (inches - adjusted for efficiency of irrigation system)
          //   A - area (acres)
          var irrTime = (((job.data.amt / zone.irreff) * (zone.area / sqft_acre)) / (zone.flowrate / gpm_cfs));
          var nextJob = await EventsQueue.add(job.data, { jobId: uuidv4(),
                                                          delay: irrTime * 3600000,
                                                          removeOnComplete: true });

          log.debug(`Events::process(1) zone ${zone.id} switched ${status === true ? 'ON' : 'OFF'}`);
          done();
        });
      } else {
        log.debug(`Events::process(1) zone ${zone.id} already ${zone.status === true ? 'ON' : 'OFF'}`);
        done();
      }
    } else {
      // We are meant to turn the zone OFF
      if (zone.status) {
        // Switch OFF the station and create a job to turn it off
        ZonesInstance.switchZone(job.data.sid, job.data.fertilize, async (status) => {
          log.debug(`Events::process(1) zone ${zone.id} switched ${status === true ? 'ON' : 'OFF'}`);
          done();
        });
      } else {
        log.debug(`Events::process(2) zone ${zone.id} already ${zone.status === true ? 'ON' : 'OFF'}`);
        done();
      }
    }
  }
}

const EventsInstance = new Events();
Object.freeze(EventsInstance);

module.exports = {
  EventsInstance
}
