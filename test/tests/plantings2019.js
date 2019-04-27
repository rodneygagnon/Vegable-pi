/**
 * @file Simulation Test Suite
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const expect = require('expect');

/** Controllers */
// const { VegableInstance } = require('../../server/controllers/vegable');

/** Models */
const { ZonesInstance } = require('../../server/models/zones');
const { CropsInstance } = require('../../server/models/crops');
const { PlantingsInstance } = require('../../server/models/plantings');

/** Constants */
// const { MilliPerDay } = require('../../config/constants');
const { AppRateDripConversion } = require('../../config/constants');

const runTests = async () => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const plantedZones = [];
  const plantedZoneConfigs = [
    {
      name: 'Auto Water / Fertilizer',
      width: 5,
      length: 5,
      auto: true,
      fertilize: true,
      emitterCount: 36,
      emitterRate: 4,
      start: '04:00',
    },
    {
      name: 'Auto Water / No Fertilizer',
      width: 5,
      length: 5,
      auto: true,
      fertilize: false,
      emitterCount: 36,
      emitterRate: 4,
      start: '04:30',
    },
    {
      name: 'Manual Zone',
      width: 5,
      length: 5,
      auto: false,
      fertilize: false,
      emitterCount: 36,
      emitterRate: 4,
      start: '05:00',
    },
  ];

  // const origZoneStarts = [];

  const simPlantings = [];
  let simPlantingsLifeSpan = 180; // 6 Months

  // let fertilizing = false;
  // let initFertExpect = 0;
  // let devFertExpect = 0;
  // let midFertExpect = 0;
  // let lateFertExpect = 0;
  //
  // const expectFertilization = (zone, planting, crop, processDate) => {
  //   // Check if fertilizer zone should be on
  //   const lastFertilized = new Date(zone.fertilized);
  //   const plantingDate = new Date(planting.date);
  //   const age = planting.age + Math.round(Math.abs(
  //     (processDate.getTime() - plantingDate.getTime()) / (MilliPerDay)
  //   ));
  //   const lastAgeFertilized = (lastFertilized < plantingDate ? 0 : planting.age
  //               + Math.round(Math.abs((
  //                 lastFertilized.getTime() - plantingDate.getTime()) / (MilliPerDay))));
  //   const initStage = crop.initDay;
  //   const devStage = initStage + crop.devDay;
  //   const midStage = devStage + crop.midDay;
  //
  //   // console.log(`expectFertilization: age(${age}) lastFert(${lastAgeFertilized}) stages(${initStage}:${devStage}:${midStage})`);
  //
  //   if (age <= initStage) {
  //     if (crop.initFreq && lastAgeFertilized === 0) {
  //       // console.log(`initStage: n(${crop.initN}) p(${crop.initN}) k(${crop.initK})`);
  //       initFertExpect += 1;
  //     }
  //   } else if (age <= devStage) {
  //     if (crop.devFreq && lastAgeFertilized < initStage) {
  //       // console.log(`devStage: n(${crop.devN}) p(${crop.devN}) k(${crop.devK})`);
  //       devFertExpect += 1;
  //     }
  //   } else if (age <= midStage) {
  //     if (crop.midFreq && lastAgeFertilized < devStage) {
  //       // console.log(`midStage: n(${crop.midN}) p(${crop.midN}) k(${crop.midK})`);
  //       midFertExpect += 1;
  //     }
  //   } else {
  //     if (crop.midFreq && lastAgeFertilized < midStage) {
  //       // console.log(`lateStage: n(${crop.lateN}) p(${crop.lateN}) k(${crop.lateK})`);
  //       lateFertExpect += 1;
  //     }
  //   }
  // };
  //
  // let initFertActual = 0;
  // let devFertActual = 0;
  // let midFertActual = 0;
  // let lateFertActual = 0;
  //
  // const actualFertilization = (fertilizer, planting, crop, processDate) => {
  //   const fertilized = (fertilizer.n || fertilizer.p || fertilizer.k) ? true : false;
  //
  //   if (fertilized) {
  //     const plantingDate = new Date(planting.date);
  //     const age = planting.age + Math.round(Math.abs(
  //       (processDate.getTime() - plantingDate.getTime()) / (MilliPerDay)
  //     ));
  //
  //     const initStage = crop.initDay;
  //     const devStage = initStage + crop.devDay;
  //     const midStage = devStage + crop.midDay;
  //
  //     if (age <= initStage) {
  //       initFertActual += 1;
  //     } else if (age <= devStage) {
  //       devFertActual += 1;
  //     } else if (age <= midStage) {
  //       midFertActual += 1;
  //     } else {
  //       lateFertActual += 1;
  //     }
  //   }
  //
  //   return (fertilized);
  // };

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

};

module.exports = {
  runTests,
};
