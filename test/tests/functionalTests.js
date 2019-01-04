/**
 * Functional Test Suite
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const expect = require('expect');
var sinon = require('sinon');

// Controllers
const {VegableInstance} = require('../../server/controllers/vegable');
const {WeatherInstance} = require('../../server/controllers/weather');

// Models
const {CropsInstance} = require('../../server/models/crops');
const {PlantingsInstance} = require('../../server/models/plantings');
const {StatsInstance} = require('../../server/models/stats');
const {ZonesInstance} = require('../../server/models/zones');
const {EventsInstance} = require('../../server/models/events');

const sum = (total, num) => {
  return total + num;
}

const gpm_cfs = 448.83;
const sqft_acre = 43560;

const milli_per_sec = 1000;
const milli_per_min = milli_per_sec * 60;
const milli_per_hour = milli_per_min * 60;
const milli_per_day = milli_per_hour * 24;

const runTests = (testZoneId) => {
  var start = new Date(2018, 0, 16); // Jan 15
  var end = new Date(2018, 1, 15);  // Feb 15
  var expectedETr = /* jan 16-31*/ ((1.86 / 31) * 16) +
                    /* feb 1-15 */ ((2.24 / 28) * 15)
  var dailyETo;

  var crops;

  var masterZone, fertilizerZone;
  var testZone, origZoneStart;
  var testPlanting1 = {
        zid: testZoneId,
        title: "Test Planting 1",
        date: start.toString(),
        mad: 50,
        count: 2,
        spacing: 12
      };
  var testPlanting2 = {
        zid: testZoneId,
        title: "Test Planting 2",
        date: start.toString(),
        mad: 25,
        count: 2,
        spacing: 12
      };

  var clock;
  var today = new Date();
  var yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  var tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  describe('Functional Tests', () => {
    var eids, madDays, newMadDays;
    var nextProcessDate, nextScheduleDate;

    // Create the conditions that we will use throughout the functional tests
    before ((done) => {
      // Get the crops and create a planting
      CropsInstance.getCrops(async (cropsdb) => {
        crops = cropsdb;
        testPlanting1.cid = crops[0].id;
        testPlanting1.age = crops[0].initDay + crops[0].devDay - 7; // ensure we span stages (dev & mid)
        testPlanting2.cid = crops[1].id;
        testPlanting2.age = crops[1].initDay + crops[1].devDay - 3;
        done();
      });
    });

    describe('Verify Evapotranspiration Calcs (ETo/ETc)', () => {
      before(async () => {
        var result = await PlantingsInstance.setPlanting(testPlanting1);
        testPlanting1.id = result.id;

        // Tell the zone of a planting change
        await ZonesInstance.updatePlantings(result.zids);

        testZone = await ZonesInstance.getZone(testZoneId);
      });

      it (`should get daily ETo for from ${start} to ${end}`, async () => {
        dailyETo = await WeatherInstance.getDailyETo(new Date(start), new Date(end));
        expect(dailyETo.length).toBe(31);
        expect(dailyETo.reduce(sum).toFixed(2)).toBe(String(expectedETr));
      });

      it (`should get daily ETc for all plantings in zone ${testZoneId} from ${start} to ${end}`, async () => {
        var expectedETc = 0;
        var age = testPlanting1.age;
        var initStage = crops[0].initDay;
        var devStage = initStage + crops[0].devDay;
        var midStage = devStage + crops[0].midDay;

        for (var day = 0; day < dailyETo.length; day++) {
          expectedETc += dailyETo[day] *
                          (age <= initStage ? crops[0].initKc :
                            (age <= devStage ? crops[0].devKc :
                              (age <= midStage ? crops[0].midKc : crops[0].lateKc)));
          age++;
        }

        var dailyETc = await PlantingsInstance.getETcByZone(testZoneId, new Date(start), new Date(end));
        expect(dailyETc.toFixed(2)).toBe(expectedETc.toFixed(2));
      });
    });

    describe('Verify zone recharge after initial planting', () => {

      before((done) => {
        // Set the end process date to yesterday
        nextProcessDate = new Date();
        nextProcessDate.setDate(nextProcessDate.getDate() - 1);

        // Set the next schedule date to now + 5 seconds
        nextScheduleDate = new Date(Date.now() + (5 * milli_per_sec));

        done();
      });

      it(`should find that zone ${testZoneId} has a planting`, async () => {
        testZone = await ZonesInstance.getZone(testZoneId);
        expect(testZone).toBeDefined();
        expect(testZone.plantings).toBe(1);
      });

      it(`should set zone ${testZoneId} start to nextScheduleDate.time`, async () => {
        origZoneStart = testZone.start;
        testZone.start = `${('0' + nextScheduleDate.getHours()).slice(-2)}:${('0' + nextScheduleDate.getMinutes()).slice(-2)}`;
        await ZonesInstance.setZone(testZone);
      });

      it(`should schedule an event for zone ${testZoneId}`, async () => {
        // Make sure the zone's start time was set properly
        expect((await ZonesInstance.getZone(testZone.id)).start).toBe(testZone.start);

        eids = await VegableInstance.scheduleEvents(new Date(nextProcessDate), new Date(nextScheduleDate));
        expect(eids.length).toBe(1);
      });

      it(`should have adjusted zone ${testZoneId}`, async () => {
        testZone = await ZonesInstance.getZone(testZoneId);
        expect(testZone.adjusted).toBe(nextProcessDate.getTime());
      });

      it(`should have started the event and zone ${testZoneId} should be running`, function (done) {
        var eventStarted = nextScheduleDate.getTime() - Date.now() + milli_per_sec;

        console.log(`Waiting ${eventStarted/milli_per_sec} seconds for event to start ...`);

        this.timeout(eventStarted + 500);
        setTimeout(async () => {
          testZone = await ZonesInstance.getZone(testZoneId);
          expect(testZone.status).toBe(true);
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(true);
          fertilizerZone = await ZonesInstance.getFertilizerZone();
          expect(fertilizerZone.status).toBe(true);
          done();
        }, eventStarted);
      });

      it(`should have ended the event and zone ${testZoneId} should be recharged and stopped`, function (done) {
        var eventEnded = ((((testZone.swhc / testZone.irreff) * (testZone.area / sqft_acre))
                            / (testZone.flowrate / gpm_cfs)) * milli_per_hour) + milli_per_sec;

        console.log(`Waiting ${eventEnded/milli_per_sec} seconds for event to end ...`);

        this.timeout(eventEnded + 500);
        setTimeout(async () => {
          testZone = await ZonesInstance.getZone(testZoneId);
          expect(testZone.availableWater.toFixed(2)).toBe(testZone.swhc.toFixed(2));
          expect(testZone.status).toBe(false);
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(false);
          fertilizerZone = await ZonesInstance.getFertilizerZone();
          expect(fertilizerZone.status).toBe(false);
          done();
        }, eventEnded);
      });

      it(`should get one stats record from ${yesterday} to ${tomorrow}`, async () => {
        var stats = await StatsInstance.getStats(testZoneId, yesterday.getTime(), tomorrow.getTime());
        expect(stats).toBeDefined();
        expect(stats.length).toBe(1);
      });

      it(`should delete the events scheduled for zone ${testZoneId}`, async () => {
        for (var i = 0; i < eids.length; i++) {
          var event = await EventsInstance.findEvent(eids[i]);

          expect(event).toBeDefined();
          expect(await EventsInstance.delEvent(event)).toBe(eids[i]);
        }
      });

    });

    describe('Verify zone recharge after maximum allowable depletion (MAD)', () => {

      it(`should deplete soil water below MAD and create a recharge event`, async () => {
        var availableWater = testZone.availableWater;
        var adjusted = testZone.adjusted;

        // Report how many days it took to reach MAD
        var firstProcessDate = new Date(nextProcessDate);

        // Set the next schedule date to now + 5 seconds
        nextScheduleDate = new Date(Date.now() + (5 * milli_per_sec));
        testZone.start = `${('0' + nextScheduleDate.getHours()).slice(-2)}:${('0' + nextScheduleDate.getMinutes()).slice(-2)}`;
        await ZonesInstance.setZone(testZone);

        while (testZone.availableWater > (testZone.swhc * (testZone.mad / 100))) {
          // Set the next process and schedule dates
          nextProcessDate.setDate(nextProcessDate.getDate() + 1);
          nextScheduleDate = new Date(Date.now() + (5 * milli_per_sec));

          eids = await VegableInstance.scheduleEvents(new Date(nextProcessDate), new Date(nextScheduleDate));

          testZone = await ZonesInstance.getZone(testZoneId);

          // Make sure the zone was adjusted
          expect(testZone.adjusted).toBeGreaterThan(adjusted);

          adjusted = testZone.adjusted;
        }

        madDays = Math.round(Math.abs((firstProcessDate.getTime() - nextProcessDate.getTime())/(milli_per_day)));
        console.log(`It took ${madDays} days to reach ${testZone.availableWater} inches (${testZone.mad}% of ${testZone.swhc} inches)`);

        // We should have reached a threshold and
        expect(eids).toBeDefined();
        expect(eids.length).toBe(1);
      });

      it(`should have started the event and zone ${testZoneId} should be running`, function (done) {
        var eventStarted = nextScheduleDate.getTime() - Date.now() + milli_per_sec;

        console.log(`Waiting ${eventStarted/milli_per_sec} seconds for event to start ...`);

        this.timeout(eventStarted + 500);
        setTimeout(async () => {
          testZone = await ZonesInstance.getZone(testZoneId);
          expect(testZone.status).toBe(true);
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(true);
          fertilizerZone = await ZonesInstance.getFertilizerZone();
          expect(fertilizerZone.status).toBe(false);
          done();
        }, eventStarted);
      });

      it(`should have ended the event and zone ${testZoneId} should be recharged and stopped`, function (done) {
        var eventEnded = ((((testZone.swhc / testZone.irreff) * (testZone.area / sqft_acre))
                            / (testZone.flowrate / gpm_cfs)) * milli_per_hour) + milli_per_sec;

        console.log(`Waiting ${eventEnded/milli_per_sec} seconds for event to end ...`);

        this.timeout(eventEnded + 500);
        setTimeout(async () => {
          testZone = await ZonesInstance.getZone(testZoneId);
          expect(testZone.availableWater.toFixed(2)).toBe(testZone.swhc.toFixed(2));
          expect(testZone.status).toBe(false);
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(false);
          fertilizerZone = await ZonesInstance.getFertilizerZone();
          expect(fertilizerZone.status).toBe(false);
          done();
        }, eventEnded);
      });

      it(`should get two stats record from ${yesterday} to ${tomorrow}`, async () => {
        var stats = await StatsInstance.getStats(testZoneId, yesterday.getTime(), tomorrow.getTime());
        expect(stats).toBeDefined();
        expect(stats.length).toBe(2);
      });

      it(`should delete the events scheduled for zone ${testZoneId}`, async () => {
        expect(eids).toBeDefined();
        for (var i = 0; i < eids.length; i++) {
          var event = await EventsInstance.findEvent(eids[i]);

          expect(event).toBeDefined();
          expect(await EventsInstance.delEvent(event)).toBe(eids[i]);
        }
      });
    });

    describe('Verify adjusted zone recharge after adding a planting', () => {
      before(async () => {
        var result = await PlantingsInstance.setPlanting(testPlanting2);
        testPlanting2.id = result.id;

        // Tell the zone of a planting change
        await ZonesInstance.updatePlantings(result.zids);

        testZone = await ZonesInstance.getZone(testZoneId);
      });

      it(`should have adjusted the zone's MAD`, async () => {
        expect(testZone.mad).toBe((testPlanting1.mad + testPlanting2.mad) / 2);
      });

      it(`should deplete soil water below MAD and create a recharge event (SOONER)`, async () => {
        var availableWater = testZone.availableWater;
        var adjusted = testZone.adjusted;

        // Report how many days it took to reach MAD
        var firstProcessDate = new Date(nextProcessDate);

        // Set the next schedule date to now + 5 seconds
        nextScheduleDate = new Date(Date.now() + (5 * milli_per_sec));
        testZone.start = `${('0' + nextScheduleDate.getHours()).slice(-2)}:${('0' + nextScheduleDate.getMinutes()).slice(-2)}`;
        await ZonesInstance.setZone(testZone);

        while (testZone.availableWater > (testZone.swhc * (testZone.mad / 100))) {
          // Set the next process and schedule dates
          nextProcessDate.setDate(nextProcessDate.getDate() + 1);
          nextScheduleDate = new Date(Date.now() + (5 * milli_per_sec));

          eids = await VegableInstance.scheduleEvents(new Date(nextProcessDate), new Date(nextScheduleDate));

          testZone = await ZonesInstance.getZone(testZoneId);

          // Make sure the zone was adjusted
          expect(testZone.adjusted).toBeGreaterThan(adjusted);

          adjusted = testZone.adjusted;
        }

        newMadDays = Math.round(Math.abs((firstProcessDate.getTime() - nextProcessDate.getTime())/(milli_per_day)));
        console.log(`It took ${newMadDays} days to reach ${testZone.availableWater} inches (${testZone.mad}% of ${testZone.swhc} inches)`);

        // We should have reached a threshold at a different time
        expect(newMadDays).not.toBeGreaterThan(madDays);
        expect(eids).toBeDefined();
        expect(eids.length).toBe(1);
      });

      it(`should have started the event and zone ${testZoneId} should be running`, function (done) {
        var eventStarted = nextScheduleDate.getTime() - Date.now() + milli_per_sec;

        console.log(`Waiting ${eventStarted/milli_per_sec} seconds for event to start ...`);

        this.timeout(eventStarted + 500);
        setTimeout(async () => {
          testZone = await ZonesInstance.getZone(testZoneId);
          expect(testZone.status).toBe(true);
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(true);
          fertilizerZone = await ZonesInstance.getFertilizerZone();
          expect(fertilizerZone.status).toBe(false);
          done();
        }, eventStarted);
      });

      it(`should have ended the event and zone ${testZoneId} should be recharged and stopped`, function (done) {
        var eventEnded = ((((testZone.swhc / testZone.irreff) * (testZone.area / sqft_acre))
                            / (testZone.flowrate / gpm_cfs)) * milli_per_hour) + milli_per_sec;

        console.log(`Waiting ${eventEnded/milli_per_sec} seconds for event to end ...`);

        this.timeout(eventEnded + 500);
        setTimeout(async () => {
          testZone = await ZonesInstance.getZone(testZoneId);
          expect(testZone.availableWater.toFixed(2)).toBe(testZone.swhc.toFixed(2));
          expect(testZone.status).toBe(false);
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(false);
          fertilizerZone = await ZonesInstance.getFertilizerZone();
          expect(fertilizerZone.status).toBe(false);
          done();
        }, eventEnded);
      });

      it(`should get three stats record from ${yesterday} to ${tomorrow}`, async () => {
        var stats = await StatsInstance.getStats(testZoneId, yesterday.getTime(), tomorrow.getTime());
        expect(stats).toBeDefined();
        expect(stats.length).toBe(3);
      });

      it(`should delete the events scheduled for zone ${testZoneId}`, async () => {
        for (var i = 0; i < eids.length; i++) {
          var event = await EventsInstance.findEvent(eids[i]);

          expect(event).toBeDefined();
          expect(await EventsInstance.delEvent(event)).toBe(eids[i]);
        }
      });
    });

    describe('Verify readjusted zone recharge after removing a planting', () => {
      before(async () => {
        var result = await PlantingsInstance.delPlanting(testPlanting2);

        // Tell the zone of a planting change
        await ZonesInstance.updatePlantings(result.zids);
      });

      it(`should have adjusted the zone's MAD`, async () => {
        testZone = await ZonesInstance.getZone(testZoneId);
        expect(testZone.plantings).toBe(1);
        expect(testZone.mad).toBe(testPlanting1.mad);
      });

      it(`should deplete soil water below MAD and create a recharge event (SLOWER)`, async () => {
        var availableWater = testZone.availableWater;
        var adjusted = testZone.adjusted;

        // Report how many days it took to reach MAD
        var firstProcessDate = new Date(nextProcessDate);

        // Set the next schedule date to now + 5 seconds
        nextScheduleDate = new Date(Date.now() + (5 * milli_per_sec));
        testZone.start = `${('0' + nextScheduleDate.getHours()).slice(-2)}:${('0' + nextScheduleDate.getMinutes()).slice(-2)}`;
        await ZonesInstance.setZone(testZone);

        while (testZone.availableWater > (testZone.swhc * (testZone.mad / 100))) {
          // Set the next process and schedule dates
          nextProcessDate.setDate(nextProcessDate.getDate() + 1);
          nextScheduleDate = new Date(Date.now() + (5 * milli_per_sec));

          eids = await VegableInstance.scheduleEvents(new Date(nextProcessDate), new Date(nextScheduleDate));

          testZone = await ZonesInstance.getZone(testZoneId);

          // Make sure the zone was adjusted
          expect(testZone.adjusted).toBeGreaterThan(adjusted);

          adjusted = testZone.adjusted;
        }

        madDays = Math.round(Math.abs((firstProcessDate.getTime() - nextProcessDate.getTime())/(milli_per_day)));
        console.log(`It took ${madDays} days to reach ${testZone.availableWater} inches (${testZone.mad}% of ${testZone.swhc} inches)`);

        // We should have reached a threshold at a different time
        expect(madDays).toBeGreaterThan(newMadDays);
        expect(eids).toBeDefined();
        expect(eids.length).toBe(1);
      });

      it(`should have started the event and zone ${testZoneId} should be running`, function (done) {
        var eventStarted = nextScheduleDate.getTime() - Date.now() + milli_per_sec;

        console.log(`Waiting ${eventStarted/milli_per_sec} seconds for event to start ...`);

        this.timeout(eventStarted + 500);
        setTimeout(async () => {
          testZone = await ZonesInstance.getZone(testZoneId);
          expect(testZone.status).toBe(true);
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(true);
          fertilizerZone = await ZonesInstance.getFertilizerZone();
          expect(fertilizerZone.status).toBe(false);
          done();
        }, eventStarted);
      });

      it(`should have ended the event and zone ${testZoneId} should be recharged and stopped`, function (done) {
        var eventEnded = ((((testZone.swhc / testZone.irreff) * (testZone.area / sqft_acre))
                            / (testZone.flowrate / gpm_cfs)) * milli_per_hour) + milli_per_sec;

        console.log(`Waiting ${eventEnded/milli_per_sec} seconds for event to end ...`);

        this.timeout(eventEnded + 500);
        setTimeout(async () => {
          testZone = await ZonesInstance.getZone(testZoneId);
          expect(testZone.availableWater.toFixed(2)).toBe(testZone.swhc.toFixed(2));
          expect(testZone.status).toBe(false);
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(false);
          fertilizerZone = await ZonesInstance.getFertilizerZone();
          expect(fertilizerZone.status).toBe(false);
          done();
        }, eventEnded);
      });

      it(`should get four stats record from ${yesterday} to ${tomorrow}`, async () => {
        var stats = await StatsInstance.getStats(testZoneId, yesterday.getTime(), tomorrow.getTime());
        expect(stats).toBeDefined();
        expect(stats.length).toBe(4);
      });

      it(`should delete the events scheduled for zone ${testZoneId}`, async () => {
        for (var i = 0; i < eids.length; i++) {
          var event = await EventsInstance.findEvent(eids[i]);

          expect(event).toBeDefined();
          expect(await EventsInstance.delEvent(event)).toBe(eids[i]);
        }
      });
    });

    describe('Cleanup after functional tests', () => {
      it(`should no longer have any plantings and reset zone ${testZoneId}`, async () => {
        var result = await PlantingsInstance.delPlanting(testPlanting1);

        // Tell the zone of a planting change
        await ZonesInstance.updatePlantings(result.zids);

        testZone = await ZonesInstance.getZone(testZoneId);
        expect(testZone.plantings).toBe(0);

        testZone.start = origZoneStart;
        testZone.availableWater = 0;
        testZone.adjusted = 0;
        await ZonesInstance.setZone(testZone);

        testZone = await ZonesInstance.getZone(testZoneId);
        expect(testZone.start).toBe(origZoneStart);
        expect(testZone.availableWater).toBe(0);
        expect(testZone.adjusted).toBe(0);

        await StatsInstance.clearStats(testZoneId);
      });
    });
  });
}

module.exports = {
  runTests
};
