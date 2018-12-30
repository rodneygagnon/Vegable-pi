/*
 * Settings Router
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
var express = require('express');
var router = express.Router();

const {SettingsInstance} = require('../models/settings');
const {CropsInstance} = require('../models/crops');

// GET home page - send current config
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

// set new config info
router.route('/location/set').post(function (req, res) {
  console.log(`Setting Location: `);
  console.log(req.body);

  SettingsInstance.setLocation(req.body.address, req.body.city,
                                req.body.state, req.body.zip,
                                req.body.etzone);

  res.redirect('/settings');
});

// create, update or delete a crop
router.route('/crops/update').post(async function (req, res) {
  var result;

  if (req.body.action === 'delete')
    result = await CropsInstance.delCrop(req.body.id);
  else
    result = await CropsInstance.setCrop(req.body);

  res.redirect('/settings');
 });

module.exports = router;
