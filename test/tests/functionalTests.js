/**
 * @file Functional Test Suite
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

 const expect = require('expect');
 const moment = require('moment');

/** Controllers */
const { VegableInstance } = require('../../server/controllers/vegable');
const { WeatherInstance } = require('../../server/controllers/weather');

/** Models */
const { CropsInstance } = require('../../server/models/crops');
const { PlantingsInstance } = require('../../server/models/plantings');
const { StatsInstance } = require('../../server/models/stats');
const { ZonesInstance } = require('../../server/models/zones');
const { EventsInstance } = require('../../server/models/events');

/** Constants */
const { milli_per_sec } = require('../../config/constants');
const { milli_per_hour } = require('../../config/constants');
const { milli_per_day } = require('../../config/constants');

const sum = (total, num) => {
  return total + num;
}

const testFertilization = (zone, planting, crop, processDate) => {
  // Check if fertilizer zone should be on
  const lastFertilized = new Date(zone.fertilized);
  const plantingDate = new Date(planting.date);
  const age = planting.age +
              Math.round(Math.abs((processDate.getTime() - plantingDate.getTime())/(milli_per_day)));
  const lastAgeFertilized = (lastFertilized < plantingDate ? 0 : planting.age +
              Math.round(Math.abs((lastFertilized.getTime() - plantingDate.getTime())/(milli_per_day))));
  const initStage = crop.initDay;
  const devStage = initStage + crop.devDay;
  const midStage = devStage + crop.midDay;
  let fertilize = false;

  if (age <= initStage) {
    if (crop.initFreq && lastAgeFertilized === 0) {
      fertilize = true;
    }
  } else if (age <= devStage) {
    if (crop.devFreq && lastAgeFertilized < initStage) {
      fertilize = true;
    }
  } else if (age <= midStage) {
    if (crop.midFreq && lastAgeFertilized < devStage) {
      fertilize = true;
    }
  } else {
    if (crop.midFreq && lastAgeFertilized < midStage) {
      fertilize = true;
    }
  }

  return (fertilize);
}


