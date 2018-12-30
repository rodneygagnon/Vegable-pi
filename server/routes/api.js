/**
 * @file Vegable API Routes
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */
'use strict';

const express = require('express');
const router = express.Router();

const url = require('url');
const querystring = require('querystring');

const {SettingsInstance} = require('../models/settings');
const {CropsInstance} = require('../models/crops');
const {EventsInstance} = require('../models/events');
const {PlantingsInstance} = require('../models/plantings');
const {ZonesInstance} = require('../models/zones');
const {WeatherInstance} = require('../controllers/weather');

/*
 * Location APIs
 */

/**
 * Route to get location information.
 * @name location/get
 * @function
 * @returns {object} location - Address, City, State, Zip, ...
 */
router.route('/location/get').get(function (req, res) {
  SettingsInstance.getSettings((config) => {
    res.status(200).json(config);
  });
});

/**
 * Route to set location information.
 * @name location/set
 * @function
 * @param {object} location - Address, City, State, Zip, ...
 */
router.route('/location/set').post(function (req, res) {
  SettingsInstance.setLocation( req.body.address, req.body.city,
                                req.body.state, req.body.zip, req.body.etzone);
  res.status(200).end();
});

/*
 * Crops APIs
 */

/**
 * Route to get an individual or list of crops
 * @name crops/get
 * @function
 * @param {string} crop id - (optional) unique crop identifier
 * @returns {object} crop(s) - crop or crops[]
 */
router.route('/crops/get').get(async function (req, res) {
  if (typeof req.query === 'undefined' ||
      typeof req.query.id === 'undefined') {
    // Get all crops
    var crops = [];
    CropsInstance.getCrops((crops) => {
      res.status(200).json(crops);
    });
  } else {
    var crop = await CropsInstance.getCrop(req.query.id);
    res.status(crop != null ? 200 : 500).json(crop);
  }
});

/**
 * Route to set a crop
 * @name crops/set
 * @function
 * @param {object} crop - crop
 * @returns {object} result - { id: _crop id_ }
 */
router.route('/crops/set').post(async function (req, res) {
  var result;

  if (req.body.action === 'delete')
    result = await CropsInstance.delCrop(req.body.id);
  else
    result = await CropsInstance.setCrop(req.body);

  res.status(result !== null ? 200 : 500)
     .json({ id: result });
});

 /*
  * Events APIs
  */

/**
 * Route to get events within a given date range
 * @name events/get
 * @function
 * @param {date} start - start date
 * @param {date} end - end date
 * @returns {array} events[] - list of events
 */
router.route('/events/get').get(function (req, res) {
  var parsedUrl = url.parse(req.url);
  var parsedQs = querystring.parse(parsedUrl.query);

  var events = [];
  EventsInstance.getEvents(parsedQs.start, parsedQs.end, (events) => {
   res.status(200).json(events);
  });
});

/**
 * Route to create, update or delete an event
 * @name events/set
 * @function
 * @param {object} event - event to create, update or delete
 * @param {string} action - _null_ or _delete_
 * @returns {string} event id - id of event created, updated or deleted
 */
router.route('/events/set').post(async function (req, res) {
  var result;

  if (req.body.action === 'delete')
   result = await EventsInstance.delEvent(req.body);
  else {
   var zone = await ZonesInstance.getZone(req.body.sid);

   req.body.color = zone.color;
   req.body.textColor = zone.textColor;

   result = await EventsInstance.setEvent(req.body);
  }

  res.status(result !== null ? 200 : 500).json({ id: result });
});

/*
 * Plantings APIs
 */

/**
 * Route to get an individual or list of plantings
 * @name plantings/get
 * @function
 * @param {string} planting id - (optional) unique planting identifier
 * @returns {object} planting(s) - planting or plantings[]
 */
router.route('/plantings/get').get(async function (req, res) {
  if (typeof req.query === 'undefined' ||
     typeof req.query.id === 'undefined') {
   // Get all plantings
   var plantings = [];
   PlantingsInstance.getAllPlantings((plantings) => {
     res.status(200).json(plantings);
   });
  } else {
   var planting = await PlantingsInstance.getPlanting(req.query.id);
   res.status(planting != null ? 200 : 500).json(planting);
  }
});

/**
 * Route to create, update or delete an event
 * @name plantings/set
 * @function
 * @param {object} planting - planting to create, update or delete
 * @param {string} action - _null_ or _delete_
 * @returns {string} planting id - id of planting created, updated or deleted
 */
router.route('/plantings/set').post(async function (req, res) {
  var result;

  if (req.body.action === 'delete')
   result = await PlantingsInstance.delPlanting(req.body);
  else
   result = await PlantingsInstance.setPlanting(req.body);

  // Tell the zone of a planting change
  await ZonesInstance.updatePlantings(result.zids);

  res.status(result.zids !== null ? 200 : 500).json({ id: result.id });
});

/*
 * Zones APIs
 */

/**
 * Route to get all zones
 * @name zones/get
 * @function
 * @returns {array} zones - array of zones objects
 */
router.route('/zones/get').get(async function (req, res) {
  if (typeof req.query === 'undefined' ||
      typeof req.query.id === 'undefined') {
    res.status(200).json(await ZonesInstance.getAllZones());
  } else {
    var zone = await ZonesInstance.getZone(req.query.id);
    res.status(zone != null ? 200 : 500).json(zone);
  }
});

/**
 * Route to get planting zones
 * @name zones/get/planting
 * @function
 * @returns {array} zones - array of zones objects
 */
router.route('/zones/get/planting').get(function (req, res) {
  var zones = [];
  ZonesInstance.getPlantingZones((zones) => {
    res.status(200).json(zones);
  });
});

/**
 * Route to get control zones
 * @name zones/get/control
 * @function
 * @returns {array} zones - array of zones objects
 */
router.route('/zones/get/control').get(function (req, res) {
  var zones = [];
  ZonesInstance.getControlZones((zones) => {
    res.status(200).json(zones);
  });
});

/**
 * Route to set a zone
 * @name zone/set
 * @function
 * @param {object} zone - zone to set
 */
router.route('/zones/set').post(function (req, res) {
  ZonesInstance.setZone(req.body, (err) => {
    res.statusCode = (err === 0 ? 200 : 500);
  });
});

/**
 * Switch on/off a zone
 * @name zone/switch
 * @function
 * @param {number} zone id - id of zone to turn on/off
 */
router.route('/zones/switch').post(function (req, res) {
  ZonesInstance.switchZone(req.query.id, (status) => {
    res.status(200).json({ status: status });
  });
});

/*
 * Weather APIs
 */

/**
 * Route to get weather conditions
 * @name weather/get
 * @function
 * @returns {object} conditions - current weather conditions
 */
router.route('/weather/get').get(function (req, res) {
  var error, conditions;
  WeatherInstance.getConditions((error, conditions) => {
    res.status(200).json(conditions);
  });
});

module.exports = router;
