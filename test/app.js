/**
 * Vegable App Test Harness
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

var app = require('../server/app');

var Unit = require('./tests/unitTests');
var Function = require('./tests/functionalTests');
var Api = require('./tests/apiTests');

describe('Vegable Tests', async () => {
 await Unit.runTests(3);
 await Function.runTests(4);
 await Api.runTests(app);
});
