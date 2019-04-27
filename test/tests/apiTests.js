/**
 * @file API Test Suite
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */
const request = require('supertest');
const moment = require('moment');

const runTests = async (app) => {
  describe('API Tests', () => {
    describe('Settings', () => {
      it('should get location', (done) => {
        request(app)
          .get('/api/location/get')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(done);
      });

      it('should set location', (done) => {
        request(app)
          .post('/api/location/set')
          .send({
            address: '1 Main Street',
            city: 'Sebastopol',
            state: 'CA',
            zip: '95472',
            etzone: 4,
          })
          .set('Accept', 'application/json')
          .expect(200)
          .end(done);
      });

      it('should set practice', (done) => {
        request(app)
          .post('/api/practice/set')
          .send({ practice: '0' })
          .set('Accept', 'application/json')
          .expect(200)
          .end(done);
      });
    });

    describe('Crops', () => {
      const addedCrop = {
        name: 'Test Crop',
        initDay: 1,
        initKc: 2,
        initN: 3,
        initP: 4,
        initK: 5,
        initFreq: 6,
        devDay: 7,
        devKc: 8,
        devN: 9,
        devP: 10,
        devK: 11,
        devFreq: 12,
        midDay: 13,
        midKc: 14,
        midN: 9,
        midP: 10,
        midK: 11,
        midFreq: 12,
        lateDay: 7,
        lateKc: 8,
        lateN: 9,
        lateP: 10,
        lateK: 11,
        lateFreq: 12,
      };

      it('should get all crops', (done) => {
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
        addedCrop.name = 'Updated Crop';
        request(app)
          .post('/api/crops/set')
          .send(addedCrop)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(200, { id: addedCrop.id })
          .end(done);
      });
      it('should get a crop', (done) => {
        request(app)
          .get('/api/crops/get')
          .query({ id: `${ addedCrop.id }` })
          .expect('Content-Type', /json/)
          .expect(200, addedCrop)
          .end(done);
      });
      it('should fail to get a bogus crop id', (done) => {
        request(app)
          .get('/api/crops/get')
          .query({ id: `0` })
          .expect(400)
          .end(done);
      });
      it('should delete a crop', (done) => {
        addedCrop.action = 'delete';
        request(app)
          .post('/api/crops/set')
          .send(addedCrop)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(200, { id: addedCrop.id })
          .end(done);
      });
      it('should fail to delete a bogus crop id', (done) => {
        addedCrop.action = 'delete';
        addedCrop.id = '0';
        request(app)
          .post('/api/crops/set')
          .send(addedCrop)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(400, { id: null })
          .end(done);
      });
    });

    describe('Zones', () => {
      let getZone;

      it('should get all zones', (done) => {
        request(app)
          .get('/api/zones/get')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(done);
      });
      it('should get planting zones', (done) => {
        request(app)
          .get('/api/zones/get/planting')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(done);
      });
      it('should get control zones', (done) => {
        request(app)
          .get('/api/zones/get/control')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(done);
      });
      it('should get a zone', (done) => {
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
      it('should set a zone', (done) => {
        getZone.auto = false;
        getZone.fertilize = false;
        request(app)
          .post('/api/zones/set')
          .send(getZone)
          .set('Accept', 'application/json')
          .expect(200)
          .end(done);
      });
      it('should get a changed zone', (done) => {
        request(app)
          .get('/api/zones/get')
          .query({ id: `${ getZone.id }` })
          .expect('Content-Type', /json/)
          .expect(200, getZone)
          .end(done);
      });
      it('should reset a zone', (done) => {
        getZone.auto = true;
        getZone.fertilize = true;
        request(app)
          .post('/api/zones/set')
          .send(getZone)
          .set('Accept', 'application/json')
          .expect(200)
          .end(done);
      });
      it('should fail to set a bogus zone', (done) => {
        getZone.id = 'zone1';
        request(app)
          .post('/api/zones/set')
          .send(getZone)
          .set('Accept', 'application/json')
          .expect(400)
          .end(done);
      });
      it('should fail to get a bogus zone', (done) => {
        request(app)
          .get('/api/zones/get')
          .query({ id: 'zone1' })
          .expect(400)
          .end(done);
      });
      it('should switch a zone ON', (done) => {
        request(app)
          .post('/api/zones/switch')
          .query({ id: 3 })
          .expect('Content-Type', /json/)
          .expect(200, { status: true })
          .end(done);
      });
      it('should switch a zone OFF', (done) => {
        request(app)
          .post('/api/zones/switch')
          .query({ id: 3 })
          .expect('Content-Type', /json/)
          .expect(200, { status: false })
          .end(done);
      });
    });

    describe('Stats', () => {
      const today = new Date();
      const yesterday = new Date();
      const tomorrow = new Date();

      yesterday.setDate(today.getDate() - 1);
      tomorrow.setDate(today.getDate() + 1);

      it('should get stats for a zone between two dates', (done) => {
        request(app)
          .get('/api/stats/get')
          .query({ zid: 3, start: yesterday.getTime(), stop: tomorrow.getTime() })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(done);
      });
      it('should fail to get stats for a zone between bad dates', (done) => {
        request(app)
          .get('/api/stats/get')
          .query({ zid: 3, start: 'start', stop: 'stop' })
          .expect(400)
          .end(done);
      });
      it('should clear stats for a zone', (done) => {
        request(app)
          .post('/api/stats/clear')
          .expect(200)
          .end(done);
      });
    });

    describe('Plantings', () => {
      let crops;
      const addedPlanting = {
        zid: 3,
        title: 'Test Planting',
        date: (new Date()).toString(),
        age: 1,
        mad: 50,
        count: 2,
      };

      it('should get all crops', (done) => {
        request(app)
          .get('/api/crops/get')
          .expect('Content-Type', /json/)
          .expect((res) => {
            crops = res.body;
            addedPlanting.cid = crops[0].id;
            addedPlanting.area = addedPlanting.count / crops[0].numSqFt;
          })
          .expect(200)
          .end(done);
      });

      it('should get all plantings', (done) => {
        request(app)
          .get('/api/plantings/get')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(done);
      });
      it('should create a planting', (done) => {
        request(app)
          .post('/api/plantings/set')
          .send(addedPlanting)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect((res) => {
            addedPlanting.id = res.body.id;
          })
          .expect(200)
          .end(done);
      });
      it('should update a planting', (done) => {
        addedPlanting.title = 'Updated Planting';
        request(app)
          .post('/api/plantings/set')
          .send(addedPlanting)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(200, { id: addedPlanting.id })
          .end(done);
      });
      it('should get a planting', (done) => {
        request(app)
          .get('/api/plantings/get')
          .query({ id: `${addedPlanting.id}` })
          .expect('Content-Type', /json/)
          .expect(200, addedPlanting)
          .end(done);
      });
      it('should fail to get a bogus planting', (done) => {
        request(app)
          .get('/api/plantings/get')
          .query({ id: '0' })
          .expect(400)
          .end(done);
      });
      it('should delete a planting', (done) => {
        addedPlanting.action = 'delete';
        request(app)
          .post('/api/plantings/set')
          .send(addedPlanting)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(200, { id: addedPlanting.id })
          .end(done);
      });
      it('should fail to delete a bogus planting', (done) => {
        addedPlanting.action = 'delete';
        addedPlanting.id = '0';
        request(app)
          .post('/api/plantings/set')
          .send(addedPlanting)
          .set('Accept', 'application/json')
          .expect(400)
          .end(done);
      });
    });

    describe('Events', () => {
      const addedEvent = {
        zid: 3,
        title: 'Test Event',
        start: (new Date()).toString(),
        amt: 1,
        fertilizer: JSON.stringify({ n: 0, p: 0, k: 0 }),
      };

      it('should create an event', (done) => {
        request(app)
          .post('/api/events/set')
          .send(addedEvent)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect((res) => {
            addedEvent.id = res.body.id;
          })
          .expect(200)
          .end(done);
      });
      it('should get events from start to end', (done) => {
        const start = new Date();
        const end = new Date();

        start.setDate(0);
        end.setDate(32);

        request(app)
          .get('/api/events/get')
          .query({
            start: `${moment(start).format('YYYY-MM-DD')}`,
            end: `${moment(end).format('YYYY-MM-DD')}`
          })
          .expect('Content-Type', /json/)
          .expect(200)
          .end(done);
      });
      it('should fail to get events from bogus dates', (done) => {
        request(app)
          .get('/api/events/get')
          .query({
            start: '0',
            end: '0'
          })
          .expect(400)
          .end(done);
      });
      it('should update an event', (done) => {
        addedEvent.title = 'Updated Event';
        request(app)
          .post('/api/events/set')
          .send(addedEvent)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(200, { id: addedEvent.id })
          .end(done);
      });
      it('should fail to update an event with a bad zone id', (done) => {
        addedEvent.zid = '999';
        request(app)
          .post('/api/events/set')
          .send(addedEvent)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(400)
          .end(done);
      });
      it('should delete an event', (done) => {
        addedEvent.action = 'delete';
        request(app)
          .post('/api/events/set')
          .send(addedEvent)
          .set('Accept', 'application/json')
          .expect('Content-Type', /json/)
          .expect(200, { id: addedEvent.id })
          .end(done);
      });
      it('should fail to delete a bogus event', (done) => {
        addedEvent.action = 'delete';
        addedEvent.id = '0';
        request(app)
          .post('/api/events/set')
          .send(addedEvent)
          .set('Accept', 'application/json')
          .expect(400)
          .end(done);
      });
    });

    describe('Weather', () => {
      it('should get current weather conditions', (done) => {
        request(app)
          .get('/api/weather/get')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(done);
      });

      it('should get weather forecast', (done) => {
        request(app)
          .get('/api/forecast/get')
          .expect('Content-Type', /json/)
          .expect(200)
          .end(done);
      });
    });
  });
};

module.exports = {
  runTests,
};
