/**
 * Vegable API Tester
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
 const request = require('supertest');
 const expect = require('expect');

var app = require('../server/app');

describe('API', () => {
  describe('Crops', () => {
    it ('should return the crops', (done) => {
      request(app)
        .get('/api/crops/get')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(done);
    });
  });
});
