/*
 * Index Router
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
const express = require('express');
const router = express.Router();

const Users = require('../models/users');
const Zones = require('../models/zones');

const Weather = require('../controllers/weather');

var ZonesInstance;
var UsersInstance;

// GET home page
router.get('/', function(req, res, next) {
  // Make sure the user is logged in
  if (typeof req.user === 'undefined')
    res.redirect('/signin');
  else {
    Zones.getZonesInstance((ZonesInstance) => {
      var zones = [];
      ZonesInstance.getZones((zones) => {
        res.render('index', {title: 'Vegable', zones: zones, user: req.user });
      });
    });
  }
});

// GET sign in, up and out.
router.get('/signin', function(req, res, next) {
  res.render('signin');
});
router.get('/signup', function(req, res, next) {
  res.render('signup');
});
router.get('/signout', function(req, res, next) {
  req.logout();
  res.redirect('/signin');
});

// POST handle new user registration
router.post('/signup', function(req, res, next) {
  Users.getUsersInstance((UsersInstance) => {
    UsersInstance.updateUser(req.body, "" /* action */, (result) => {
      // TODO: check result of new user registration before redirecting
      res.redirect('/signin');
    });
  });
});

// service bootstrap-table's data-url
router.route('/getZones').get(function (req, res) {
  Zones.getZonesInstance((ZonesInstance) => {
    var zones = [];
    ZonesInstance.getZones((zones) => {
      res.statusCode = 200;
      return res.json(zones);
    });
  });
});

// service data call for skycon
router.route('/getConditions').get(function (req, res) {
  Weather.getWeatherInstance((WeatherInstance) => {
    var error, conditions;
    WeatherInstance.getConditions((error, conditions) => {
      res.statusCode = 200;
      return res.json(conditions);
    });
  });
});

// update zone name, desc, flow info
router.route('/post').post(function (req, res) {
  Zones.getZonesInstance((ZonesInstance) => {
    ZonesInstance.setZone(req.body, () => {
      res.redirect('/');
    });
  });
});

// ad hoc turning on/off zones
router.route('/enable/:id').post(function (req, res) {
  Zones.getZonesInstance((ZonesInstance) => {
    ZonesInstance.switchZone(req.params.id, () => {
      res.redirect('/');
    });
  });
});

module.exports = router;
