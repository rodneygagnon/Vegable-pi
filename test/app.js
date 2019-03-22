/**
 * @file Test Harness
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const app = require('../server/app');

const Unit = require('./tests/unitTests');
const Api = require('./tests/apiTests');
const Functional = require('./tests/functionalTests');
const Longevity = require('./tests/longevityTests');
const Simulation = require('./tests/simTests');
const Config = require('./tests/configTests');

/** Separating the zones to isolate testing */
const unitTestZoneId = 3;
const functionalTestZoneId = 4;
const longevityTestZoneId = 5;

describe('Vegable Tests', async () => {
  await Unit.runTests(unitTestZoneId);
  await Api.runTests(app);
  await Functional.runTests(functionalTestZoneId, true); // with fertilizer
  await Functional.runTests(functionalTestZoneId, false); // without fertilizer
  await Longevity.runTests(longevityTestZoneId);
  await Simulation.runTests();
  await Config.runTests(false);
});
