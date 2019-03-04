/**
 * @file Vegable WebApp Plantings Routes
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const express = require('express');
const validator = require('validator');

const { ZonesInstance } = require('../models/zones');
const { CropsInstance } = require('../models/crops');
const { PlantingsInstance } = require('../models/plantings');

const router = express.Router();

/**
 * Route to render Plantings view
 * @name plantings
 * @function
 * @param {object} user - user
 * @returns {array} zones - list of zones
 * @returns {array} crops - list of crops
 */
router.get('/', (req, res, next) => {
  // Make sure the user is logged in
  if (typeof req.user === 'undefined') {
    res.redirect('/login');
  } else {
    let zones = [];
    ZonesInstance.getPlantingZones((zones) => {
      CropsInstance.getCrops((crops) => {
        res.render('plantings', { title: 'Vegable', zones: zones, crops: crops });
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
router.route('/update').post(async (req, res) => {
  let result;
  let status = 200;

  if (req.body.action === 'delete') {
    if (validator.isUUID(req.body.id)) {
      result = await PlantingsInstance.delPlanting(req.body);
    } else {
      log.error(`plantings/update: Invalid Planting ID (${JSON.stringify(req.body)})`);
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
    res.redirect('/plantings');
  } else {
    res.redirect(status, '/plantings');
  }
});

module.exports = router;
