/**
 * Weather Tester
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
const expect = require('expect');

var Settings = require('../server/models/settings');
var Weather = require('../server/controllers/weather');

const runTests = () => {
  describe('Weather', () => {
    var start = new Date();
    start.setDate(start.getDate() - 9);

    var end = new Date();

    it (`should get daily ETo from ${start} to ${end}`, (done) => {
      Weather.getWeatherInstance(async (weather) => {
        var dailyETo = await weather.getDailyETo(start, end);

        expect(dailyETo.length).toBe(10);
        done();
      });
    });
  });
}

module.exports = {
  runTests
};
