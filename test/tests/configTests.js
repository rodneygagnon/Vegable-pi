/**
 * @file Unit Test Suite
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const expect = require('expect');
const moment = require('moment');

// Models
const { ZonesInstance } = require('../../server/models/zones');
const { CropsInstance } = require('../../server/models/crops');
const { EventsInstance } = require('../../server/models/events');
const { PlantingsInstance } = require('../../server/models/plantings');
const { StatsInstance } = require('../../server/models/stats');

const runTests = (clear) => {
  let crops;
  let tomatoCrop;
  let carrotCrop;
  let broccoliCrop;
  let cucumberCrop;
  let pepperCrop;
  let lettuceCrop;
  let beetsCrop;
  let spinachCrop;
  let melonCrop;
  let eggplantCrop;

  let plantings;
  let plantingZones;

  const today = new Date();
  const yesterday = new Date();
  const dayBeforeYesterday = new Date();
  const tomorrow = new Date();
  const dayAfterTomorrow = new Date();

  yesterday.setDate(today.getDate() - 1);
  dayBeforeYesterday.setDate(yesterday.getDate() - 1);
  tomorrow.setDate(today.getDate() + 1);
  dayAfterTomorrow.setDate(tomorrow.getDate() + 1);

  const fertilizerObj = {
    n: Number((1.1).toFixed(1)),
    p: Number((2.2).toFixed(1)),
    k: Number((3.3).toFixed(1))
  };
  const nofertilizerObj = {
    n: 0,
    p: 0,
    k: 0
  };

  describe('Zones', () => {
    it('should configure all planting zones', (done) => {
      const sampleZones = [
        { name: "4x8 Raised Beds", area: 32, emitterCount: 16, emitterRate: 1, start: "04:00" },
        { name: "3x9 Raised Beds", area: 27, emitterCount: 12, emitterRate: 1, start: "04:30" },
        { name: "Greens Field", area: 1000, emitterCount: 80, emitterRate: 1, start: "05:00" },
        { name: "Back Lot", area: 400, emitterCount: 32, emitterRate: 1, start: "05:30" },
        { name: "Side Lot", area: 250, emitterCount: 25, emitterRate: 1, start: "06:00" },
        { name: "Hothouse", area: 32, emitterCount: 16, emitterRate: 1, start: "06:30" }
      ];

      ZonesInstance.getPlantingZones(async (zones) => {
        for (let i = 0; i < zones.length; i++) {
          let zone = zones[i];
          zone.name = sampleZones[i].name;
          zone.area = sampleZones[i].area;
          zone.emitterCount = sampleZones[i].emitterCount;
          zone.emitterRate = sampleZones[i].emitterRate;
          zone.start = sampleZones[i].start;

          await ZonesInstance.setZone(zone);
        }
        plantingZones = zones;
        done();
      });
    });
  });

  describe('Plantings', () => {
    before ((done) => {
      // Get the crops and create a planting
      CropsInstance.getCrops(async (crops) => {

        for (var cropNum = 0; cropNum < crops.length; cropNum++) {
          var crop = crops[cropNum];

          if (crop.name === 'Broccoli') { broccoliCrop = crop; }
          else if (crop.name === 'Tomato') { tomatoCrop = crop; }
          else if (crop.name === 'Carrots') { carrotCrop = crop; }
          else if (crop.name === 'Cucumber') { cucumberCrop = crop; }
          else if (crop.name === 'Beets') { beetCrop = crop; }
          else if (crop.name === 'Peppers') { pepperCrop = crop; }
          else if (crop.name === 'Lettuce') { lettuceCrop = crop; }
          else if (crop.name === 'Spinach') { spinachCrop = crop; }
          else if (crop.name === 'Eggplant') { eggplantCrop = crop; }
          else if (crop.name === 'Melon') { melonCrop = crop; }
        }
        done();
      });
    });

    it('should configure all plantings', async () => {
      const samplePlantings = [
        { zid: 3, title: "Heirloom Tomatoes", cid: tomatoCrop.id, age: 21,
          date: dayBeforeYesterday.toString(), mad: 50, count: 4, spacing: 12 },
        { zid: 3, title: "Atomic Carrots", cid: carrotCrop.id, age: 0,
          date: dayBeforeYesterday.toString(), mad: 55, count: 48, spacing: 2 },
        { zid: 3, title: "Bell Peppers", cid: pepperCrop.id, age: 14,
          date: dayBeforeYesterday.toString(), mad: 60, count: 2, spacing: 12 },
        { zid: 3, title: "Padrone Peppers", cid: pepperCrop.id, age: 14,
          date: dayBeforeYesterday.toString(), mad: 60, count: 2, spacing: 12 },
        { zid: 4, title: "Gem Lettuce", cid: lettuceCrop.id, age: 7,
          date: yesterday.toString(), mad: 75, count: 12, spacing: 12 },
        { zid: 4, title: "Spinach", cid: spinachCrop.id, age: 7,
          date: yesterday.toString(), mad: 70, count: 12, spacing: 12 },
        { zid: 4, title: "Broccoli", cid: broccoliCrop.id, age: 14,
          date: yesterday.toString(), mad: 60, count: 2, spacing: 12 },
        { zid: 5, title: "Golden Beets", cid: beetCrop.id, age: 14,
          date: today.toString(), mad: 50, count: 6, spacing: 6 },
        { zid: 5, title: "Red Beets", cid: beetCrop.id, age: 14,
          date: today.toString(), mad: 50, count: 6, spacing: 6 },
        { zid: 5, title: "Italian Eggplant", cid: eggplantCrop.id, age: 14,
          date: today.toString(), mad: 50, count: 6, spacing: 6 },
        { zid: 6, title: "Armenian Cucumbers", cid: cucumberCrop.id, age: 14,
          date: today.toString(), mad: 55, count: 1, spacing: 24 },
        { zid: 6, title: "Lemon Cucumbers", cid: cucumberCrop.id, age: 14,
          date: today.toString(), mad: 55, count: 1, spacing: 24 },
        { zid: 7, title: "Honeydew", cid: melonCrop.id, age: 14,
          date: today.toString(), mad: 60, count: 2, spacing: 24 },
        { zid: 7, title: "Cantaloupe", cid: melonCrop.id, age: 12,
          date: today.toString(), mad: 60, count: 2, spacing: 24 },
        { zid: 7, title: "Watermelon", cid: melonCrop.id, age: 10,
          date: today.toString(), mad: 60, count: 1, spacing: 24 },
        { zid: 8, title: "Romaine Lettuce", cid: lettuceCrop.id, age: 14,
          date: today.toString(), mad: 70, count: 24, spacing: 12 },
        { zid: 8, title: "Summer Crisp", cid: lettuceCrop.id, age: 12,
          date: today.toString(), mad: 70, count: 24, spacing: 12 },
      ];

      for (let i = 0; i < samplePlantings.length; i++) {
        let planting = samplePlantings[i];
        const result = await PlantingsInstance.setPlanting(planting);

        // Tell the zone of a planting change
        await ZonesInstance.updatePlantings(result.zids);
      }
    });
  });

  describe('Events', () => {
    it(`should create 12 random events over 30 day period`, async () => {
      for (let events = 0; events < 12; events++) {
        const zone = Math.floor(Math.random() * 6);
        const day = Math.floor(Math.random() * 30);

        const start = new Date(dayBeforeYesterday);
        start.setDate(start.getDate() + day);

        const event = {
          zid: plantingZones[zone].id,
          title: `Irrigating ${plantingZones[zone].name}`,
          amt: 1,
          start: `${moment(start).format('MM/DD/YYYY hh:mm A')}`,
          repeatEnd: `${moment(start).format('MM/DD/YYYY')}`,
          fertilizer: JSON.stringify({ n: 0, p: 0, k: 0 })
        }

        await EventsInstance.setEvent(event);
      }
    });
  });


  describe('Stats Tests', () => {
    it(`should clear stats`, async () => {
      await StatsInstance.clearStats();
    });

    it(`should record stats`, async () => {
      if (!clear) {
        let start = new Date();
        start.setDate(start.getDate() - 6);

        let end = new Date(start);
        let statsZid = 3;
        let statsZid2 = 4;
        let statsZid3 = 6;

        // Save 5 days of stats for one zone.
        for (var i = 0; i < 5; i++) {
          await StatsInstance.saveStats(statsZid, end.getTime(), end.getTime(),
                                        i + 1, JSON.stringify(nofertilizerObj));
          if (i === 1) {
            await StatsInstance.saveStats(statsZid2, end.getTime(), end.getTime(),
                                          i + 2, JSON.stringify(fertilizerObj));
          }
          if (i === 4) {
            await StatsInstance.saveStats(statsZid3, end.getTime(), end.getTime(),
                                          i - 2, JSON.stringify(fertilizerObj));
          }
          end.setDate(end.getDate() + 1);
        }

        var stats = await StatsInstance.getStats(statsZid, start.getTime(), end.getTime());
        expect(stats).toBeDefined();
        expect(stats.length).toBe(5);
      }
    });
  });
};

module.exports = {
  runTests
};
