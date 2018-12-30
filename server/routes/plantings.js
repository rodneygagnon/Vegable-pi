/**
 * @file Vegable WebApp Plantings Routes
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */
'use strict';

var express = require('express');
var router = express.Router();

const {ZonesInstance} = require('../models/zones');
const {CropsInstance} = require('../models/crops');
const {PlantingsInstance} = require('../models/plantings');

/**
 * Route to render Plantings view
 * @name plantings
 * @function
 * @param {object} user - user
 * @returns {array} zones - list of zones
 * @returns {array} crops - list of crops
 */
router.get('/', function(req, res, next) {
  // Make sure the user is logged in
  if (typeof req.user === 'undefined')
    res.redirect('/signin');
  else {
    let zones = [];
    ZonesInstance.getPlantingZones((zones) => {
      CropsInstance.getCrops((crops) => {
        res.render('plantings', {title: 'Vegable', zones: zones, crops: crops});
      });
    });
  }
});

/**
 * Route to create, update, delete a planting and redirect Plantings view
 * @name plantings/update
 * @function
 * @param {object} planting - planting
 * @param {string} action - _null_ or _delete_
 */
router.route('/update').post(async function (req, res) {
  var result;

  if (req.body.action === 'delete')
    result = await PlantingsInstance.delPlanting(req.body);
  else
    result = await PlantingsInstance.setPlanting(req.body);

  // Tell the zone of a planting change
  await ZonesInstance.updatePlantings(result.zids);

  res.redirect('/plantings');
});

module.exports = router;
