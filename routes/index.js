const express = require('express');
const router = express.Router();

const Stations = require('../model/stations');

var StationsInstance;

/* GET home page. */
router.get('/', function(req, res, next) {
  Stations.getStationsInstance((StationsInstance) => {
    var stations = [];
    StationsInstance.getStations((stations) => {
      res.render('index', {title: 'Vegable', stations: stations});
    });
  });
});

router.route('/getStations').get(function (req, res) {
  Stations.getStationsInstance((StationsInstance) => {
    var stations = [];
    StationsInstance.getStations((stations) => {
      res.statusCode = 200;
      return res.json(stations);
    });
  });
});

router.route('/post').post(function (req, res) {
  Stations.getStationsInstance((StationsInstance) => {
    StationsInstance.setStation(req.body, () => {
      res.redirect('/');
    });
  });
});

router.route('/enable/:id').post(function (req, res) {
  Stations.getStationsInstance((StationsInstance) => {
    StationsInstance.switchStation(req.params.id, () => {
      res.redirect('/');
    });
  });
});
module.exports = router;
