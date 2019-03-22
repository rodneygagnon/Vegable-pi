/**
 * @file Simulation Test Suite
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const expect = require('expect');

/** Controllers */
const { VegableInstance } = require('../../server/controllers/vegable');

/** Models */
const { ZonesInstance } = require('../../server/models/zones');
const { CropsInstance } = require('../../server/models/crops');
const { EventsInstance } = require('../../server/models/events');
const { PlantingsInstance } = require('../../server/models/plantings');
const { StatsInstance } = require('../../server/models/stats');

/** Constants */
const { MilliPerSec } = require('../../config/constants');
const { MilliPerHour } = require('../../config/constants');
const { MilliPerDay } = require('../../config/constants');
const { AppRateDripConversion } = require('../../config/constants');

const runTests = async () => {
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

  const plantedZones = [];
  const plantedZoneConfigs = [
    {
      name: 'Auto Water / Fertilizer',
      width: 5,
      length: 5,
      auto: true,
      fertilize: true,
      emitterCount: 36,
      emitterRate: 25,
      start: '04:00',
    },
    // {
    //   name: 'Auto Water / No Fertilizer',
    //   width: 5,
    //   length: 5,
    //   auto: true,
    //   fertilize: false,
    //   emitterCount: 31,
    //   emitterRate: 1,
    //   start: '04:30',
    // },
    // {
    //   name: 'Manual Zone',
    //   width: 5,
    //   length: 5,
    //   auto: false,
    //   fertilize: false,
    //   emitterCount: 31,
    //   emitterRate: 1,
    //   start: '05:00',
    // },
  ];

  const origZoneStarts = [];

  const simPlantings = [];
  let simPlantingsLifeSpan = 180; // 6 Months

  let fertilizing = false;
  let initFertExpect = 0;
  let devFertExpect = 0;
  let midFertExpect = 0;
  let lateFertExpect = 0;

  const expectFertilization = (zone, planting, crop, processDate) => {
    // Check if fertilizer zone should be on
    const lastFertilized = new Date(zone.fertilized);
    const plantingDate = new Date(planting.date);
    const age = planting.age + Math.round(Math.abs(
      (processDate.getTime() - plantingDate.getTime()) / (MilliPerDay)
    ));
    const lastAgeFertilized = (lastFertilized < plantingDate ? 0 : planting.age
                + Math.round(Math.abs((
                  lastFertilized.getTime() - plantingDate.getTime()) / (MilliPerDay))));
    const initStage = crop.initDay;
    const devStage = initStage + crop.devDay;
    const midStage = devStage + crop.midDay;

    // console.log(`expectFertilization: age(${age}) lastFert(${lastAgeFertilized}) stages(${initStage}:${devStage}:${midStage})`);

    if (age <= initStage) {
      if (crop.initFreq && lastAgeFertilized === 0) {
        // console.log(`initStage: n(${crop.initN}) p(${crop.initN}) k(${crop.initK})`);
        initFertExpect += 1;
      }
    } else if (age <= devStage) {
      if (crop.devFreq && lastAgeFertilized < initStage) {
        // console.log(`devStage: n(${crop.devN}) p(${crop.devN}) k(${crop.devK})`);
        devFertExpect += 1;
      }
    } else if (age <= midStage) {
      if (crop.midFreq && lastAgeFertilized < devStage) {
        // console.log(`midStage: n(${crop.midN}) p(${crop.midN}) k(${crop.midK})`);
        midFertExpect += 1;
      }
    } else {
      if (crop.midFreq && lastAgeFertilized < midStage) {
        // console.log(`lateStage: n(${crop.lateN}) p(${crop.lateN}) k(${crop.lateK})`);
        lateFertExpect += 1;
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
      const age = planting.age + Math.round(Math.abs(
        (processDate.getTime() - plantingDate.getTime()) / (MilliPerDay)
      ));

      const initStage = crop.initDay;
      const devStage = initStage + crop.devDay;
      const midStage = devStage + crop.midDay;

      if (age <= initStage) {
        initFertActual += 1;
      } else if (age <= devStage) {
        devFertActual += 1;
      } else if (age <= midStage) {
        midFertActual += 1;
      } else {
        lateFertActual += 1;
      }
    }

    return (fertilized);
  };

  it('should configure the simulation zones', (done) => {
    ZonesInstance.getPlantingZones(async (zones) => {
      for (let zid = 0; zid < plantedZoneConfigs.length; zid++) {
        const zone = zones[zid];

        zone.name = plantedZoneConfigs[zid].name;
        zone.width = plantedZoneConfigs[zid].width;
        zone.length = plantedZoneConfigs[zid].length;
        zone.area = zone.length * zone.width;
        zone.auto = plantedZoneConfigs[zid].auto;
        zone.fertilize = plantedZoneConfigs[zid].fertilize;
        zone.emitterCount = plantedZoneConfigs[zid].emitterCount;
        zone.emitterRate = plantedZoneConfigs[zid].emitterRate;
        zone.gph = zone.emitterCount * zone.emitterRate;
        zone.iph = (zone.gph * AppRateDripConversion) / zone.area;
        zone.start = plantedZoneConfigs[zid].start;
        zone.availableWater = 0;
        zone.adjusted = 0;
        zone.fertilized = 0;

        await ZonesInstance.setZone(zone);

        plantedZones.push(zone);
      }
      done();
    });
  });

  describe('Plantings', () => {
    before ((done) => {
      // Get the crops and create plantings
      CropsInstance.getCrops(async (crops) => {
        for (let cropNum = 0; cropNum < crops.length; cropNum++) {
          const crop = crops[cropNum];

          if (crop.name === 'Beets') {
            simPlantings.push({
              crop,
              planting: {
                title: 'Golden Beets',
                cid: crop.id,
                age: 14,
                date: today.toString(),
                mad: 50,
                count: 9,
                area: 9 / crop.numSqFt,
              },
            });
            simPlantings.push({
              crop,
              planting: {
                title: 'Red Beets',
                cid: crop.id,
                age: 14,
                date: today.toString(),
                mad: 50,
                count: 9,
                area: 9 / crop.numSqFt,
              },
            });
          } else if (crop.name === 'Broccoli') {
            simPlantings.push({
              crop,
              planting: {
                title: 'Broccoli',
                cid: crop.id,
                age: 14,
                date: today.toString(),
                mad: 50,
                count: 1,
                area: 1 / crop.numSqFt,
              },
            });
          } else if (crop.name === 'Brussel Sprouts') {
            simPlantings.push({
              crop,
              planting: {
                title: 'Brussel Sprouts',
                cid: crop.id,
                age: 14,
                date: today.toString(),
                mad: 50,
                count: 1,
                area: 1 / crop.numSqFt,
              },
            });
          } else if (crop.name === 'Carrots') {
            simPlantings.push({
              crop,
              planting: {
                title: 'Nantes Carrots',
                cid: crop.id,
                age: 0,
                date: today.toString(),
                mad: 50,
                count: 16,
                area: 16 / crop.numSqFt,
              },
            });
            simPlantings.push({
              crop,
              planting: {
                title: 'Atomic Red Carrots',
                cid: crop.id,
                age: 0,
                date: today.toString(),
                mad: 50,
                count: 16,
                area: 16 / crop.numSqFt,
              },
            });
          } else if (crop.name === 'Chard') {
            simPlantings.push({
              crop,
              planting: {
                title: 'Swiss Chard',
                cid: crop.id,
                age: 14,
                date: today.toString(),
                mad: 50,
                count: 1,
                area: 1 / crop.numSqFt,
              },
            });
          } else if (crop.name === 'Cucumber') {
            simPlantings.push({
              crop,
              planting: {
                title: 'English Cucumber',
                cid: crop.id,
                age: 14,
                date: today.toString(),
                mad: 50,
                count: 2,
                area: 2 / crop.numSqFt,
              },
            });
          } else if (crop.name === 'Kale') {
            simPlantings.push({
              crop,
              planting: {
                title: 'Lacinato Kale',
                cid: crop.id,
                age: 14,
                date: today.toString(),
                mad: 50,
                count: 1,
                area: 1 / crop.numSqFt,
              },
            });
          } else if (crop.name === 'Lettuce') {
            simPlantings.push({
              crop,
              planting: {
                title: 'Gem Lettuce',
                cid: crop.id,
                age: 7,
                date: today.toString(),
                mad: 50,
                count: 12,
                area: 12 / crop.numSqFt,
              },
            });
            simPlantings.push({
              crop,
              planting: {
                title: 'Bib Lettuce',
                cid: crop.id,
                age: 7,
                date: today.toString(),
                mad: 50,
                count: 4,
                area: 4 / crop.numSqFt,
              },
            });
          } else if (crop.name === 'Peppers') {
            simPlantings.push({
              crop,
              planting: {
                title: 'Red Bell Peppers',
                cid: crop.id,
                age: 14,
                date: today.toString(),
                mad: 50,
                count: 1,
                area: 1 / crop.numSqFt,
              },
            });
            simPlantings.push({
              crop,
              planting: {
                title: 'Yellow Bell Peppers',
                cid: crop.id,
                age: 14,
                date: today.toString(),
                mad: 50,
                count: 1,
                area: 1 / crop.numSqFt,
              },
            });
            simPlantings.push({
              crop,
              planting: {
                title: 'Padrone Peppers',
                cid: crop.id,
                age: 14,
                date: today.toString(),
                mad: 50,
                count: 1,
                area: 1 / crop.numSqFt,
              },
            });
          } else if (crop.name === 'Spinach') {
            simPlantings.push({
              crop,
              planting: {
                title: 'Space Spinach',
                cid: crop.id,
                age: 7,
                date: today.toString(),
                mad: 50,
                count: 12,
                area: 12 / crop.numSqFt,
              },
            });
            simPlantings.push({
              crop,
              planting: {
                title: 'Carmel Spinach',
                cid: crop.id,
                age: 7,
                date: today.toString(),
                mad: 50,
                count: 12,
                area: 12 / crop.numSqFt,
              },
            });
          } else if (crop.name === 'Squash (summer)') {
            simPlantings.push({
              crop,
              planting: {
                title: 'Summer Squash',
                cid: crop.id,
                age: 12,
                date: today.toString(),
                mad: 50,
                count: 1,
                area: 1 / crop.numSqFt,
              },
            });
          } else if (crop.name === 'Tomato') {
            simPlantings.push({
              crop,
              planting: {
                title: 'Beefsteak Tomatoes',
                cid: crop.id,
                age: 21,
                date: today.toString(),
                mad: 50,
                count: 1,
                area: 1 / crop.numSqFt,
              },
            });
            simPlantings.push({
              crop,
              planting: {
                title: 'Roma Tomatoes',
                cid: crop.id,
                age: 21,
                date: today.toString(),
                mad: 50,
                count: 1,
                area: 1 / crop.numSqFt,
              },
            });
          }
        }
        done();
      });
    });

    it('should configure all plantings', async () => {
      for (let zid = 0; zid < plantedZones.length; zid++) {
        const zone = plantedZones[zid];
        for (let pid = 0; pid < simPlantings.length; pid++) {
          const { planting } = simPlantings[pid];
          const { crop } = simPlantings[pid];

          const cropLifeSpan = crop.initDay + crop.devDay + crop.midDay + crop.lateDay;
          if (cropLifeSpan > simPlantingsLifeSpan) {
            simPlantingsLifeSpan = cropLifeSpan;
          }

          planting.zid = zone.id;

          const result = await PlantingsInstance.setPlanting(planting);

          planting.id = result.id;
        }

        // Tell the zone of a planting change
        await ZonesInstance.updatePlantings([zone.id]);
      }
      console.log(`*** Simulation: Plantings ${simPlantings.length} Duration ${simPlantingsLifeSpan} days`);
    });
  });

  // Set the first process date to today
  const firstProcessDate = new Date(today);

  // Set the next schedule date to now + 5 seconds
  let nextScheduleDate = new Date(Date.now() + (5 * MilliPerSec));

  describe('Simulation Tests', () => {
    describe('Verify zone recharge after initial planting', () => {
      it('should find that sim zones have the appropriate plantings', async () => {
        for (let zid = 0; zid < plantedZones.length; zid++) {
          const zone = await ZonesInstance.getZone(plantedZones[zid].id);
          expect(zone).toBeDefined();
          expect(zone.plantings).toBe(simPlantings.length);
        }
      });

      it('should set zone start times to nextScheduleDate.time', async () => {
        for (let zid = 0; zid < plantedZones.length; zid++) {
          const zone = await ZonesInstance.getZone(plantedZones[zid].id);

          origZoneStarts.push(zone.start);

          zone.start = `${('0' + nextScheduleDate.getHours()).slice(-2)}:${('0' + nextScheduleDate.getMinutes()).slice(-2)}`;
          plantedZones[zid].start = zone.start;

          await ZonesInstance.setZone(zone);
        }
      });

      it('should schedule an event for zones', async () => {
        for (let zid = 0; zid < plantedZones.length; zid++) {
          const plantedZone = plantedZones[zid];

          // Make sure the zone's start time was set properly
          expect((await ZonesInstance.getZone(plantedZone.id)).start).toBe(plantedZone.start);

          eids = await VegableInstance.scheduleEvents(new Date(firstProcessDate),
            new Date(nextScheduleDate));
          expect(eids.length).toBe(plantedZones.length);

          events.push(...eids);

          event = await EventsInstance.findEvent(eids[0]);
          expect(event).toBeDefined();

          // record expected & actual fertilization
          for (let pid = 0; pid < simPlantings.length; pid++) {
            const simPlanting = simPlantings[pid];

            await expectFertilization(plantedZone,
              simPlanting.planting,
              simPlanting.crop,
              firstProcessDate);

            fertilizing = await actualFertilization(JSON.parse(event.fertilizer),
              simPlanting.planting,
              simPlanting.crop,
              firstProcessDate);
          }
        }
      });

      it('should have adjusted the simulation zones', async () => {
        for (let zid = 0; zid < plantedZones.length; zid++) {
          const plantedZone = await ZonesInstance.getZone(plantedZones[zid].id);
          expect(plantedZone.adjusted).toBe(firstProcessDate.getTime());

          plantedZones[zid] = plantedZone;
        }
      });

      it('should have started the event and zones should be running', function (done) {
        for (let zid = 0; zid < plantedZones.length; zid++) {
          let plantedZone = plantedZones[zid];

          const eventStarted = nextScheduleDate.getTime() - Date.now() + MilliPerSec;
          const eventEnded = (plantedZone.swhc / plantedZone.iph) * MilliPerHour;

          // Make sure the test doesn't timeout
          this.timeout(eventStarted + eventEnded + (5 * MilliPerSec));

          console.log(`**** Waiting ${(eventStarted / MilliPerSec).toFixed(0)} seconds for event to start ...`);

          setTimeout(async () => {
            plantedZone = await ZonesInstance.getZone(plantedZone.id);
            expect(plantedZone.status).toBe(true);
            masterZone = await ZonesInstance.getMasterZone();
            expect(masterZone.status).toBe(true);

            if (fertilizing) {
              console.log(`****** Applying Fertilizer (${event.fertilizer}) ...`);
            }

            fertilizerZone = await ZonesInstance.getFertilizerZone();
            expect(fertilizerZone.status).toBe(fertilizing);

            console.log(`**** Waiting ${(eventEnded / MilliPerSec).toFixed(0)} seconds for event to end ...`);

            setTimeout(async () => {
              plantedZone = await ZonesInstance.getZone(plantedZone.id);
              expect(plantedZone.availableWater.toFixed(1)).toBe(plantedZone.swhc.toFixed(1));
              expect(plantedZone.status).toBe(false);
              masterZone = await ZonesInstance.getMasterZone();
              expect(masterZone.status).toBe(false);
              fertilizerZone = await ZonesInstance.getFertilizerZone();
              expect(fertilizerZone.status).toBe(false);

              plantedZones[zid] = plantedZone;

              done();
            }, eventEnded);
          }, eventStarted);
        }
      });

      it(`should get one stats record from ${yesterday} to ${tomorrow}`, async () => {
        for (let zid = 0; zid < plantedZones.length; zid++) {
          const stats = await StatsInstance.getStats(plantedZones[zid].id, yesterday.getTime(),
            tomorrow.getTime());
          expect(stats).toBeDefined();
          expect(stats.length).toBe(1);
        }
      });
    }); // 'Verify zone recharge after initial planting'

    describe('Verify zone recharge throughout life of planting', function () {
      const processDates = [];
      let nextProcessDate = new Date(firstProcessDate);
      do {
        nextProcessDate.setDate(nextProcessDate.getDate() + 1);
        processDates.push(new Date(nextProcessDate));
      } while (processDates.length < simPlantingsLifeSpan);

      nextProcessDate = new Date(firstProcessDate);
      nextProcessDate.setDate(nextProcessDate.getDate() + 1);

      processDates.forEach((processDate) => {
        it('should deplete the soil and adjust the zone', async () => {
          let adjusted;

          nextScheduleDate = new Date(Date.now() + (5 * MilliPerSec));

          for (let zid = 0; zid < plantedZones.length; zid++) {
            let plantedZone = plantedZones[zid];

            adjusted = plantedZone.adjusted;

            plantedZone.start = `${('0' + nextScheduleDate.getHours()).slice(-2)}:${('0' + nextScheduleDate.getMinutes()).slice(-2)}`;

            await ZonesInstance.setZone(plantedZone);

            eids = await VegableInstance.scheduleEvents(new Date(processDate),
              new Date(nextScheduleDate));

            plantedZone = await ZonesInstance.getZone(plantedZone.id);

            // Make sure the zone was adjusted
            expect(plantedZone.adjusted).toBeGreaterThan(adjusted);

            adjusted = plantedZone.adjusted;

            if (typeof eids !== 'undefined' && eids.length === 1) {
              event = await EventsInstance.findEvent(eids[0]);
              expect(event).toBeDefined();

              for (let pid = 0; pid < simPlantings.length; pid++) {
                fertilizing = await actualFertilization(JSON.parse(event.fertilizer),
                  simPlantings[pid].planting, simPlantings[pid].crop, firstProcessDate);
              }
            }

            plantedZones[zid] = plantedZone;
          }
        });

        it('should create and start a recharge event if available water fell below MAD', function (done) {
          for (let zid = 0; zid < plantedZones.length; zid++) {
            let plantedZone = plantedZones[zid];

            if (plantedZone.availableWater <= (plantedZone.swhc * (plantedZone.mad / 100))) {
              madDays = Math.round(Math.abs(
                (nextProcessDate.getTime() - processDate.getTime()) / (MilliPerDay)
              ));
              console.log(`***** It took ${madDays} days to reach ${plantedZone.availableWater.toFixed(2)} inches (${plantedZone.mad}% of ${plantedZone.swhc} inches)`);
              console.log(`***** Your crops are ${((processDate.getTime() - firstProcessDate.getTime()) / MilliPerDay).toFixed(0)} days old!`);

              nextProcessDate = processDate;

              expect(eids).toBeDefined();
              expect(eids.length).toBe(1);

              events.push(...eids);

              const eventStarted = nextScheduleDate.getTime() - Date.now() + MilliPerSec;
              const eventEnded = ((plantedZone.swhc - plantedZone.availableWater) / plantedZone.iph)
                                  * MilliPerHour;

              // Make sure the test doesn't timeout
              this.timeout(eventStarted + eventEnded + (5 * MilliPerSec));

              console.log(`**** Waiting ${(eventStarted / MilliPerSec).toFixed(0)} seconds for event to start ...`);

              setTimeout(async () => {
                for (let pid = 0; pid < simPlantings.length; pid++) {
                  // record expected fertilization
                  await expectFertilization(plantedZone, simPlantings[pid].planting,
                    simPlantings[pid].crop, processDate);
                }
                plantedZone = await ZonesInstance.getZone(plantedZone.id);
                expect(plantedZone.status).toBe(true);
                masterZone = await ZonesInstance.getMasterZone();
                expect(masterZone.status).toBe(true);

                if (fertilizing) {
                  console.log(`****** Applying Fertilizer (${event.fertilizer}) ...`);
                }

                fertilizerZone = await ZonesInstance.getFertilizerZone();
                expect(fertilizerZone.status).toBe(fertilizing);

                console.log(`**** Waiting ${(eventEnded / MilliPerSec).toFixed(0)} seconds for event to end ...`);

                setTimeout(async () => {
                  plantedZone = await ZonesInstance.getZone(plantedZone.id);
                  expect(plantedZone.availableWater.toFixed(1)).toBe(plantedZone.swhc.toFixed(1));
                  expect(plantedZone.status).toBe(false);
                  masterZone = await ZonesInstance.getMasterZone();
                  expect(masterZone.status).toBe(false);
                  fertilizerZone = await ZonesInstance.getFertilizerZone();
                  expect(fertilizerZone.status).toBe(false);

                  plantedZones[zid] = plantedZone;

                  done();
                }, eventEnded);
              }, eventStarted);
            } else done();
          }
        });
      }); // forEach(processDate)
    });

    describe('Verify results and cleanup', async () => {
      it('should have equal recharge events sync and stats', async () => {
        for (let zid = 0; zid < plantedZones.length; zid++) {
          const plantedZone = plantedZones[zid];
          const stats = await StatsInstance.getStats(plantedZone.id, yesterday.getTime(),
            tomorrow.getTime());
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

          console.log(`****Zone(${plantedZone.id}) Results: Irrigated ${stats.length}x Gallons ${totalGals.toFixed(1)} Time ${(totalTime / MilliPerHour).toFixed(2)}hrs`);
          console.log(`                     Fertilized ${fertCount}x Fertilizer ${(totalN / fertCount).toFixed(0)}:${(totalP / fertCount).toFixed(0)}:${(totalK / fertCount).toFixed(0)}`);
          console.log(`                     Fertilizer Stages (exp/act): ${initFertExpect}/${initFertActual}x ${devFertExpect}/${devFertActual}x ${midFertExpect}/${midFertActual}x ${lateFertExpect}/${lateFertActual}x`);
        }
      });

      it('should no longer have any plantings', async () => {
        let result;
        for (let pid = 0; pid < simPlantings.length; pid++) {
          result = await PlantingsInstance.delPlanting(simPlantings[pid].planting);
        }

        // Tell the zone of a planting change
        await ZonesInstance.updatePlantings(result.zids);

        // Reset all zones
        for (let zid = 0; zid < plantedZones.length; zid++) {
          let zone = await ZonesInstance.getZone(plantedZones[zid].id);

          zone.start = origZoneStarts[zid];
          zone.availableWater = 0;
          zone.adjusted = 0;
          zone.fertilized = 0;
          await ZonesInstance.setZone(zone);

          zone = await ZonesInstance.getZone(zone.id);
          expect(zone.start).toBe(origZoneStarts[zid]);
          expect(zone.availableWater).toBe(0);
          expect(zone.adjusted).toBe(0);
          expect(zone.fertilized).toBe(0);
          expect(zone.plantings).toBe(0);
        }

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
  runTests,
};