const runTests = (testZoneId, hasFertilizer) => {
  const startETr = new Date(2018, 0, 16); // Jan 15
  const endETr = new Date(2018, 1, 15);  // Feb 15
  let etrCrop = null;
  const etrPlanting = {
        zid: testZoneId,
        title: "ETr Planting",
        date: startETr.toString(),
        mad: 50,
        count: 2,
      };
  const expectedETr = ((1.86 / 31) * 16) /* jan 16-31 */
                    + ((2.24 / 28) * 15); /* feb 1-15 */
  let dailyETo;
  let crops;

  let masterZone;
  let fertilizerZone;
  let testZone;
  let shouldFertilize;
  let origEmitterCount;
  let origEmitterRate;
  let origWidth;
  let origLength;
  let origZoneStart;

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  let testCrop1 = null;
  const testPlanting1 = {
    zid: testZoneId,
    title: "Test Planting 1",
    date: yesterday.toString(),
    mad: 50,
    count: 2,
  };
  let testCrop2 = null;
  const testPlanting2 = {
    zid: testZoneId,
    title: "Test Planting 2",
    date: yesterday.toString(),
    mad: 25,
    count: 2,
  };

  describe('Functional Tests', () => {
    var eids, event, madDays, newMadDays;
    var nextProcessDate, nextScheduleDate;

    // Create the conditions that we will use throughout the functional tests
    before ((done) => {
      // Get the crops and create a planting
      CropsInstance.getCrops(async (cropsdb) => {
        crops = cropsdb;

        for (var cropNum = 0; cropNum < crops.length; cropNum++) {
          var crop = crops[cropNum];

          if (!etrCrop && crop.name === 'Broccoli') {
            etrCrop = crop;
            etrPlanting.cid = etrCrop.id;
            etrPlanting.age = etrCrop.initDay + etrCrop.devDay - 7; // ensure we span stages (dev & mid)
          }

          if (!testCrop1 && crop.name === 'Tomato') {
            testCrop1 = crop;
            testPlanting1.cid = testCrop1.id;
            testPlanting1.age = testCrop1.initDay - 5; // ensure we span stages (init & dev)
          }

          if (!testCrop2 && crop.name === 'Carrots') {
            testCrop2 = crop;
            testPlanting2.cid = testCrop2.id;
            testPlanting2.age = testCrop2.initDay + crop.devDay - 3; // ensure we span stages (dev & mid)
          }

          if (etrCrop && testCrop1 && testCrop2) {
            console.log(`Test Crop 1: (${JSON.stringify(testCrop1)})`);
            console.log(`Test Crop 2: (${JSON.stringify(testCrop2)})`);
            break;
          }
        }

        if (!hasFertilizer) {
          // turn off fertilization for test zone
          testZone = await ZonesInstance.getZone(testZoneId);
          testZone.fertilize = false;
          await ZonesInstance.setZone(testZone);
        }
        done();
      });
    });

    describe('Verify Evapotranspiration (ETo/ETc) and Fertilizer (NPK) Calcs', () => {
      before(async () => {
        const result = await PlantingsInstance.setPlanting(etrPlanting);
        etrPlanting.id = result.id;

        // Tell the zone of a planting change
        await ZonesInstance.updatePlantings(result.zids);

        testZone = await ZonesInstance.getZone(testZoneId);
      });

      it(`should get daily ETo for from ${startETr} to ${endETr}`, async () => {
        dailyETo = await WeatherInstance.getDailyETo(new Date(startETr), new Date(endETr));
        expect(dailyETo.length).toBe(31);
        expect(dailyETo.reduce(sum).toFixed(2)).toBe(String(expectedETr));
      });

      it(`should get daily ETc for all plantings in zone ${testZoneId} from ${startETr} to ${endETr}`, async () => {
        var expectedETc = 0;
        var age = etrPlanting.age;
        var initStage = etrCrop.initDay;
        var devStage = initStage + etrCrop.devDay;
        var midStage = devStage + etrCrop.midDay;

        for (var day = 0; day < dailyETo.length; day++) {
          expectedETc += dailyETo[day] *
                          (age <= initStage ? etrCrop.initKc :
                            (age <= devStage ? etrCrop.devKc :
                              (age <= midStage ? etrCrop.midKc : etrCrop.lateKc)));
          age++;
        }

        const dailyETc = await PlantingsInstance.getETcByZone(testZoneId, new Date(startETr), new Date(endETr));
        expect(dailyETc.toFixed(2)).toBe(expectedETc.toFixed(2));
      });

      it(`should get NPK demand for all plantings in zone ${testZoneId} from ${startETr} to ${endETr}`, async () => {
        const fertilizer = await PlantingsInstance.getFertilizerByZone(testZoneId, new Date(startETr), new Date(endETr),
                                                                     new Date(testZone.fertilized));
       console.log(`ETrCrop: (${JSON.stringify(etrCrop)})`);
       console.log(`Fertilizer: (${fertilizer})`);
      });

      after(async () => {
        const result = await PlantingsInstance.delPlanting(etrPlanting);

        // Tell the zone of a planting change
        await ZonesInstance.updatePlantings(result.zids);

        testZone = await ZonesInstance.getZone(testZoneId);
        expect(testZone.plantings).toBe(0);
      });

    });

    describe('Verify zone recharge after initial planting', () => {

      before(async () => {
        var result = await PlantingsInstance.setPlanting(testPlanting1);
        testPlanting1.id = result.id;

        // Tell the zone of a planting change
        await ZonesInstance.updatePlantings(result.zids);

        testZone = await ZonesInstance.getZone(testZoneId);

        // Set the end process date to today
        nextProcessDate = new Date(today);

        // Set the next schedule date to now + 5 seconds
        nextScheduleDate = new Date(Date.now() + (5 * milli_per_sec));

        // First we need to set the zone's irrigation capacity to shorten tests to reasonable durations
        testZone = await ZonesInstance.getZone(testZoneId);

        origWidth = testZone.width;
        origLength = testZone.length;
        origEmitterCount = testZone.emitterCount;
        origEmitterRate = testZone.emitterRate;

        testZone.width = 1;
        testZone.length = 1;
        testZone.emitterCount = 40;
        testZone.emitterRate = 2;

        await ZonesInstance.setZone(testZone);
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

      it(`should set zone ${testZoneId} to MANUAL`, async () => {
        testZone.auto = false;
        await ZonesInstance.setZone(testZone);
      });

      it(`should NOT schedule an event for zone ${testZoneId}`, async () => {
        eids = await VegableInstance.scheduleEvents(new Date(nextProcessDate), new Date(nextScheduleDate));
        expect(eids.length).toBe(0);
      });

      it(`should set zone ${testZoneId} back to AUTO`, async () => {
        testZone.auto = true;
        await ZonesInstance.setZone(testZone);
      });

      it(`should schedule an event for zone ${testZoneId}`, async () => {
        // Make sure the zone's start time was set properly
        expect((await ZonesInstance.getZone(testZone.id)).start).toBe(testZone.start);

        // check fertilize before we schedule events because the zone will change
        shouldFertilize = await testFertilization(testZone, testPlanting1, testCrop1, nextProcessDate);

        eids = await VegableInstance.scheduleEvents(new Date(nextProcessDate), new Date(nextScheduleDate));
        expect(eids.length).toBe(1);

        event = await EventsInstance.findEvent(eids[0]);
        expect(event).toBeDefined();
      });

      it(`should have adjusted zone ${testZoneId}`, async () => {
        testZone = await ZonesInstance.getZone(testZoneId);
        expect(testZone.adjusted).toBe(nextProcessDate.getTime());
      });

      it(`should have started the event and zone ${testZoneId} should be running`, function (done) {
        var eventStarted = nextScheduleDate.getTime() - Date.now() + milli_per_sec;
        var eventEnded = (testZone.swhc / testZone.iph) * milli_per_hour;

        // Make sure the test doesn't timeout
        this.timeout(eventStarted + eventEnded + (5 * milli_per_sec));

        console.log(`**** Waiting ${(eventStarted/milli_per_sec).toFixed(0)} seconds for event to start ...`);

        setTimeout(async () => {
          testZone = await ZonesInstance.getZone(testZoneId);
          expect(testZone.status).toBe(true);
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(true);

          console.log(`****** Fertilizer (${event.fertilizer}) ...`);

          var fertilizerObj = JSON.parse(event.fertilizer);
          var fertilizing = fertilizerObj.n || fertilizerObj.p || fertilizerObj.k ? true : false;
          expect(fertilizing).toBe(shouldFertilize);

          fertilizerZone = await ZonesInstance.getFertilizerZone();
          expect(fertilizerZone.status).toBe(hasFertilizer === true ? fertilizing : false);

          console.log(`**** Waiting ${(eventEnded/milli_per_sec).toFixed(0)} seconds for event to end ...`);

          setTimeout(async () => {
            testZone = await ZonesInstance.getZone(testZoneId);
            expect(testZone.availableWater.toFixed(1)).toBe(testZone.swhc.toFixed(1));
            expect(testZone.status).toBe(false);
            masterZone = await ZonesInstance.getMasterZone();
            expect(masterZone.status).toBe(false);
            fertilizerZone = await ZonesInstance.getFertilizerZone();
            expect(fertilizerZone.status).toBe(false);
            done();
          }, eventEnded);
        }, eventStarted);
      });

      it(`should get one stats record from ${yesterday} to ${tomorrow}`, async () => {
        const stats = await StatsInstance.getStats(testZoneId, yesterday.getTime(), tomorrow.getTime());
        expect(stats).toBeDefined();
        expect(stats.length).toBe(1);
      });

      it(`should delete the events scheduled for zone ${testZoneId}`, async () => {
        for (let i = 0; i < eids.length; i++) {
          const event = await EventsInstance.findEvent(eids[i]);

          expect(event).toBeDefined();
          expect(await EventsInstance.delEvent(event)).toBe(eids[i]);
        }
      });
    });

    describe('Verify zone recharge after maximum allowable depletion (MAD)', () => {
      it(`should deplete soil water below MAD and create a recharge event`, async function () {
        let adjusted = testZone.adjusted;

        // Report how many days it took to reach MAD
        var firstProcessDate = new Date(nextProcessDate);

        // Make sure the test doesn't timeout
        this.timeout(5 * milli_per_sec);

        while (testZone.availableWater > (testZone.swhc * (testZone.mad / 100))) {
          // Set the next process and schedule (+5 seconds) dates
          nextProcessDate.setDate(nextProcessDate.getDate() + 1);
          nextScheduleDate = new Date(Date.now() + (5 * milli_per_sec));

          // check fertilize before we schedule events because the zone will change
          shouldFertilize = await testFertilization(testZone, testPlanting1, testCrop1, nextProcessDate);

          testZone.start = `${('0' + nextScheduleDate.getHours()).slice(-2)}:${('0' + nextScheduleDate.getMinutes()).slice(-2)}`;
          await ZonesInstance.setZone(testZone);

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

        event = await EventsInstance.findEvent(eids[0]);
        expect(event).toBeDefined();
      });

      it(`should have started the event and zone ${testZoneId} should be running`, function (done) {
        var eventStarted = nextScheduleDate.getTime() - Date.now() + milli_per_sec;
        var eventEnded = ((testZone.swhc - testZone.availableWater) / testZone.iph) * milli_per_hour;

        // Make sure the test doesn't timeout
        this.timeout(eventStarted + eventEnded + (5 * milli_per_sec));

        console.log(`**** Waiting ${(eventStarted/milli_per_sec).toFixed(0)} seconds for event to start ...`);

        setTimeout(async () => {
          testZone = await ZonesInstance.getZone(testZoneId);
          expect(testZone.status).toBe(true);
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(true);

          console.log(`****** Fertilizer (${event.fertilizer}) ...`);

          // Check if fertilizer zone should be on
          var fertilizerObj = JSON.parse(event.fertilizer);
          var fertilizing = fertilizerObj.n || fertilizerObj.p || fertilizerObj.k ? true : false;
          expect(fertilizing).toBe(shouldFertilize);

          fertilizerZone = await ZonesInstance.getFertilizerZone();
          expect(fertilizerZone.status).toBe(hasFertilizer === true ? fertilizing : false);

          console.log(`**** Waiting ${(eventEnded/milli_per_sec).toFixed(0)} seconds for event to end ...`);

          setTimeout(async () => {
            testZone = await ZonesInstance.getZone(testZoneId);
            expect(testZone.availableWater.toFixed(1)).toBe(testZone.swhc.toFixed(1));
            expect(testZone.status).toBe(false);
            masterZone = await ZonesInstance.getMasterZone();
            expect(masterZone.status).toBe(false);
            fertilizerZone = await ZonesInstance.getFertilizerZone();
            expect(fertilizerZone.status).toBe(false);
            done();
          }, eventEnded);
        }, eventStarted);
      });

      it(`should get two stats record from ${yesterday} to ${tomorrow}`, async () => {
        const stats = await StatsInstance.getStats(testZoneId, yesterday.getTime(), tomorrow.getTime());
        expect(stats).toBeDefined();
        expect(stats.length).toBe(2);
      });

      it(`should delete the events scheduled for zone ${testZoneId}`, async () => {
        expect(eids).toBeDefined();
        for (let i = 0; i < eids.length; i++) {
          var event = await EventsInstance.findEvent(eids[i]);

          expect(event).toBeDefined();
          expect(await EventsInstance.delEvent(event)).toBe(eids[i]);
        }
      });
    });

    describe('Verify adjusted zone recharge after a rain event', () => {
      let rainDate;

      before(async () => {
        var weatherData = {
          eto: 0.5,
          solar: 0,
          wind: 0,
          precip: 1.0,
          precipProb: 0,
          tempLo: 0,
          humidity: 0
        };

        rainDate = new Date(nextProcessDate);

        // Space out rain event far enough to make a difference
        rainDate.setDate(rainDate.getDate() + 5);

        const conditions =  await WeatherInstance.setConditions(rainDate, weatherData);
        expect(conditions).toBeDefined();
      });

      it(`should find a rain event`, async () => {
        const adjustmentDate = new Date(testZone.adjusted);
        const conditions =  await WeatherInstance.getConditions(adjustmentDate, rainDate);
        expect(conditions).toBeDefined();
        expect(conditions.length).toBe(1);
      });

      it(`should deplete soil water below MAD and create a recharge event (LATER)`, async function () {
        let adjusted = testZone.adjusted;

        // Report how many days it took to reach MAD
        var firstProcessDate = new Date(nextProcessDate);

        // Make sure the test doesn't timeout
        this.timeout(5 * milli_per_sec);

        while (testZone.availableWater > (testZone.swhc * (testZone.mad / 100))) {
          // Set the next process and schedule (+5 seconds) dates
          nextProcessDate.setDate(nextProcessDate.getDate() + 1);
          nextScheduleDate = new Date(Date.now() + (5 * milli_per_sec));

          // check fertilize before we schedule events because the zone will change
          shouldFertilize = await testFertilization(testZone, testPlanting1, testCrop1, nextProcessDate);

          testZone.start = `${('0' + nextScheduleDate.getHours()).slice(-2)}:${('0' + nextScheduleDate.getMinutes()).slice(-2)}`;
          await ZonesInstance.setZone(testZone);

          eids = await VegableInstance.scheduleEvents(new Date(nextProcessDate), new Date(nextScheduleDate));

          testZone = await ZonesInstance.getZone(testZoneId);

          // Make sure the zone was adjusted
          expect(testZone.adjusted).toBeGreaterThan(adjusted);

          adjusted = testZone.adjusted;
        }

        newMadDays = Math.round(Math.abs((firstProcessDate.getTime() - nextProcessDate.getTime()) / (milli_per_day)));
        console.log(`It took ${newMadDays} days to reach ${testZone.availableWater} inches (${testZone.mad}% of ${testZone.swhc} inches)`);

        // We should have reached a threshold at a different time
        expect(newMadDays).toBeGreaterThan(madDays);
        expect(eids).toBeDefined();
        expect(eids.length).toBe(1);

        event = await EventsInstance.findEvent(eids[0]);
        expect(event).toBeDefined();
      });

      it(`should have started the event and zone ${testZoneId} should be running`, function (done) {
        var eventStarted = nextScheduleDate.getTime() - Date.now() + milli_per_sec;
        var eventEnded = ((testZone.swhc - testZone.availableWater) / testZone.iph) * milli_per_hour;

        // Make sure the test doesn't timeout
        this.timeout(eventStarted + eventEnded + (5 * milli_per_sec));

        console.log(`**** Waiting ${(eventStarted / milli_per_sec).toFixed(0)} seconds for event to start ...`);

        setTimeout(async () => {
          testZone = await ZonesInstance.getZone(testZoneId);
          expect(testZone.status).toBe(true);
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(true);

          console.log(`****** Fertilizer (${event.fertilizer}) ...`);

          // Check if fertilizer zone should be on
          var fertilizerObj = JSON.parse(event.fertilizer);
          var fertilizing = fertilizerObj.n || fertilizerObj.p || fertilizerObj.k ? true : false;
          expect(fertilizing).toBe(shouldFertilize);

          fertilizerZone = await ZonesInstance.getFertilizerZone();
          expect(fertilizerZone.status).toBe(hasFertilizer === true ? fertilizing : false);

          console.log(`**** Waiting ${(eventEnded / milli_per_sec).toFixed(0)} seconds for event to end ...`);

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
        }, eventStarted);
      });

      it(`should get three stats record from ${yesterday} to ${tomorrow}`, async () => {
        const stats = await StatsInstance.getStats(testZoneId, yesterday.getTime(), tomorrow.getTime());
        expect(stats).toBeDefined();
        expect(stats.length).toBe(3);
      });

      it(`should delete the events scheduled for zone ${testZoneId}`, async () => {
        for (let i = 0; i < eids.length; i++) {
          const event = await EventsInstance.findEvent(eids[i]);

          expect(event).toBeDefined();
          expect(await EventsInstance.delEvent(event)).toBe(eids[i]);
        }
      });
    });

    describe('Verify adjusted zone recharge after adding a planting', () => {
      before(async () => {
        const result = await PlantingsInstance.setPlanting(testPlanting2);
        testPlanting2.id = result.id;

        // Tell the zone of a planting change
        await ZonesInstance.updatePlantings(result.zids);

        testZone = await ZonesInstance.getZone(testZoneId);
      });

      it('should have adjusted the zones MAD', async () => {
        expect(testZone.mad).toBe((testPlanting1.mad + testPlanting2.mad) / 2);
      });

      it('should deplete soil water below MAD and create a recharge event (SOONER)', async function () {
        let adjusted = testZone.adjusted;

        // Report how many days it took to reach MAD
        var firstProcessDate = new Date(nextProcessDate);

        // Make sure the test doesn't timeout
        this.timeout(5 * milli_per_sec);

        while (testZone.availableWater > (testZone.swhc * (testZone.mad / 100))) {
          // Set the next process and schedule (+5 seconds) dates
          nextProcessDate.setDate(nextProcessDate.getDate() + 1);
          nextScheduleDate = new Date(Date.now() + (5 * milli_per_sec));

          // check fertilize before we schedule events because the zone will change
          shouldFertilize = (await testFertilization(testZone, testPlanting1, testCrop1, nextProcessDate)
                             || await testFertilization(testZone, testPlanting2, testCrop2, nextProcessDate));

          testZone.start = `${('0' + nextScheduleDate.getHours()).slice(-2)}:${('0' + nextScheduleDate.getMinutes()).slice(-2)}`;
          await ZonesInstance.setZone(testZone);

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

        event = await EventsInstance.findEvent(eids[0]);
        expect(event).toBeDefined();
      });

      it(`should have started the event and zone ${testZoneId} should be running`, function (done) {
        var eventStarted = nextScheduleDate.getTime() - Date.now() + milli_per_sec;
        var eventEnded = ((testZone.swhc - testZone.availableWater) / testZone.iph) * milli_per_hour;

        // Make sure the test doesn't timeout
        this.timeout(eventStarted + eventEnded + (5 * milli_per_sec));

        console.log(`**** Waiting ${(eventStarted / milli_per_sec).toFixed(0)} seconds for event to start ...`);

        setTimeout(async () => {
          testZone = await ZonesInstance.getZone(testZoneId);
          expect(testZone.status).toBe(true);
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(true);

          console.log(`****** Fertilizer (${event.fertilizer}) ...`);

          // Check if fertilizer zone should be on
          var fertilizerObj = JSON.parse(event.fertilizer);
          var fertilizing = fertilizerObj.n || fertilizerObj.p || fertilizerObj.k ? true : false;
          expect(fertilizing).toBe(shouldFertilize);

          fertilizerZone = await ZonesInstance.getFertilizerZone();
          expect(fertilizerZone.status).toBe(hasFertilizer === true ? fertilizing : false);

          console.log(`**** Waiting ${(eventEnded / milli_per_sec).toFixed(0)} seconds for event to end ...`);

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
        }, eventStarted);
      });

      it(`should get three stats record from ${yesterday} to ${tomorrow}`, async () => {
        const stats = await StatsInstance.getStats(testZoneId, yesterday.getTime(), tomorrow.getTime());
        expect(stats).toBeDefined();
        expect(stats.length).toBe(4);
      });

      it(`should delete the events scheduled for zone ${testZoneId}`, async () => {
        for (let i = 0; i < eids.length; i++) {
          const event = await EventsInstance.findEvent(eids[i]);

          expect(event).toBeDefined();
          expect(await EventsInstance.delEvent(event)).toBe(eids[i]);
        }
      });
    });

    describe('Verify readjusted zone recharge after removing a planting', () => {
      before(async () => {
        const result = await PlantingsInstance.delPlanting(testPlanting2);

        // Tell the zone of a planting change
        await ZonesInstance.updatePlantings(result.zids);
      });

      it('should have adjusted the zones MAD', async () => {
        testZone = await ZonesInstance.getZone(testZoneId);
        expect(testZone.plantings).toBe(1);
        expect(testZone.mad).toBe(testPlanting1.mad);
      });

      it('should deplete soil water below MAD and create a recharge event (SLOWER)', async function () {
        let adjusted = testZone.adjusted;

        // Report how many days it took to reach MAD
        var firstProcessDate = new Date(nextProcessDate);

        // Make sure the test doesn't timeout
        this.timeout(5 * milli_per_sec);

        while (testZone.availableWater > (testZone.swhc * (testZone.mad / 100))) {
          // Set the next process and schedule (+5 seconds) dates
          nextProcessDate.setDate(nextProcessDate.getDate() + 1);
          nextScheduleDate = new Date(Date.now() + (5 * milli_per_sec));

          // check fertilize before we schedule events because the zone will change
          shouldFertilize = await testFertilization(testZone, testPlanting1, testCrop1, nextProcessDate);

          testZone.start = `${('0' + nextScheduleDate.getHours()).slice(-2)}:${('0' + nextScheduleDate.getMinutes()).slice(-2)}`;
          await ZonesInstance.setZone(testZone);

          eids = await VegableInstance.scheduleEvents(new Date(nextProcessDate), new Date(nextScheduleDate));

          testZone = await ZonesInstance.getZone(testZoneId);

          // Make sure the zone was adjusted
          expect(testZone.adjusted).toBeGreaterThan(adjusted);

          adjusted = testZone.adjusted;
        }

        madDays = Math.round(Math.abs((firstProcessDate.getTime() - nextProcessDate.getTime()) / (milli_per_day)));
        console.log(`It took ${madDays} days to reach ${testZone.availableWater} inches (${testZone.mad}% of ${testZone.swhc} inches)`);

        // We should have reached a threshold at a different time
        expect(madDays).toBeGreaterThan(newMadDays);
        expect(eids).toBeDefined();
        expect(eids.length).toBe(1);

        event = await EventsInstance.findEvent(eids[0]);
        expect(event).toBeDefined();
      });

      it(`should have started the event and zone ${testZoneId} should be running`, function (done) {
        var eventStarted = nextScheduleDate.getTime() - Date.now() + milli_per_sec;
        var eventEnded = ((testZone.swhc - testZone.availableWater) / testZone.iph) * milli_per_hour;

        // Make sure the test doesn't timeout
        this.timeout(eventStarted + eventEnded + (5 * milli_per_sec));

        console.log(`**** Waiting ${(eventStarted / milli_per_sec).toFixed(0)} seconds for event to start ...`);

        setTimeout(async () => {
          testZone = await ZonesInstance.getZone(testZoneId);
          expect(testZone.status).toBe(true);
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(true);

          console.log(`****** Fertilizer (${event.fertilizer}) ...`);

          // Check if fertilizer zone should be on
          const fertilizerObj = JSON.parse(event.fertilizer);
          const fertilizing = fertilizerObj.n || fertilizerObj.p || fertilizerObj.k ? true : false;
          expect(fertilizing).toBe(shouldFertilize);

          fertilizerZone = await ZonesInstance.getFertilizerZone();
          expect(fertilizerZone.status).toBe(hasFertilizer === true ? fertilizing : false);

          console.log(`**** Waiting ${(eventEnded / milli_per_sec).toFixed(0)} seconds for event to end ...`);

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
        }, eventStarted);
      });

      it(`should get four stats record from ${yesterday} to ${tomorrow}`, async () => {
        const stats = await StatsInstance.getStats(testZoneId, yesterday.getTime(), tomorrow.getTime());
        expect(stats).toBeDefined();
        expect(stats.length).toBe(5);
      });

      it(`should delete the events scheduled for zone ${testZoneId}`, async () => {
        for (let i = 0; i < eids.length; i++) {
          const event = await EventsInstance.findEvent(eids[i]);

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

        // Reset all zones
        var zones = await ZonesInstance.getAllZones();
        for (let i = 0; i < zones.length; i++) {
          let zone = zones[i];

          zone.start = origZoneStart;
          zone.emitterCount = origEmitterCount;
          zone.emitterRate = origEmitterRate;
          zone.auto = true;
          zone.fertilize = true;
          zone.width = origWidth;
          zone.length = origLength;
          zone.availableWater = 0;
          zone.adjusted = 0;
          zone.fertilized = 0;
          await ZonesInstance.setZone(zone);

          zone = await ZonesInstance.getZone(zone.id);
          expect(zone.start).toBe(origZoneStart);
          expect(zone.emitterCount).toBe(origEmitterCount);
          expect(zone.emitterRate).toBe(origEmitterRate);
          expect(zone.auto).toBe(true);
          expect(zone.fertilize).toBe(true);
          expect(zone.width).toBe(origWidth);
          expect(zone.length).toBe(origLength);
          expect(zone.availableWater).toBe(0);
          expect(zone.adjusted).toBe(0);
          expect(zone.fertilized).toBe(0);
          expect(zone.plantings).toBe(0);
        }

        await WeatherInstance.clearWeatherData();
        await StatsInstance.clearStats();
      });
    });
  });
};

module.exports = {
  runTests
};
