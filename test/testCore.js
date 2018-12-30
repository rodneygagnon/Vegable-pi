/**
 * Weather Tester
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const expect = require('expect');

// Controllers
const {VegableInstance} = require('../server/controllers/vegable');
const {WeatherInstance} = require('../server/controllers/weather');

// Models
const {SettingsInstance} = require('../server/models/settings');
const {CropsInstance} = require('../server/models/crops');
const {PlantingsInstance} = require('../server/models/plantings');
const {ETrInstance} = require('../server/models/etr');
const {ZonesInstance} = require('../server/models/zones');
const {EventsInstance} = require('../server/models/events');
const {UsersInstance} = require('../server/models/users');

const sum = (total, num) => {
  return total + num;
}

const runTests = () => {
  var start = new Date(2018, 0, 16); // Jan 15
  var end = new Date(2018, 1, 15);  // Feb 15
  var expectedETr = /* jan 16-31*/ ((1.86 / 31) * 16) +
                    /* feb 1-15 */ ((2.24 / 28) * 15)
  var dailyETo;

  var crops;
  var zone;
  var plantingZone = 3;
  var addedPlanting = {
        zid: plantingZone,
        title: "Test Planting",
        date: start.toString(),
        mad: 50,
        count: 2,
        spacing: 12
      };

  describe('Core Service', () => {
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

      it (`should get daily ETo for zone ${etzone} from ${start} to ${end}`, async () => {
        dailyETo = await WeatherInstance.getDailyETo(new Date(start), new Date(end));
        expect(dailyETo.length).toBe(31);
        expect(dailyETo.reduce(sum).toFixed(2)).toBe(String(expectedETr));
      });
    });

    describe('Plantings', () => {
      it ('should get all crops', (done) => {
        CropsInstance.getCrops((cropsdb) => {
          expect(cropsdb).toBeDefined();
          crops = cropsdb;
          addedPlanting.cid = crops[0].id;
          addedPlanting.age = crops[0].initDay + crops[0].devDay - 7; // ensure we span stages (dev & mid)
          done();
        });
      });

      it('should create a planting', async () => {
        var result = await PlantingsInstance.setPlanting(addedPlanting);

        expect(result).toBeDefined();
        addedPlanting.id = result.id;

        // Tell the zone of a planting change
        await ZonesInstance.updatePlantings(result.zids);
      });

      it (`should get daily ETc for all plantings in zone ${plantingZone} from ${start} to ${end}`, async () => {
        var expectedETc = 0;
        var age = addedPlanting.age;
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

        var dailyETc = await PlantingsInstance.getETcByZone(plantingZone, new Date(start), new Date(end));
        expect(dailyETc.toFixed(2)).toBe(expectedETc.toFixed(2));
      });

    });

    describe('Events', () => {
      var today = new Date();
      var yesterday = new Date();
      var tomorrow = new Date();

      yesterday.setDate(today.getDate() - 1);
      tomorrow.setDate(today.getDate() + 1);

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

    describe('Zones', () => {
      var eids;

      it(`should find that zone ${plantingZone} has a planting`, async () => {
        zone = await ZonesInstance.getZone(plantingZone);
        expect(zone).toBeDefined();
        expect(zone.plantings).toBe(1);
      });

      it(`should schedule an event for zone ${plantingZone}`, async () => {
        eids = await VegableInstance.scheduleEvents(new Date());
        expect(eids.length).toBe(1);
      });

      it(`should delete the events scheduled for zone ${plantingZone}`, async () => {
        for (var i = 0; i < eids.length; i++) {
          var event = await EventsInstance.findEvent(eids[i]);

          expect(event).toBeDefined();
          expect(await EventsInstance.delEvent(event)).toBe(eids[i]);
        }
      });

      it('should delete a planting', async () => {
        var result = await PlantingsInstance.delPlanting(addedPlanting);

        expect(result).toBeDefined();
        expect(result.id).toBe(addedPlanting.id);

        // Tell the zone of a planting change
        await ZonesInstance.updatePlantings(result.zids);
      });

    });
  });
}

module.exports = {
  runTests
};
