/**
 * Core Service Tester
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const expect = require('expect');

// Controllers
const {WeatherInstance} = require('../../server/controllers/weather');

// Models
const {SettingsInstance} = require('../../server/models/settings');
const {CropsInstance} = require('../../server/models/crops');
const {ETrInstance} = require('../../server/models/etr');
const {ZonesInstance} = require('../../server/models/zones');
const {EventsInstance} = require('../../server/models/events');
const {UsersInstance} = require('../../server/models/users');
const {StatsInstance} = require('../../server/models/stats');

const sum = (total, num) => {
  return total + num;
}

const runTests = () => {
  var start = new Date(2018, 0, 16); // Jan 15
  var end = new Date(2018, 1, 15);  // Feb 15
  var expectedETr = /* jan 16-31*/ ((1.86 / 31) * 16) +
                    /* feb 1-15 */ ((2.24 / 28) * 15)

  var today = new Date();
  var yesterday = new Date();
  var tomorrow = new Date();

  yesterday.setDate(today.getDate() - 1);
  tomorrow.setDate(today.getDate() + 1);

  describe('Unit Tests', () => {
    describe('Users', () => {
      it ('should get all users', (done) => {
        UsersInstance.getUsers((usersdb) => {
          expect(usersdb).toBeDefined();
          done();
        });
      });

      it ('should get demo user', async () => {
        var demoUser = await UsersInstance.getUser(await SettingsInstance.getDefaultEmail());
        expect(demoUser).toBeDefined();
      });
    });

    describe('ETr', () => {
      var etzone = 4;
      var etrzone = { "zone": 4, "title": "South Coast Inland Plains and Mountains North of San Francisco",
                    	"desc": "More sunlight and higher summer ETo than one 3",
                    	"jan": 1.86, "feb": 2.24, "mar": 3.41, "apr": 4.5, "may": 5.27,
                    	"jun": 5.7, "jul": 5.89, "aug": 5.58, "sep": 4.5, "oct": 3.41,
                    	"nov": 2.4, "dec": 1.86, "tot": 46.62
                    }
      it (`should get daily ETr table entry for zone ${etzone}`, async () => {
        var etr = await ETrInstance.getETr(etzone);
        expect(etr).toEqual(etrzone);
      });

      it (`should get daily ETr for zone ${etzone} from ${start} to ${end}`, async () => {
        var dailyETr = await ETrInstance.getDailyETr(etzone, new Date(start), new Date(end));
        expect(dailyETr.length).toBe(31);
        expect(dailyETr.reduce(sum).toFixed(2)).toBe(String(expectedETr));
      });
    });

    describe('Weather', () => {
      it (`should get daily ETo for from ${start} to ${end}`, async () => {
        var dailyETo = await WeatherInstance.getDailyETo(new Date(start), new Date(end));
        expect(dailyETo.length).toBe(31);
        expect(dailyETo.reduce(sum).toFixed(2)).toBe(String(expectedETr));
      });

      it ('should get conditions', (done) => {
        WeatherInstance.getConditions((error, conditions) => {
          expect(conditions).toBeDefined();
          done();
        });
      });

      it ('should get CIMIS conditions', (done) => {
        WeatherInstance.getCimisConditions('2018-01-01', (error, conditions) => {
          expect(conditions).toBeDefined();
          done();
        });
      });

    });

    describe('Crops', () => {
      var crops, crop;

      it ('should get all crops', (done) => {
        CropsInstance.getCrops((result) => {
          expect(result).toBeDefined();
          crops = result;
          crop = crops[0];
          done();
        });
      });

      it ('should get a single crop', async () => {
        expect(await CropsInstance.getCrop(crop.id)).toEqual(crop);
      });

      it ('should set a crop', async () => {
        var cropId = crop.id;
        crop.id = await CropsInstance.setCrop(crop);
        expect(crop.id).toBe(cropId);
      });

      it ('should create a crop', async () => {
        delete crop.id;
        crop.id = await CropsInstance.setCrop(crop);
        expect(crop.id).toBeDefined();
      });

      it ('should delete a crop', async () => {
        expect(await CropsInstance.delCrop(crop.id)).toBe(crop.id);
      });

    });

    describe('Events', () => {
      var addedEvent = {
            sid: 3,
            title: "Test Event",
            amt: 1,
            fertilize: false,
          };

      // Test single events
      it(`should create and delete a single event for yesterday ${yesterday}`, async () => {
        addedEvent.start = yesterday.toString();
        addedEvent.id = await EventsInstance.setEvent(addedEvent);
        expect(addedEvent.id).toBeDefined();
        expect(await EventsInstance.delEvent(addedEvent)).toBe(addedEvent.id);
        delete addedEvent.id;
      });

      it(`should create and delete a single event for tomorrow ${tomorrow}`, async () => {
        addedEvent.start = tomorrow.toString();
        addedEvent.id = await EventsInstance.setEvent(addedEvent);
        expect(addedEvent.id).toBeDefined();
        expect(await EventsInstance.delEvent(addedEvent)).toBe(addedEvent.id);
        delete addedEvent.id;
      });

      // Test repeating events
      it(`should create and delete a repeating event (1 day) for yesterday ${yesterday} that ends yesterday ${yesterday}`, async () => {
        addedEvent.start = yesterday.toString();
        addedEvent.repeatEnd = yesterday.toString();
        addedEvent.repeat = 1; // only repeat on 1 day
        addedEvent.id = await EventsInstance.setEvent(addedEvent);
        expect(addedEvent.id).toBeDefined();
        expect(await EventsInstance.delEvent(addedEvent)).toBe(addedEvent.id);
        delete addedEvent.id;
      });

      it(`should create and delete a repeating event (few days) for yesterday ${yesterday} that ends tomorrow ${tomorrow}`, async () => {
        addedEvent.start = yesterday.toString();
        addedEvent.repeatEnd = tomorrow.toString();
        addedEvent.repeat = [2, 4, 6]; // repeat on a few days
        addedEvent.id = await EventsInstance.setEvent(addedEvent);
        expect(addedEvent.id).toBeDefined();
        expect(await EventsInstance.delEvent(addedEvent)).toBe(addedEvent.id);
        delete addedEvent.id;
      });

      it(`should create and delete a repeating event (every day) for tomorrow ${tomorrow} that ends tomorrow ${tomorrow}`, async () => {
        addedEvent.start = tomorrow.toString();
        addedEvent.repeatEnd = tomorrow.toString();
        addedEvent.repeat = [0, 1, 2, 4, 3, 4, 5, 6]; // repeat on all days
        addedEvent.id = await EventsInstance.setEvent(addedEvent);
        expect(addedEvent.id).toBeDefined();
        expect(await EventsInstance.delEvent(addedEvent)).toBe(addedEvent.id);
        delete addedEvent.id;
      });
    });

    describe('Stats', () => {
      var zoneId = 0;
      var started = today.getTime();
      var stopped = today.getTime();

      it(`should save stats for ${today}`, async () => {
        await StatsInstance.saveStats(zoneId, started, stopped, 0, false);
      });

      it(`should get stats from ${yesterday} to ${tomorrow}`, async () => {
        var stats = await StatsInstance.getStats(zoneId, yesterday.getTime(), tomorrow.getTime());
        expect(stats).toBeDefined();
        expect(stats.length).toBeGreaterThan(0);
      });
    });

    describe('Zones', () => {
      var zones, zone;

      it(`should get all zones`, async () => {
        zones = await ZonesInstance.getAllZones();
        expect(zones).toBeDefined();
      });
      it(`should get control zones (2)`, (done) => {
        ZonesInstance.getControlZones((zones) => {
          expect(zones.length).toBe(2);
          done();
        });
      });
      it(`should get planting zones (6)`, (done) => {
        ZonesInstance.getPlantingZones((zones) => {
          expect(zones.length).toBe(6);
          done();
        });
      });
      it(`should get a zone`, async () => {
        zone = await ZonesInstance.getZone(zones[0].id);
        expect(zone.id).toBe(zones[0].id);
      });
      it(`should set a zone`, (done) => {
        ZonesInstance.setZone(zone, () => {
          // TODO: add setZone test for success/failure
          done();
        });
      });
      it ('should switch a zone ON', (done) => {
        ZonesInstance.switchZone(zones[0].id, (status) => {
          expect(status).toBe(true);
          done();
        });
      });
      it ('should switch a zone OFF', (done) => {
        ZonesInstance.switchZone(zones[0].id, (status) => {
          expect(status).toBe(false);
          done();
        });
      });
    });
  });
}

module.exports = {
  runTests
};
