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

const {SettingsInstance} = require('../models/settings');
const {CropsInstance} = require('../models/crops');
const {EventsInstance} = require('../models/events');
const {PlantingsInstance} = require('../models/plantings');
const {ZonesInstance} = require('../models/zones');
const {WeatherInstance} = require('../controllers/weather');

/*******************
 ** Location APIs **
 *******************/

/**
 * Get location
 *
 * @returns {location}
 */
router.route('/location/get').get(function (req, res) {
  SettingsInstance.getSettings((config) => {
    res.status(200).json(config);
  });
});

/**
 * Set location
 *
 * @param {location}
 */
router.route('/location/set').post(function (req, res) {
  SettingsInstance.setLocation( req.body.address, req.body.city,
                                req.body.state, req.body.zip, req.body.etzone);
  res.status(200).end();
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
 * Create, update or delete a crop
 *
 * @param {crop} Crop
 * @returns {id}
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

 /********************
  ** Events APIs **
  ********************/

 /**
  * Returns list of events
  *
  * @param {start} Start date
  * @param {end} End date
  *
  * @returns {plantings or plantings[]}
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
  * Create, update or delete an event
  *
  * @param {event} Event
  *
  * @returns {id}
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

/********************
 ** Plantings APIs **
 ********************/

 /**
  * Returns Individual or list of plantings
  *
  * @param {pid} Planting Id
  *
  * @returns {plantings or plantings[]}
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
  * Create, update or delete a planting
  *
  * @param {planting} Planting
  *
  * @returns {id}
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

/****************
 ** Zones APIs **
 ****************/

 /**
  * Returns All Zones
  *
  * @returns {zones[]}
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
  * Returns Planting Zones
  *
  * @returns {zones[]}
  */
router.route('/zones/get/planting').get(function (req, res) {
  var zones = [];
  ZonesInstance.getPlantingZones((zones) => {
    res.status(200).json(zones);
  });
});

/**
 * Returns Control Zones
 *
 * @returns {zones[]}
 */
router.route('/zones/get/control').get(function (req, res) {
  var zones = [];
  ZonesInstance.getControlZones((zones) => {
    res.status(200).json(zones);
  });
});

/**
 * Update Zone
 *
 * @returns {result}
 */
router.route('/zones/set').post(function (req, res) {
  ZonesInstance.setZone(req.body, (err) => {
    res.statusCode = (err === 0 ? 200 : 500);
  });
});

/**
 * Switch on/off zone
 *
 * @returns {status}
 */
router.route('/zones/switch').post(function (req, res) {
  ZonesInstance.switchZone(req.query.id, (status) => {
    res.status(200).json({ status: status });
  });
});

/******************
 ** Weather APIs **
 ******************/

 /**
  * Returns Current Conditions (for skycon)
  *
  * @returns {conditions}
  */
router.route('/weather/get').get(function (req, res) {
  var error, conditions;
  WeatherInstance.getConditions((error, conditions) => {
    res.status(200).json(conditions);
  });
});

module.exports = router;
