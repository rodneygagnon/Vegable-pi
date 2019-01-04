/**
 * @file Vegable WebApp Zones Routes
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */
'use strict';

const express = require('express');
const router = express.Router();

const {ZonesInstance} = require('../models/zones');

/**
 * Route to render Zones view
 * @name zones
 * @function
 */
router.get('/', function(req, res, next) {
  // Make sure the user is logged in
  if (typeof req.user === 'undefined')
    res.redirect('/signin');
  else {
    res.render('zones');
  }
});

/**
 * Route to update a zone and redirect Zones view
 * @name zones/update
 * @function
 * @param {object} crop - crop
 * @param {string} action - _null_ or _delete_
 */
router.route('/update').post(async function (req, res) {
  await ZonesInstance.setZone(req.body)
  res.redirect('/zones');
});

/**
 * Route to turn on/off zones and redirect Zones view
 * @name zones/enable
 * @function
 * @param {object} id - zone id
 */
router.route('/enable/:id').post(function (req, res) {
  // TODO: add ability to pass fertilize flag
  ZonesInstance.switchZone(req.params.id, false, () => {
    res.redirect('/zones');
  });
});

module.exports = router;
