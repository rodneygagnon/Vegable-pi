/**
 * Vegable App Test Harness
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

var app = require('../server/app');

var Unit = require('./tests/unitTests');
var Functional = require('./tests/functionalTests');
var Api = require('./tests/apiTests');

// Separating the zones to isolate testing
const unitTestZoneId = 3;
const functionalTestZoneId = 4;

describe('Vegable Tests', async () => {
 await Unit.runTests(unitTestZoneId);
 await Functional.runTests(functionalTestZoneId);
 await Api.runTests(app);
});
