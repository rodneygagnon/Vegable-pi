/**
 * @file Vegable APIs
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */
const express = require('express');
const router = express.Router();

const url = require('url');
const querystring = require('querystring');

const Settings = require('../models/settings');
const Crops = require('../models/crops');
const Events = require('../models/events');
const Plantings = require('../models/plantings');
const Zones = require('../models/zones');
const Weather = require('../controllers/weather');

var SettingsInstance;
var ZonesInstance;
var CropsInstance;
var EventsInstance;
var PlantingsInstance;

/****************
 ** Location APIs **
 ****************/

/**
 * Get location
 *
 * @returns {location}
 */
router.route('/location/get').get(function (req, res) {
  Settings.getSettingsInstance((SettingsInstance) => {
    SettingsInstance.getSettings((config) => {
      res.status(200).json(config);
    });
  });
});

/**
 * Set location
 *
 * @param {location}
 */
router.route('/location/set').post(function (req, res) {
  Settings.getSettingsInstance((SettingsInstance) => {
    SettingsInstance.setLocation( req.body.address,
                                  req.body.city,
                                  req.body.state,
                                  req.body.zip);
    res.status(200).end();
  });
 });

/****************
 ** Crops APIs **
 ****************/

/**
 * Returns Individual or list of crops
 *
 * @param {cid} Crop Id
 * @returns {crop or crops[]}
 */
router.route('/crops/get').get(function (req, res) {
  Crops.getCropsInstance(async (CropsInstance) => {
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
});

/**
 * Create, update or delete a crop
 *
 * @param {crop} Crop
 * @returns {id}
 */
router.route('/crops/set').post(function (req, res) {
  Crops.getCropsInstance(async (CropsInstance) => {
    var result;

    if (req.body.action === 'delete')
      result = await CropsInstance.delCrop(req.body.id);
    else
      result = await CropsInstance.setCrop(req.body);

    res.status(result !== null ? 200 : 500)
       .json({ id: result });
  });
 });

 /**
  * Event APIs
  */
router.route('/events/get').get(function (req, res) {
  let parsedUrl = url.parse(req.url);
  let parsedQs = querystring.parse(parsedUrl.query);

  Events.getEventsInstance((EventsInstance) => {
    var events = [];
    EventsInstance.getEvents(parsedQs.start, parsedQs.end, (events) => {
      res.status(200).json(events);
    });
  });
});

router.route('/plantings/get').get(function (req, res) {
  Plantings.getPlantingsInstance((PlantingsInstance) => {
    var plantings = [];
    PlantingsInstance.getAllPlantings((plantings) => {
      res.status(200).json(plantings);
      return res.json(plantings);
    });
  });
});

/****************
 ** Zones APIs **
 ****************/

 /**
  * Returns All Zones
  *
  * @returns {zones[]}
  */
router.route('/zones/get').get(function (req, res) {
  Zones.getZonesInstance(async (ZonesInstance) => {
    if (typeof req.query === 'undefined' ||
        typeof req.query.id === 'undefined') {
      res.status(200).json(await ZonesInstance.getAllZones());
    } else {
      var zone = await ZonesInstance.getZone(req.query.id);
      res.status(zone != null ? 200 : 500).json(zone);
    }
  });
});

 /**
  * Returns Planting Zones
  *
  * @returns {zones[]}
  */
router.route('/zones/get/planting').get(function (req, res) {
  Zones.getZonesInstance((ZonesInstance) => {
    var zones = [];
    ZonesInstance.getPlantingZones((zones) => {
      res.status(200).json(zones);
    });
  });
});

/**
 * Returns Control Zones
 *
 * @returns {zones[]}
 */
router.route('/zones/get/control').get(function (req, res) {
  Zones.getZonesInstance((ZonesInstance) => {
    var zones = [];
    ZonesInstance.getControlZones((zones) => {
      res.status(200).json(zones);
    });
  });
});

/**
 * Update Zone
 *
 * @returns {result}
 */
router.route('/zones/set').post(function (req, res) {
  Zones.getZonesInstance((ZonesInstance) => {
    ZonesInstance.setZone(req.body, (err) => {
      res.statusCode = (err === 0 ? 200 : 500);
    });
  });
});

/**
 * Switch on/off zone
 *
 * @returns {status}
 */
router.route('/zones/switch').post(function (req, res) {
  Zones.getZonesInstance((ZonesInstance) => {
    ZonesInstance.switchZone(req.query.id, (status) => {
      res.status(200).json({ status: status });
    });
  });
});

// service data call for skycon
router.route('/weather/get').get(function (req, res) {
  Weather.getWeatherInstance((WeatherInstance) => {
    var error, conditions;
    WeatherInstance.getConditions((error, conditions) => {
      res.status(200).json(conditions);
    });
  });
});

module.exports = router;
