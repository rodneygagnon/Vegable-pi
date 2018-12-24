/**
 * Vegable API Tester
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
 const request = require('supertest');
 const expect = require('expect');

var app = require('../server/app');

var addedCrop;

describe('API', () => {
  describe('Settings', () => {
    it ('should get location', (done) => {
      request(app)
        .get('/api/location/get')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(done);
    });

    it('should set location', (done) => {
      request(app)
        .post('/api/location/set')
        .send({ address: "1 Main Street",
                city: "Sebastopol",
                state: "CA",
                zip: 95472
              })
        .set('Accept', 'application/json')
        .expect(200)
        .end(done);
    });
  });

  describe('Crops', () => {
    it ('should get all crops', (done) => {
      request(app)
        .get('/api/crops/get')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(done);
    });

    it('should create a crop', (done) => {
      request(app)
        .post('/api/crops/set')
        .send({ name: "Test Crop",
                type: "Test Vegatable",
                initDay: 1,
                initKc: 2,
                devDay: 3,
                devKc: 4,
                midDay: 5,
                midKc: 6,
                lateDay: 7,
                lateKc: 8,
                totDay: 9,
                totKc: 10
              })
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect((res) => {
          addedCrop = res.body;
        })
        .expect(200)
        .end(done);
    });

    it ('should get a crop', (done) => {
      request(app)
        .get('/api/crops/get')
        .query({ id: `${addedCrop.id}` })
        .expect('Content-Type', /json/)
        .expect((res) => {})
        .expect(200)
        .end(done);
    });

    it('should delete a crop', (done) => {
      addedCrop.action = 'delete';
      request(app)
        .post('/api/crops/set')
        .send(addedCrop)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect((res) => {})
        .expect(200)
        .end(done);
    });

  });
});
