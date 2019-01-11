/**
 * @file Vegable WebApp Settings Routes
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */
'use strict';

var express = require('express');
var router = express.Router();

const {SettingsInstance} = require('../models/settings');
const {CropsInstance} = require('../models/crops');

/**
 * Route to render Settings view
 * @name settings
 * @function
 * @returns {object} config - location configuration
 * @returns {object} etrs - reference evapotranspiration zones
 */
router.get('/', function(req, res, next) {
  // Make sure the user is logged in
  if (typeof req.user === 'undefined')
    res.redirect('/signin');
  else {
    var config;
    SettingsInstance.getSettings((config) => {
      SettingsInstance.getETrs((etrs) => {
        res.render('settings', {title: 'Vegable', config: config, etrs: etrs});
      });
    });
  }
});

/**
 * Route to set location information and redirect Settings view
 * @name settings/location/set
 * @function
 * @param {object} location - Address, City, State, Zip, ET Zone
 */
router.route('/location/set').post(function (req, res) {
  console.log(`Setting Location: `);
  console.log(req.body);

  SettingsInstance.setLocation(req.body.address, req.body.city,
                                req.body.state, req.body.zip,
                                req.body.etzone);

  res.redirect('/settings');
});

/**
 * Route to set gardening practice
 * @name settings/practice/set
 * @function
 * @param {Number} practice - Practice
 */
router.route('/practice/set').post(function (req, res) {
  SettingsInstance.setPractice(req.body.practice);

  res.redirect('/settings');
});

/**
 * Route to update a crop and redirect Settings view
 * @name settings/crops/update
 * @function
 * @param {object} crop - crop
 * @param {string} action - _null_ or _delete_
 */
router.route('/crops/update').post(async function (req, res) {
  var result;

  if (req.body.action === 'delete')
    result = await CropsInstance.delCrop(req.body.id);
  else
    result = await CropsInstance.setCrop(req.body);

  res.redirect('/settings');
 });

module.exports = router;
