/**
 * @file Test Harness
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */
'use strict';

var app = require('../server/app');

var Unit = require('./tests/unitTests');
var Api = require('./tests/apiTests');
var Functional = require('./tests/functionalTests');
var Longevity = require('./tests/longevityTests');

/** Separating the zones to isolate testing */
const unitTestZoneId = 3;
const functionalTestZoneId = 4;
const longevityTestZoneId = 5;

describe('Vegable Tests', async () => {
 await Unit.runTests(unitTestZoneId);
 await Api.runTests(app);
 await Functional.runTests(functionalTestZoneId);
 await Longevity.runTests(longevityTestZoneId);
});
