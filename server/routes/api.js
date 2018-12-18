/*
 * Index Router
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
const express = require('express');
const router = express.Router();

const url = require('url');
const querystring = require('querystring');

const Crops = require('../models/crops');
const Events = require('../models/events');
const Plantings = require('../models/plantings');
const Zones = require('../models/zones');
const Weather = require('../controllers/weather');

var ZonesInstance;
var CropsInstance;
var EventsInstance;
var PlantingsInstance;

router.route('/crops/get').get(function (req, res) {
  Crops.getCropsInstance((CropsInstance) => {
    var crops = [];
    CropsInstance.getAllCrops((crops) => {
      res.statusCode = 200;
      return res.json(crops);
    });
  });
});

router.route('/events/get').get(function (req, res) {
  let parsedUrl = url.parse(req.url);
  let parsedQs = querystring.parse(parsedUrl.query);

  Events.getEventsInstance((EventsInstance) => {
    var events = [];
    EventsInstance.getEvents(parsedQs.start, parsedQs.end, (events) => {
      res.statusCode = 200;
      return res.json(events);
    });
  });
});

router.route('/plantings/get').get(function (req, res) {
  Plantings.getPlantingsInstance((PlantingsInstance) => {
    var plantings = [];
    PlantingsInstance.getAllPlantings((plantings) => {
      res.statusCode = 200;
      return res.json(plantings);
    });
  });
});

// Get all zones
router.route('/zones/get').get(function (req, res) {
  Zones.getZonesInstance((ZonesInstance) => {
    var zones = [];
    ZonesInstance.getZones((zones) => {
      res.statusCode = 200;
      return res.json(zones);
    });
  });
});

// update zone name, desc, flow info
router.route('/zones/set').post(function (req, res) {
  Zones.getZonesInstance((ZonesInstance) => {
    ZonesInstance.setZone(req.body, (err) => {
      res.statusCode = (err === 0 ? 200 : 500);
    });
  });
});

// service data call for skycon
router.route('/weather/get').get(function (req, res) {
  Weather.getWeatherInstance((WeatherInstance) => {
    var error, conditions;
    WeatherInstance.getConditions((error, conditions) => {
      res.statusCode = 200;
      return res.json(conditions);
    });
  });
});

module.exports = router;
