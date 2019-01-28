/**
 * @file Vegable API Routes
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const express = require('express');
const validator = require('validator');
const url = require('url');
const querystring = require('querystring');

const { log } = require('../controllers/logger');

const { SettingsInstance } = require('../models/settings');
const { CropsInstance } = require('../models/crops');
const { EventsInstance } = require('../models/events');
const { PlantingsInstance } = require('../models/plantings');
const { StatsInstance } = require('../models/stats');
const { ZonesInstance } = require('../models/zones');
const { WeatherInstance } = require('../controllers/weather');

/*
 * Location APIs
 */
const router = express.Router();

/**
 * Route to get location information.
 * @name api/location/get
 * @function
 * @returns {object} location - Address, City, State, Zip, ...
 */
router.route('/location/get').get((req, res) => {
  SettingsInstance.getSettings((config) => {
    res.status(200).json(config);
  });
});

/**
 * Route to set location information.
 * @name location/set
 * @function
 * @param {object} location - Address, City, State, Zip, ET Zone
 */
router.route('/location/set').post((req, res) => {
  var result;
  if (!validator.isEmpty(req.body.address) && !validator.isEmpty(req.body.city)
      && !validator.isEmpty(req.body.state) && validator.isPostalCode(req.body.zip, 'US')) {
    SettingsInstance.setLocation(req.body.address, req.body.city,
                                 req.body.state, req.body.zip,
                                 req.body.etzone);
    result = 200;
  } else {
    result = 400;
  }
  res.status(result).end();
});

/**
 * Route to set gardening practice.
 * @name practice/set
 * @function
 * @param {Number} practice - Practice
 */
router.route('/practice/set').post((req, res) => {
  var result;
  if (!validator.isEmpty(req.body.practice)) {
    SettingsInstance.setPractice(req.body.practice);
    result = 200;
  } else {
    result = 400;
  }
  res.status(result).end();
});

/*
 * Crops APIs
 */

/**
 * Route to get an individual or list of crops
 * @name api/crops/get
 * @function
 * @param {string} crop id - (optional) unique crop identifier
 * @returns {object} crop(s) - crop or crops[]
 */
router.route('/crops/get').get(async (req, res) => {
  if (typeof req.query === 'undefined' || typeof req.query.id === 'undefined') {
    // Get all crops
    CropsInstance.getCrops((crops) => {
      res.status(200).json(crops);
    });
  } else {
    const crop = await CropsInstance.getCrop(req.query.id);
    res.status(crop != null ? 200 : 500).json(crop);
  }
});

/**
 * Route to set a crop
 * @name api/crops/set
 * @function
 * @param {object} crop - crop
 * @param {string} action - _null_ or _delete_
 * @returns {object} result - { id: _crop id_ }
 */
router.route('/crops/set').post(async (req, res) => {
  let result;

  if (req.body.action === 'delete') {
    result = await CropsInstance.delCrop(req.body.id);
  } else {
    result = await CropsInstance.setCrop(req.body);
  }

  res.status(result !== null ? 200 : 500)
     .json({ id: result });
});

 /*
  * Events APIs
  */

/**
 * Route to get events within a given date range
 * @name api/events/get
 * @function
 * @param {date} start - start date
 * @param {date} end - end date
 * @returns {array} events[] - list of events
 */
router.route('/events/get').get((req, res) => {
  const parsedUrl = url.parse(req.url);
  const parsedQs = querystring.parse(parsedUrl.query);

  EventsInstance.getEvents(parsedQs.start, parsedQs.end, (events) => {
   res.status(200).json(events);
  });
});

/**
 * Route to create, update or delete an event
 * @name api/events/set
 * @function
 * @param {object} event - event to create, update or delete
 * @param {string} action - _null_ or _delete_
 * @returns {string} event id - id of event created, updated or deleted
 */
