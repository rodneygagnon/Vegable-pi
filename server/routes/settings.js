/*
 * Settings Router
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
var express = require('express');
var router = express.Router();

const Settings = require('../models/settings');
const Crops = require('../models/crops');

var SettingsInstance;

// GET home page - send current config
router.get('/', function(req, res, next) {
  // Make sure the user is logged in
  if (typeof req.user === 'undefined')
    res.redirect('/signin');
  else {
    Settings.getSettingsInstance((SettingsInstance) => {
      var config;
      SettingsInstance.getSettings((config) => {
        res.render('settings', {title: 'Vegable', config: config});
      });
    });
  }
});

// set new config info
router.route('/post').post(function (req, res) {
  Settings.getSettingsInstance((SettingsInstance) => {
    console.log(`Setting Location: `);
    console.log(req.body);

    SettingsInstance.setLocation(req.body.address, req.body.city,
                               req.body.state, req.body.zip);

    res.redirect('/settings');
  });
});

// create, update or delete a crop
router.route('/updateCrop').post(function (req, res) {
  Crops.getCropsInstance((CropsInstance) => {
    CropsInstance.updateCrop(req.body, req.body.action, () => {
      res.redirect('/settings');
    });
  });
 });

module.exports = router;
