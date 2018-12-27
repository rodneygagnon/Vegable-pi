/**
 * Events Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const {log} = require('../controllers/logger');

const uuidv4 = require('uuid/v4');
const Queue = require("bull");

const Zones = require('./zones');

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const eventSchema = schema({
  id: String,                     // Event UUID
  sid: Number,                    // Zone ID
  title: String,
  start: String,                  // ISO8601
  amt: { type: Number, min: 1 },  // inches of water to apply
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

let EventsInstance;

const getEventsInstance = async (callback) => {
  if (EventsInstance) {
   callback(EventsInstance);
   return;
  }

  EventsInstance = await new Events();
  await EventsInstance.init(() => {
   log.debug("*** Events Initialized! ");
   callback(EventsInstance);
  })
}

class Events {
  constructor() {}

  async init(callback) {
    try {
    	EventsQueue = new Queue('EventsQueue', {redis: {host: 'redis'}});

      // Set Queue processor
      EventsQueue.process(async (job, done) => {
        this.processJob(job, done);
      });
    } catch (err) {
      log.error("Failed to create EVENTS queue: ", + err);
    }

    // Manage Zones
    Zones.getZonesInstance((zones) => {
      this.zones = zones;
    });

    callback();
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
      var zone = await this.zones.getZone(validEvent.sid);

      // Set colors based on zone
      validEvent.color = zone.color;
      validEvent.textColor = zone.textColor;

      var validStart = (new Date(validEvent.start)).getTime() / 1000;

      if (typeof validEvent.id === 'undefined' || validEvent.id === "") {
        // Create a new event id.
        validEvent.id = uuidv4();
      } else {
        // Find and remove the old event
        var removeEvent = await this.findEvent(validEvent.id);

        if (removeEvent) {
          // Remove the event and the job from event queue.
          // We'll add back an updated job if necessary
          var job = await EventsQueue.getJob(removeEvent.id);
          if (job)
            job.remove();

          await db.zremAsync(dbKeys.dbEventsKey, JSON.stringify(removeEvent));
        }
      }

      // Add the event and schedule a job
      await db.zaddAsync(dbKeys.dbEventsKey, validStart, JSON.stringify(validEvent));
      this.scheduleJob(validEvent);

      eid = validEvent.id;

    } catch (err) {
      log.error(`setPlanting Failed to set planting: ${err}`);
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
        var job = await EventsQueue.getJob(removeEvent.id);
        if (job)
          job.remove();

        await db.zremAsync(dbKeys.dbEventsKey, JSON.stringify(removeEvent));

        eid = removeEvent.id;
      }
    } catch (err) {
      log.error(`delEvent Failed to del planting: ${err}`);
    }

    return(eid);
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

    var repeatEnd, repeatOpts;
    if (typeof event.repeatDow === 'undefined' || event.repeatDow === '7' /* none */) {
      repeatOpts = {};
      repeatEnd = new Date(event.start);
    } else {
      var start = new Date(event.start);
      var dow = (Array.isArray(event.repeatDow) ? event.repeatDow.join(", ") : event.repeatDow);

      repeatOpts = `{ cron: '${start.getMinutes()} ${start.getHours()} * * ${dow}'}`;
      repeatEnd = new Date(event.repeatEnd);
    }

    // Calculate when to process this job
    var delay = repeatEnd.getTime() - now.getTime();
    if (delay < 0) {
      log.debug(`scheduleJob(skip): nothing to do, job has expired(${repeatEnd.toLocaleString()})`);
      return;
    } else {
      log.debug(`scheduleJob(delay): (${delay}ms) process in ${delay/6000}min`);
    }

    log.debug(`scheduleJob(repeatOpts):${JSON.stringify(repeatOpts)}`);

    const job = await EventsQueue.add(event, { jobId: event.id,
                                               delay: delay,
                                               repeat: repeatOpts,
                                               removeOnComplete: true });

    log.debug(`scheduleJob(add): ${JSON.stringify(job)}`);
  }

  async processJob(job, done) {
    var status;

    // Switch ON/OFF the station
    this.zones.switchZone(job.data.sid, async (status) => {
      log.debug(`processJob(switched ${status ? "on" : "off"}): Zone ID ${job.data.sid}`);

      // If the zone is running, calculate its runtime and push a job back
      // on the queue with the a delay (ms) to turn it off
      if (status) {
        // Calculate irrigation time (minutes) to recharge the zone
        // Irrigators Equation : Q x t = d x A
        //   Q - flow rate (cfs)
        //   t - time (hr)
        //   d - depth (inches - adjusted for efficiency of irrigation system)
        //   A - area (acres)
        var zone = await this.zones.getZone(job.data.sid);
        var irrTime = (((job.data.amt / zone.irreff) * (zone.area / sqft_acre)) / (zone.flowrate / gpm_cfs));

        // TODO: Store Job id in zone so we can remove it if the zone is turned off manually
        var nextJob = await EventsQueue.add(job.data, { jobId: uuidv4(),
                                                        delay: irrTime * 3600000,
                                                        removeOnComplete: true });

        log.debug(`processJob(add): ${JSON.stringify(nextJob)} delay (${irrTime} hr)`);
      }

      done();
    });
  }
}

module.exports = {
   Events,
   getEventsInstance
};
