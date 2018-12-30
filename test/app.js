/**
 * Vegable App Test Harness
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */

var app = require('../server/app');

var Api = require('./testAPI');
var Core = require('./testCore');

describe('Vegable Tests', async () => {
  await Api.runTests(app);
  await Core.runTests();
});
