/**
 * @file Longevity Test Suite
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const expect = require('expect');

/** Controllers */
const { VegableInstance } = require('../../server/controllers/vegable');

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

const runTests = async function (testZoneId) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  let madDays;
  let eids;
  let event;
  const events = [];

  let masterZone;
  let fertilizerZone;
  let testZone;

  let origEmitterCount;
  let origEmitterRate;
  let origArea;
  let origZoneStart;

  const testCrop = {
    name: 'Test Crop',
    initDay: 35,
    initKc: 0.70,
    initN: 5,
    initP: 10,
    initK: 10,
    initFreq: 1,
    devDay: 45,
    devKc: 0.70,
    devN: 20,
    devP: 0,
    devK: 0,
    devFreq: 1,
    midDay: 40,
    midKc: 1.05,
    midN: 0,
    midP: 0,
    midK: 0,
    midFreq: 0,
    lateDay: 15,
    lateKc: 0.95,
    lateN: 0,
    lateP: 0,
    lateK: 0,
    lateFreq: 0
  };
  const testPlanting = {
    zid: testZoneId,
    title: 'Test Planting',
    date: yesterday.toString(),
    cid: testCrop.id,
    age: 0,
    mad: 50,
    count: 2,
    spacing: 12
  };

  let fertilizing = false;
  let initFertExpect = 0;
  let devFertExpect = 0;
  let midFertExpect = 0;
  let lateFertExpect = 0;

  const expectFertilization = (zone, planting, crop, processDate) => {
    // Check if fertilizer zone should be on
    const lastFertilized = new Date(zone.fertilized);
    const plantingDate = new Date(planting.date);
    const age = planting.age
                + Math.round(Math.abs((processDate.getTime() - plantingDate.getTime()) / (milli_per_day)));
    const lastAgeFertilized = (lastFertilized < plantingDate ? 0 : planting.age
                + Math.round(Math.abs((lastFertilized.getTime() - plantingDate.getTime()) / (milli_per_day))));
    const initStage = crop.initDay;
    const devStage = initStage + crop.devDay;
    const midStage = devStage + crop.midDay;

    console.log(`age(${age}): lastFert(${lastAgeFertilized}) stages(${initStage}:${devStage}:${midStage})`);

    if (age <= initStage) {
      if (crop.initFreq && lastAgeFertilized === 0) {
        console.log(`initStage: n(${crop.initN}) p(${crop.initN}) k(${crop.initK})`);
        initFertExpect++;
      }
    } else if (age <= devStage) {
      if (crop.devFreq && lastAgeFertilized < initStage) {
        console.log(`devStage: n(${crop.devN}) p(${crop.devN}) k(${crop.devK})`);
        devFertExpect++;
      }
    } else if (age <= midStage) {
      if (crop.midFreq && lastAgeFertilized < devStage) {
        console.log(`midStage: n(${crop.midN}) p(${crop.midN}) k(${crop.midK})`);
        midFertExpect++;
      }
    } else {
      if (crop.midFreq && lastAgeFertilized < midStage) {
        console.log(`lateStage: n(${crop.lateN}) p(${crop.lateN}) k(${crop.lateK})`);
        lateFertExpect++;
      }
    }
  };

  let initFertActual = 0;
  let devFertActual = 0;
  let midFertActual = 0;
  let lateFertActual = 0;

  const actualFertilization = (fertilizer, planting, crop, processDate) => {
    const fertilized = (fertilizer.n || fertilizer.p || fertilizer.k) ? true : false;

    if (fertilized) {
      const plantingDate = new Date(planting.date);
      const age = planting.age
                  + Math.round(Math.abs((processDate.getTime() - plantingDate.getTime()) / (milli_per_day)));

      const initStage = crop.initDay;
      const devStage = initStage + crop.devDay;
      const midStage = devStage + crop.midDay;

      if (age <= initStage) {
        initFertActual++;
      } else if (age <= devStage) {
        devFertActual++;
      } else if (age <= midStage) {
        midFertActual++;
      } else {
        lateFertActual++;
      }
    }

    return (fertilized);
  };

  // Create a planting
  it('should adjust the zone irrigation and create a planting', async () => {
    // First we need to set the zone's irrigation capacity to shorten tests to reasonable durations
    testZone = await ZonesInstance.getZone(testZoneId);

    origArea = testZone.area;
    origEmitterCount = testZone.emitterCount;
    origEmitterRate = testZone.emitterRate;

    testZone.area = 1;
    testZone.emitterCount = 40;
    testZone.emitterRate = 2;

    await ZonesInstance.setZone(testZone);

    // Create a test crop
    testCrop.id = await CropsInstance.setCrop(testCrop);
    testPlanting.cid = testCrop.id;

    const result = await PlantingsInstance.setPlanting(testPlanting);
    testPlanting.id = result.id;

    console.log(`Test Crop: ${JSON.stringify(testCrop)}`);
    console.log(`Test Planting: ${JSON.stringify(testPlanting)}`);

    // Tell the zone of a planting change
    await ZonesInstance.updatePlantings(result.zids);

    testZone = await ZonesInstance.getZone(testZoneId);
  });

  // Set the first process date to today
  const firstProcessDate = new Date(today);

  // Set the next schedule date to now + 5 seconds
  let nextScheduleDate = new Date(Date.now() + (5 * milli_per_sec));

  describe('Longevity Tests', () => {
    describe('Verify zone recharge after initial planting', () => {
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

        eids = await VegableInstance.scheduleEvents(new Date(firstProcessDate), new Date(nextScheduleDate));
        expect(eids.length).toBe(1);

        events.push(...eids);

        // record expected fertilization
        await expectFertilization(testZone, testPlanting, testCrop, firstProcessDate);

        event = await EventsInstance.findEvent(eids[0]);
        expect(event).toBeDefined();

        fertilizing = await actualFertilization(JSON.parse(event.fertilizer), testPlanting, testCrop, firstProcessDate);
      });

      it(`should have adjusted zone ${testZoneId}`, async () => {
        testZone = await ZonesInstance.getZone(testZoneId);
        expect(testZone.adjusted).toBe(firstProcessDate.getTime());
      });

      it(`should have started the event and zone ${testZoneId} should be running`, function (done) {
        const eventStarted = nextScheduleDate.getTime() - Date.now() + milli_per_sec;
        const eventEnded = (testZone.swhc / testZone.iph) * milli_per_hour;

        // Make sure the test doesn't timeout
        this.timeout(eventStarted + eventEnded + (5 * milli_per_sec));

        console.log(`**** Waiting ${(eventStarted / milli_per_sec).toFixed(0)} seconds for event to start ...`);

        setTimeout(async () => {
          testZone = await ZonesInstance.getZone(testZoneId);
          expect(testZone.status).toBe(true);
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(true);

          if (fertilizing) {
            console.log(`****** Applying Fertilizer (${event.fertilizer}) ...`);
          }

          fertilizerZone = await ZonesInstance.getFertilizerZone();
          expect(fertilizerZone.status).toBe(fertilizing);

          console.log(`**** Waiting ${(eventEnded / milli_per_sec).toFixed(0)} seconds for event to end ...`);

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
    }); // 'Verify zone recharge after initial planting'

    describe('Verify zone recharge throughout life of planting', function () {
      const cropLifeSpan = testCrop.initDay + testCrop.devDay + testCrop.midDay + testCrop.lateDay;
      const processDates = [];
      let nextProcessDate = new Date(firstProcessDate);
      do {
        nextProcessDate.setDate(nextProcessDate.getDate() + 1);
        processDates.push(new Date(nextProcessDate));
      } while (processDates.length < cropLifeSpan);

      nextProcessDate = new Date(firstProcessDate);
      nextProcessDate.setDate(nextProcessDate.getDate() + 1);

      processDates.forEach((processDate) => {
        it('should deplete the soil and adjust the zone', async () => {
          let adjusted = testZone.adjusted;

          nextScheduleDate = new Date(Date.now() + (5 * milli_per_sec));

          testZone.start = `${('0' + nextScheduleDate.getHours()).slice(-2)}:${('0' + nextScheduleDate.getMinutes()).slice(-2)}`;
          await ZonesInstance.setZone(testZone);

          eids = await VegableInstance.scheduleEvents(new Date(processDate), new Date(nextScheduleDate));

          testZone = await ZonesInstance.getZone(testZoneId);

          // Make sure the zone was adjusted
          expect(testZone.adjusted).toBeGreaterThan(adjusted);

          adjusted = testZone.adjusted;

          if (typeof eids !== 'undefined' && eids.length === 1) {
            event = await EventsInstance.findEvent(eids[0]);
            expect(event).toBeDefined();

            fertilizing = await actualFertilization(JSON.parse(event.fertilizer), testPlanting, testCrop, firstProcessDate);
          }
        });

        it('should create and start a recharge event if available water fell below MAD', function (done) {
          if (testZone.availableWater <= (testZone.swhc * (testZone.mad / 100))) {
            madDays = Math.round(Math.abs((nextProcessDate.getTime() - processDate.getTime()) / (milli_per_day)));
            console.log(`*** It took ${madDays} days to reach ${testZone.availableWater.toFixed(2)} inches (${testZone.mad}% of ${testZone.swhc} inches)`);
            console.log(`*** Your ${testCrop.name} is ${((processDate.getTime() - firstProcessDate.getTime()) / milli_per_day).toFixed(0)} days old!`);

            nextProcessDate = processDate;

            expect(eids).toBeDefined();
            expect(eids.length).toBe(1);

            events.push(...eids);

            const eventStarted = nextScheduleDate.getTime() - Date.now() + milli_per_sec;
            const eventEnded = ((testZone.swhc - testZone.availableWater) / testZone.iph) * milli_per_hour;

            // Make sure the test doesn't timeout
            this.timeout(eventStarted + eventEnded + (5 * milli_per_sec));

            console.log(`**** Waiting ${(eventStarted / milli_per_sec).toFixed(0)} seconds for event to start ...`);

            setTimeout(async () => {
              // record expected fertilization
              await expectFertilization(testZone, testPlanting, testCrop, processDate);

              testZone = await ZonesInstance.getZone(testZoneId);
              expect(testZone.status).toBe(true);
              masterZone = await ZonesInstance.getMasterZone();
              expect(masterZone.status).toBe(true);

              if (fertilizing) {
                console.log(`****** Applying Fertilizer (${event.fertilizer}) ...`);
              }

              fertilizerZone = await ZonesInstance.getFertilizerZone();
              expect(fertilizerZone.status).toBe(fertilizing);

              console.log(`**** Waiting ${(eventEnded / milli_per_sec).toFixed(0)} seconds for event to end ...`);

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
          } else done();
        });
      }); // forEach(processDate)
    });

    describe('Verify results and cleanup', async function () {
      it('should have equal recharge events sync and stats', async function () {
        const stats = await StatsInstance.getStats(testZoneId, yesterday.getTime(), tomorrow.getTime());
        expect(stats).toBeDefined();
        expect(stats.length).toBe(events.length);

        let totalGals = 0;
        let totalTime = 0;
        let fertCount = 0;
        let totalN = 0;
        let totalP = 0;
        let totalK = 0;

        for (let stat = 0; stat < stats.length; stat++) {
          const fertilizerObj = JSON.parse(stats[stat].fertilizer);

          totalGals += stats[stat].amount;
          totalTime += (stats[stat].stopped - stats[stat].started);

          fertCount += (fertilizerObj.n || fertilizerObj.p || fertilizerObj.k) ? 1 : 0;
          totalN += fertilizerObj.n;
          totalP += fertilizerObj.p;
          totalK += fertilizerObj.k;
        }

        console.log(`**** Results: Irrigated ${stats.length}x Gallons ${totalGals.toFixed(1)} Time ${(totalTime / milli_per_hour).toFixed(2)}hrs`);
        console.log(`              Fertilized ${fertCount}x Fertilizer ${(totalN / fertCount).toFixed(0)}:${(totalP / fertCount).toFixed(0)}:${(totalK / fertCount).toFixed(0)}`);
        console.log(`              Fertilizer Stages (exp/act): ${initFertExpect}/${initFertActual}x ${devFertExpect}/${devFertActual}x ${midFertExpect}/${midFertActual}x ${lateFertExpect}/${lateFertActual}x`);
      });

      it(`should no longer have any plantings and reset zone ${testZoneId}`, async () => {
        const result = await PlantingsInstance.delPlanting(testPlanting);

        // Tell the zone of a planting change
        await ZonesInstance.updatePlantings(result.zids);

        // Reset all zones
        const zones = await ZonesInstance.getAllZones();
        for (let i = 0; i < zones.length; i++) {
          let zone = zones[i];

          zone.start = origZoneStart;
          zone.emitterCount = origEmitterCount;
          zone.emitterRate = origEmitterRate;
          zone.area = origArea;
          zone.availableWater = 0;
          zone.adjusted = 0;
          zone.fertilized = 0;
          await ZonesInstance.setZone(zone);

          zone = await ZonesInstance.getZone(zone.id);
          expect(zone.start).toBe(origZoneStart);
          expect(zone.emitterCount).toBe(origEmitterCount);
          expect(zone.emitterRate).toBe(origEmitterRate);
          expect(zone.area).toBe(origArea);
          expect(zone.availableWater).toBe(0);
          expect(zone.adjusted).toBe(0);
          expect(zone.fertilized).toBe(0);
          expect(zone.plantings).toBe(0);
        }

        // Delete the test crop
        expect(await CropsInstance.delCrop(testCrop.id)).toBe(testCrop.id);

        // Clear events and stats
        let totalInches = 0;
        for (let idx = 0; idx < events.length; idx++) {
          event = await EventsInstance.findEvent(events[idx]);

          expect(event).toBeDefined();

          totalInches += event.amt;

          expect(await EventsInstance.delEvent(event)).toBe(events[idx]);
        }
        console.log(`**** Results: Irr(in) ${totalInches.toFixed(2)}`);

        await StatsInstance.clearStats();
      });
    });
  });
};

module.exports = {
  runTests
};
