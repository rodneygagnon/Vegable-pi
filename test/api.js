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
    var addedCrop = {
          name: "Test Crop",
          type: "Test Vegatable",
          initDay: 1,
          initKc: 2,
          devDay: 3,
          devKc: 4,
          midDay: 5,
          midKc: 6,
          lateDay: 7,
          lateKc: 8,
          totDay: 16,
          totKc: 100
        };

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
        .send(addedCrop)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect((res) => {
          addedCrop.id = res.body.id;
        })
        .expect(200)
        .end(done);
    });
    it('should update a crop', (done) => {
      addedCrop.name = "Updated Crop";
      request(app)
        .post('/api/crops/set')
        .send(addedCrop)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200, {id: addedCrop.id})
        .end(done);
    });
    it ('should get a crop', (done) => {
      request(app)
        .get('/api/crops/get')
        .query({ id: `${addedCrop.id}` })
        .expect('Content-Type', /json/)
        .expect(200, addedCrop)
        .end(done);
    });
    it('should delete a crop', (done) => {
      addedCrop.action = 'delete';
      request(app)
        .post('/api/crops/set')
        .send(addedCrop)
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200, {id: addedCrop.id})
        .end(done);
    });
  });

  describe('Zones', () => {
    var getZone;

    it ('should get all zones', (done) => {
      request(app)
        .get('/api/zones/get')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(done);
    });
    it ('should get planting zones', (done) => {
      request(app)
        .get('/api/zones/get/planting')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(done);
    });
    it ('should get control zones', (done) => {
      request(app)
        .get('/api/zones/get/control')
        .expect('Content-Type', /json/)
        .expect(200)
        .end(done);
    });
    it ('should get a zone', (done) => {
      request(app)
        .get('/api/zones/get')
        .query({ id: 3 })
        .expect('Content-Type', /json/)
        .expect((res) => {
          getZone = res.body;
        })
        .expect(200)
        .end(done);
    });
    it ('should set a zone', (done) => {
      request(app)
        .get('/api/zones/set')
        .send(getZone)
        .expect(200)
        .end(done);
    });
    it ('should switch a zone ON', (done) => {
      request(app)
        .post('/api/zones/switch')
        .query({ id: `${getZone.id}` })
        .expect('Content-Type', /json/)
        .expect(200, {status: true})
        .end(done);
    });
    it ('should switch a zone OFF', (done) => {
      request(app)
        .post('/api/zones/switch')
        .query({ id: `${getZone.id}` })
        .expect('Content-Type', /json/)
        .expect(200, {status: false})
        .end(done);
    });
  });
});
