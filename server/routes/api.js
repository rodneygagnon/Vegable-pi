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
  let result;
  if (!validator.isEmpty(req.body.address) && !validator.isEmpty(req.body.city)
      && !validator.isEmpty(req.body.state) && validator.isPostalCode(req.body.zip, 'US')) {
    SettingsInstance.setLocation(req.body.address, req.body.city,
      req.body.state, req.body.zip,
      req.body.etzone);
    result = 200;
  } else {
    log.error(`api/location/set: Bad Request Data (${JSON.stringify(req.body)})`);
    result = 400;
  }
  res.status(result).end();
});

/**
 * Route to get ETr information.
 * @name api/etrs/get
 * @function
 * @returns {object} etrs ...
 */
router.route('/etrs/get').get((req, res) => {
  SettingsInstance.getETrs((etrs) => {
    res.status(200).json(etrs);
  });
});

/**
 * Route to set gardening practice.
 * @name practice/set
 * @function
 * @param {Number} practice - Practice
 */
router.route('/practice/set').post((req, res) => {
  let result;
  if (!validator.isEmpty(req.body.practice)) {
    SettingsInstance.setPractice(req.body.practice);
    result = 200;
  } else {
    log.error(`api/practice/set: Bad Request Data (${JSON.stringify(req.body)})`);
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
    if (validator.isUUID(req.query.id)) {
      const crop = await CropsInstance.getCrop(req.query.id);
      res.status(crop != null ? 200 : 500).json(crop);
    } else {
      log.error(`api/crops/get: Invalid Crop ID (${JSON.stringify(req.query)})`);
      res.status(400).end();
    }
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
  let result = null;
  let status = 200;

  if (req.body.action === 'delete') {
    if (validator.isUUID(req.body.id)) {
      result = await CropsInstance.delCrop(req.body.id);
    } else {
      log.error(`api/crops/set: Invalid Crop ID (${JSON.stringify(req.body)})`);
      status = 400;
    }
  } else {
    result = await CropsInstance.setCrop(req.body);
    if (result === null) {
      status = 500;
    }
  }

  res.status(status).json({ id: result });
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

  if (validator.isISO8601(parsedQs.start) && validator.isISO8601(parsedQs.end)) {
    EventsInstance.getEvents(parsedQs.start, parsedQs.end, (events) => {
      res.status(200).json(events);
    });
  } else {
    log.error(`api/events/get: Invalid Dates (${JSON.stringify(parsedQs)})`);
    res.status(400).end();
  }
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
  let status = 200;

  if (req.body.action === 'delete') {
    if (validator.isUUID(req.body.id)) {
      result = await EventsInstance.delEvent(req.body);
    } else {
      log.error(`api/events/set: Invalid Event ID (${JSON.stringify(req.body)})`);
      status = 400;
    }
  } else {
    const zone = await ZonesInstance.getZone(req.body.zid);
    if (zone === null) {
      log.error(`api/events/set: Invalid Zone ID (${JSON.stringify(req.body)})`);
      status = 400;
    } else {
      req.body.color = zone.color;
      req.body.textColor = zone.textColor;

      result = await EventsInstance.setEvent(req.body);
      if (result === null) {
        status = 500;
      }
    }
  }

  res.status(status).json({ id: result });
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
    if (validator.isUUID(req.query.id)) {
      const planting = await PlantingsInstance.getPlanting(req.query.id);
      res.status(planting != null ? 200 : 500).json(planting);
    } else {
      log.error(`api/plantings/get: Invalid Planting ID (${JSON.stringify(req.query)})`);
      res.status(400).end();
    }
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
  let result = null;
  let status = 200;

  if (req.body.action === 'delete') {
    if (validator.isUUID(req.body.id)) {
      result = await PlantingsInstance.delPlanting(req.body);
    } else {
      log.error(`api/plantings/set: Invalid Planting ID (${JSON.stringify(req.body)})`);
      status = 400;
    }
  } else {
    result = await PlantingsInstance.setPlanting(req.body);
    if (result === null) {
      status = 500;
    }
  }

  if (result !== null) {
    // Tell the zone of a planting change
    await ZonesInstance.updatePlantings(result.zids);
    res.status(status).json({ id: result.id });
  } else {
    res.status(status).end();
  }
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
  if (typeof req.query === 'undefined' || !validator.isNumeric(req.query.start)
      || !validator.isNumeric(req.query.stop)) {
    log.error(`api/stats/set: Invalid Stats Query (${JSON.stringify(req.query)})`);
    res.status(400).end();
  } else {
    res.status(200).json(
      await StatsInstance.getStats(req.query.zid, req.query.start, req.query.stop),
    );
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
    if (validator.isNumeric(req.query.id)) {
      const zone = await ZonesInstance.getZone(req.query.id);
      res.status(zone != null ? 200 : 500).json(zone);
    } else {
      log.error(`api/zones/get: Invalid Zone ID (${JSON.stringify(req.query)})`);
      res.status(400).end();
    }
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
  let status;
  if (validator.isNumeric(`${req.body.id}`)) {
    await ZonesInstance.setZone(req.body);
    status = 200;
  } else {
    log.error(`api/zones/set: Invalid Zone ID (${JSON.stringify(req.body)})`);
    status = 400;
  }
  res.status(status).end();
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
    res.status(200).json({ status });
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
