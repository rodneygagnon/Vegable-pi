/**
 * @file Vegable WebApp Settings Routes
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const express = require('express');
const validator = require('validator');

const { log } = require('../controllers/logger');

const { SettingsInstance } = require('../models/settings');
const { CropsInstance } = require('../models/crops');

const router = express.Router();

/**
 * Route to render Settings view
 * @name settings
 * @function
 * @returns {object} config - location configuration
 * @returns {object} etrs - reference evapotranspiration zones
 */
router.get('/', (req, res) => {
  // Make sure the user is logged in
  if (typeof req.user === 'undefined') {
    res.redirect('/login');
  } else {
    SettingsInstance.getSettings((config) => {
      SettingsInstance.getETrs((etrs) => {
        res.render('settings', { title: 'Vegable', config, etrs });
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
router.route('/location/set').post((req, res) => {
  if (!validator.isEmpty(req.body.address) && !validator.isEmpty(req.body.city)
      && !validator.isEmpty(req.body.state) && validator.isPostalCode(req.body.zip, 'US')) {
    SettingsInstance.setLocation(req.body.address, req.body.city,
      req.body.state, req.body.zip,
      req.body.etzone);
    res.redirect('/settings');
  } else {
    log.error(`settings/location/set: Bad Request Data (${JSON.stringify(req.body)})`);
    res.redirect(400, '/settings');
  }
});

/**
 * Route to set gardening practice
 * @name settings/practice/set
 * @function
 * @param {Number} practice - Practice
 */
router.route('/practice/set').post((req, res) => {
  if (!validator.isEmpty(req.body.practice)) {
    SettingsInstance.setPractice(req.body.practice);
    res.redirect('/settings');
  } else {
    log.error(`settings/practice/set: Bad Request Data (${JSON.stringify(req.body)})`);
    res.redirect(400, '/settings');
  }
});

/**
 * Route to update a crop and redirect Settings view
 * @name settings/crops/update
 * @function
 * @param {object} crop - crop
 * @param {string} action - _null_ or _delete_
 */
router.route('/crops/update').post(async (req, res) => {
  if (req.body.action === 'delete') {
    await CropsInstance.delCrop(req.body.id);
  } else {
    await CropsInstance.setCrop(req.body);
  }

  res.redirect('/settings');
});

module.exports = router;
