/**
 * @file Unit Test Suite
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
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

const runTests = (zoneId) => {
  var start = new Date(2018, 0, 16); // Jan 15
  var end = new Date(2018, 1, 15);  // Feb 15
  var expectedETr = /* jan 16-31*/ ((1.86 / 31) * 16) +
                    /* feb 1-15 */ ((2.24 / 28) * 15)

  var today = new Date();
  var yesterday = new Date();
  var tomorrow = new Date();

  yesterday.setDate(today.getDate() - 1);
  tomorrow.setDate(today.getDate() + 1);

  var fertilizerObj = { n: Number((1.1).toFixed(0)),
                        p: Number((2.2).toFixed(0)),
                        k: Number((3.3).toFixed(0))
                      };
  var noFertilizerObj = { n: Number((0).toFixed(0)),
                          p: Number((0).toFixed(0)),
                          k: Number((0).toFixed(0))
                        };

  describe('Unit Tests', () => {
    describe('Settings', () => {
      var address, city, state, zip, etzone, practice, vegable_time, lat, long;
      it ('should get address', async () => {
        address = await SettingsInstance.getAddress();
        expect(address).toBeDefined();
      });
      it ('should set address', async () => {
        await SettingsInstance.setAddress(address);
      });
      it ('should get city', async () => {
        city = await SettingsInstance.getCity();
        expect(city).toBeDefined();
      });
      it ('should set city', async () => {
        await SettingsInstance.setCity(city);
      });
      it ('should get state', async () => {
        state = await SettingsInstance.getState();
        expect(state).toBeDefined();
      });
      it ('should set state', async () => {
        await SettingsInstance.setState(state);
      });
      it ('should get zip', async () => {
        zip = await SettingsInstance.getZip();
        expect(zip).toBeDefined();
      });
      it ('should set zip', async () => {
        await SettingsInstance.setZip(zip);
      });
      it ('should get etzone', async () => {
        etzone = await SettingsInstance.getETZone();
        expect(etzone).toBeDefined();
      });
      it ('should set etzone', async () => {
        await SettingsInstance.setETZone(etzone);
      });
      it ('should get practice', async () => {
        practice = await SettingsInstance.getPractice();
        expect(practice).toBeDefined();
      });
      it ('should set practice', async () => {
        await SettingsInstance.setPractice(practice);
      });
      it ('should get vegable time', async () => {
        vegable_time = await SettingsInstance.getVegableTime();
        expect(vegable_time).toBeDefined();
      });
      it ('should set vegable time', async () => {
        await SettingsInstance.setVegableTime(vegable_time);
      });
      it ('should get lat', async () => {
        lat = await SettingsInstance.getLat();
        expect(lat).toBeDefined();
      });
      it ('should set lat', async () => {
        await SettingsInstance.setLat(lat);
      });
      it ('should get long', async () => {
        long = await SettingsInstance.getLong()
        expect(long).toBeDefined();
      });
      it ('should set long', async () => {
        await SettingsInstance.setLong(long);
      });
      it ('should get zones', async () => {
        expect(await SettingsInstance.getZones()).toBeDefined();
      });
      it ('should get mapbox key', async () => {
        expect(await SettingsInstance.getMapBoxKey()).toBeDefined();
      });
      it ('should get dark sky key', async () => {
        expect(await SettingsInstance.getDarkSkyKey()).toBeDefined();
      });
      it ('should get cimis key', async () => {
        expect(await SettingsInstance.getCimisKey()).toBeDefined();
      });
    });

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
      var weatherData = { eto: 1, solar: 2, wind: 3, precip: 4,
                          precipProb: 5, tempHi: 6, tempLo: 7, humidity: 8
                        }

      before (async () => {
        await WeatherInstance.clearWeatherData();
      });

      it (`should get daily ETo for from ${start} to ${end}`, async () => {
        var dailyETo = await WeatherInstance.getDailyETo(new Date(start), new Date(end));
        expect(dailyETo.length).toBe(31);
        expect(dailyETo.reduce(sum).toFixed(2)).toBe(String(expectedETr));
      });

      it ('should get current conditions', (done) => {
        WeatherInstance.getCurrentConditions((error, conditions) => {
          expect(conditions).toBeDefined();
          done();
        });
      });

      it ('should get DarkSky conditions from yesterday', (done) => {
        WeatherInstance.getDarkSkyConditions(yesterday, (conditions) => {
          expect(conditions).toBeDefined();
          done();
        });
      });

      it ('should get forecast', async () => {
        var forecast = await WeatherInstance.getForecast();
        expect(forecast).toBeDefined();
        expect(forecast.length).toBe(8);
      });

      it ('should get CIMIS conditions from yesterday', function (done) {
        this.timeout(3 * 1000);

        WeatherInstance.getCimisConditions(yesterday, (conditions) => {
          expect(conditions).toBeDefined();
          done();
        });
      });

      it ('should get/set complete conditions for yesterday', function (done) {
        this.timeout(3 * 1000);

        WeatherInstance.getWeatherData(yesterday, (conditions) => {
          expect(conditions).toBeDefined();
          expect(conditions.date).toBeDefined();
          expect(conditions.eto).toBeDefined();
          expect(conditions.solar).toBeDefined();
          expect(conditions.wind).toBeDefined();
          expect(conditions.precip).toBeDefined();
          expect(conditions.tempHi).toBeDefined();
          expect(conditions.tempLo).toBeDefined();
          expect(conditions.humidity).toBeDefined();
          done();
        });
      });

      it ('should set weather conditions for today', async () => {
        var conditions =  await WeatherInstance.setConditions(today, weatherData);
        expect(conditions).toBeDefined();
      });

      it ('should get weather conditions from yesterday to tomorrow', async () => {
        var dayBeforeYesterday = new Date(yesterday);
        dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 1);
        var conditions =  await WeatherInstance.getConditions(dayBeforeYesterday, tomorrow);
        expect(conditions).toBeDefined();
        expect(conditions.length).toBe(2);
      });

      after (async () => {
        await WeatherInstance.clearWeatherData();
      });
    });

    describe('Events', () => {
      var addedEvent = {
            sid: zoneId,
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
        await StatsInstance.saveStats(zoneId, started, stopped, 0,
                                      JSON.stringify(fertilizerObj));
      });

      it(`should get stats from ${yesterday} to ${tomorrow}`, async () => {
        var stats = await StatsInstance.getStats(zoneId, yesterday.getTime(), tomorrow.getTime());
        expect(stats).toBeDefined();
        expect(stats.length).toBeGreaterThan(0);
      });

      it(`should clear stats`, async () => {
        await StatsInstance.clearStats(zoneId);
      });
    });

    describe('Zones', () => {
      var zones, zone;
      var masterZone, fertilizerZone;

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
      it(`should set a zone`, async () => {
        await ZonesInstance.setZone(zone);
        // TODO: add setZone test for success/failure
      });
      it ('should switch a zone ON (w/out fertilizer)', (done) => {
        ZonesInstance.switchZone(zoneId, JSON.stringify(noFertilizerObj), async (status) => {
          expect(status).toBe(true);

          // MasterZone should also be on
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(true);

          done();
        });
      });
      it ('should switch a zone OFF (w/out fertilizer)', (done) => {
        ZonesInstance.switchZone(zoneId, JSON.stringify(noFertilizerObj), async (status) => {
          expect(status).toBe(false);

          // MasterZone should also turn off
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(false);

          done();
        });
      });
      it ('should switch a zone ON (w/ fertilizer)', (done) => {
        ZonesInstance.switchZone(zoneId, JSON.stringify(fertilizerObj), async (status) => {
          expect(status).toBe(true);

          // MasterZone and Fertilizer should also be on
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(true);
          fertilizerZone = await ZonesInstance.getFertilizerZone();
          expect(fertilizerZone.status).toBe(true);

          done();
        });
      });
      it ('should switch a zone OFF (w/ fertilizer)', (done) => {
        ZonesInstance.switchZone(zoneId, JSON.stringify(fertilizerObj), async (status) => {
          expect(status).toBe(false);

          // MasterZone and Fertilizer should also turn off
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(false);
          fertilizerZone = await ZonesInstance.getFertilizerZone();
          expect(fertilizerZone.status).toBe(false);

          done();
        });
      });
      it ('should switch Master and all other zones off', (done) => {
        // Turn on a planting zone and make sure master is on
        ZonesInstance.switchZone(zoneId, JSON.stringify(fertilizerObj), async (status) => {
          expect(status).toBe(true);

          // MasterZone and Fertilizer should also be on
          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(true);
          fertilizerZone = await ZonesInstance.getFertilizerZone();
          expect(fertilizerZone.status).toBe(true);

          // Turn off the master zone and make sure planting zone is off
          ZonesInstance.switchZone(masterZone.id, JSON.stringify(noFertilizerObj), async (status) => {
            expect(status).toBe(false);

            // Zone Id and Fertilizer should also be off
            zone = await ZonesInstance.getZone(zoneId);
            expect(zone.status).toBe(false);
            fertilizerZone = await ZonesInstance.getFertilizerZone();
            expect(fertilizerZone.status).toBe(false);

            done();
          });
        });
      });
      it ('should switch zone off but leave master on', (done) => {
        // Turn on a planting zone and make sure master is on
        ZonesInstance.switchZone(zoneId, JSON.stringify(noFertilizerObj), async (status) => {
          expect(status).toBe(true);

          masterZone = await ZonesInstance.getMasterZone();
          expect(masterZone.status).toBe(true);

          // Turn on another planting zone and make sure master is still on
          ZonesInstance.switchZone(zoneId + 1, false, async (status) => {
            expect(status).toBe(true);

            masterZone = await ZonesInstance.getMasterZone();
            expect(masterZone.status).toBe(true);

            // Turn off first planting zone and make sure master is still on
            ZonesInstance.switchZone(zoneId, JSON.stringify(noFertilizerObj), async (status) => {
              expect(status).toBe(false);

              masterZone = await ZonesInstance.getMasterZone();
              expect(masterZone.status).toBe(true);

              // Turn off second planting zone and make sure master is now off
              ZonesInstance.switchZone(zoneId + 1, JSON.stringify(noFertilizerObj), async (status) => {
                expect(status).toBe(false);

                masterZone = await ZonesInstance.getMasterZone();
                expect(masterZone.status).toBe(false);

                done();
              });
            });
          });
        });
      });
      it ('should only switch Master on and off', (done) => {
        ZonesInstance.switchZone(masterZone.id, JSON.stringify(fertilizerObj), async (status) => {
          expect(status).toBe(true);

          zones = await ZonesInstance.getZonesByStatus(true);
          expect(zones.length).toBe(1);

          ZonesInstance.switchZone(masterZone.id, JSON.stringify(noFertilizerObj), async (status) => {
            expect(status).toBe(false);
            done();
          });
        });
      });
      it ('should only switch Fertilizer on and off', (done) => {
        ZonesInstance.switchZone(fertilizerZone.id, JSON.stringify(fertilizerObj), async (status) => {
          expect(status).toBe(true);

          zones = await ZonesInstance.getZonesByStatus(true);
          expect(zones.length).toBe(1);

          ZonesInstance.switchZone(fertilizerZone.id, JSON.stringify(noFertilizerObj), async (status) => {
            expect(status).toBe(false);
            done();
          });
        });
      });
      it ('should reset all planting zones to their original states', (done) => {
        ZonesInstance.getPlantingZones(async (zones) => {
          for (var i = 0; i < zones.length; i++) {
            zone = zones[i];
            zone.availableWater = 0;
            zone.fertilized = 0;
            zone.adjusted = 0;
            await ZonesInstance.setZone(zone);
            await StatsInstance.clearStats(zone.id);
          }
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

      it ('should return crops', () => {
        return(crops);
      });
    });
  });
}

module.exports = {
  runTests
};
