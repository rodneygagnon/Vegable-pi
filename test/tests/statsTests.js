/**
 * @file Unit Test Suite
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const expect = require('expect');

// Models
const { StatsInstance } = require('../../server/models/stats');

const runTests = (clear) => {
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
