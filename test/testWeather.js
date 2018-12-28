/**
 * Weather Tester
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
const expect = require('expect');

var Settings = require('../server/models/settings');
var Crops = require('../server/models/crops');
var Plantings = require('../server/models/plantings');
var ETr = require('../server/models/etr');
var Weather = require('../server/controllers/weather');

const sum = (total, num) => {
  return total + num;
}

const runTests = () => {
  var start = new Date(2018, 0, 16); // Jan 15
  var end = new Date(2018, 1, 15);  // Feb 15
  var expectedETr = /* jan 16-31*/ ((1.86 / 31) * 16) +
                    /* feb 1-15 */ ((2.24 / 28) * 15)
  var dailyETo;

  describe('Weather', () => {
    var etzone = 4;
    var etrzone = { "zone": 4, "title": "South Coast Inland Plains and Mountains North of San Francisco",
                  	"desc": "More sunlight and higher summer ETo than one 3",
                  	"jan": 1.86, "feb": 2.24, "mar": 3.41, "apr": 4.5, "may": 5.27,
                  	"jun": 5.7, "jul": 5.89, "aug": 5.58, "sep": 4.5, "oct": 3.41,
                  	"nov": 2.4, "dec": 1.86, "tot": 46.62
                  }
    it (`should get daily ETr table entry for zone ${etzone}`, (done) => {
      ETr.getETrInstance(async (etr) => {
        expect(await etr.getETr(etzone)).toEqual(etrzone);
        done();
      });
    });

    it (`should get daily ETr for zone ${etzone} from ${start} to ${end}`, (done) => {
      ETr.getETrInstance(async (etr) => {
        var dailyETr = await etr.getDailyETr(etzone, new Date(start), new Date(end));

        expect(dailyETr.length).toBe(31);
        expect(dailyETr.reduce(sum).toFixed(2)).toBe(String(expectedETr));
        done();
      });
    });

    it (`should get daily ETo for zone ${etzone} from ${start} to ${end}`, (done) => {
      Weather.getWeatherInstance(async (weather) => {
        dailyETo = await weather.getDailyETo(new Date(start), new Date(end));

        expect(dailyETo.length).toBe(31);
        expect(dailyETo.reduce(sum).toFixed(2)).toBe(String(expectedETr));
        done();
      });
    });
  });

  describe('Plantings', () => {
    var crops;
    var plantingZone = 3;
    var addedPlanting = {
          zid: plantingZone,
          title: "Test Planting",
          date: start.toString(),
          mad: 50,
          count: 2,
          spacing: 12
        };

    it ('should get all crops', (done) => {
      Crops.getCropsInstance((CropsInstance) => {
        CropsInstance.getCrops((cropsdb) => {
          expect(cropsdb).toBeDefined();
          crops = cropsdb;
          addedPlanting.cid = crops[0].id;
          addedPlanting.age = crops[0].initDay + crops[0].devDay - 7; // ensure we span stages (dev & mid)
          done();
        });
      });
    });

    it('should create a planting', (done) => {
      Plantings.getPlantingsInstance(async (PlantingsInstance) => {
        var result = await PlantingsInstance.setPlanting(addedPlanting);

        expect(result).toBeDefined();
        addedPlanting.id = result.id;
        done();
      });
    });

    it (`should get daily ETc for all plantings in zone ${plantingZone} from ${start} to ${end}`, (done) => {
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

      Plantings.getPlantingsInstance(async (PlantingsInstance) => {
        PlantingsInstance.getETcByZone(plantingZone, new Date(start), new Date(end), (dailyETc) => {
          expect(dailyETc.toFixed(2)).toBe(expectedETc.toFixed(2));
          done();
        })
      });
    });

    it('should delete a planting', (done) => {
      Plantings.getPlantingsInstance(async (PlantingsInstance) => {
        var result = await PlantingsInstance.delPlanting(addedPlanting);

        expect(result).toBeDefined();
        addedPlanting.id = result.id;
        done();
      });
    });
  });
}

module.exports = {
  runTests
};