router.route('/events/set').post(async (req, res) => {
  let result;

  if (req.body.action === 'delete') {
    result = await EventsInstance.delEvent(req.body);
  } else {
    const zone = await ZonesInstance.getZone(req.body.zid);

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
 * @name api/plantings/get
 * @function
 * @param {string} planting id - (optional) unique planting identifier
 * @returns {object} planting(s) - planting or plantings[]
 */
router.route('/plantings/get').get(async (req, res) => {
  if (typeof req.query === 'undefined' || typeof req.query.id === 'undefined') {
   // Get all plantings
   PlantingsInstance.getAllPlantings((plantings) => {
     res.status(200).json(plantings);
   });
  } else {
   const planting = await PlantingsInstance.getPlanting(req.query.id);
   res.status(planting != null ? 200 : 500).json(planting);
  }
});

/**
 * Route to create, update or delete an event
 * @name api/plantings/set
 * @function
 * @param {object} planting - planting to create, update or delete
 * @param {string} action - _null_ or _delete_
 * @returns {string} planting id - id of planting created, updated or deleted
 */
router.route('/plantings/set').post(async (req, res) => {
  let result;

  if (req.body.action === 'delete') {
    result = await PlantingsInstance.delPlanting(req.body);
  } else {
    result = await PlantingsInstance.setPlanting(req.body);
  }

  // Tell the zone of a planting change
  await ZonesInstance.updatePlantings(result.zids);

  res.status(result.zids !== null ? 200 : 500).json({ id: result.id });
});

/*
 * Stats APIs
 */

/**
 * Route to get stats for a zone
 * @name api/stats/get
 * @function
 * @param {number} zone id - zone id
 * @returns {array} stats - array of stats objects
 */
router.route('/stats/get').get(async (req, res) => {
  if (typeof req.query === 'undefined' || typeof req.query.start === 'undefined'
      || typeof req.query.stop === 'undefined') {
    res.status(400);
    res.end();
  } else {
    res.status(200).json(await StatsInstance.getStats(req.query.zid, req.query.start,
                                                      req.query.stop));
  }
});

/**
 * Route to clear stats for a zone
 * @name api/stats/clear
 * @function
 * @param {number} zone id - zone id
 */
router.route('/stats/clear').post(async (req, res) => {
  await StatsInstance.clearStats();
  res.status(200);
  res.end();
});

/*
 * Zones APIs
 */

/**
 * Route to get all zones
 * @name api/zones/get
 * @function
 * @returns {array} zones - array of zones objects
 */
router.route('/zones/get').get(async (req, res) => {
  if (typeof req.query === 'undefined' || typeof req.query.id === 'undefined') {
    res.status(200).json(await ZonesInstance.getAllZones());
  } else {
    const zone = await ZonesInstance.getZone(req.query.id);
    res.status(zone != null ? 200 : 500).json(zone);
  }
});

/**
 * Route to get planting zones
 * @name api/zones/get/planting
 * @function
 * @returns {array} zones - array of zones objects
 */
router.route('/zones/get/planting').get((req, res) => {
  ZonesInstance.getPlantingZones((zones) => {
    res.status(200).json(zones);
  });
});

/**
 * Route to get control zones
 * @name api/zones/get/control
 * @function
 * @returns {array} zones - array of zones objects
 */
router.route('/zones/get/control').get((req, res) => {
  ZonesInstance.getControlZones((zones) => {
    res.status(200).json(zones);
  });
});

/**
 * Route to set a zone
 * @name api/zone/set
 * @function
 * @param {object} zone - zone to set
 */
router.route('/zones/set').post(async (req, res) => {
  await ZonesInstance.setZone(req.body);
  res.statusCode = 200;
});

/**
 * Switch on/off a zone
 * @name api/zone/switch
 * @function
 * @param {number} zone id - id of zone to turn on/off
 */
router.route('/zones/switch').post((req, res) => {
  // TODO: add ability to pass fertilizer
  ZonesInstance.switchZone(req.query.id, JSON.stringify({ n: 0, p: 0, k: 0 }), (status) => {
    res.status(200).json({ status: status });
  });
});

/*
 * Weather APIs
 */

/**
 * Route to get weather conditions
 * @name api/weather/get
 * @function
 * @returns {object} conditions - current weather conditions
 */
router.route('/weather/get').get((req, res) => {
  WeatherInstance.getCurrentConditions((error, conditions) => {
    res.status(200).json(conditions);
  });
});

/**
 * Route to get 7-day forecast conditions
 * @name api/forecast/get
 * @function
 * @returns {object} forecast - 7-day forecast weather conditions
 */
router.route('/forecast/get').get(async (req, res) => {
  const forecast = await WeatherInstance.getForecast();
  res.status(200).json(forecast);
});

module.exports = router;
