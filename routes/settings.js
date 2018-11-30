/*
 * Settings Router
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
var express = require('express');
var router = express.Router();

const Config = require('../model/config');

var ConfigInstance;

// GET home page - send current config
router.get('/', function(req, res, next) {
  // Make sure the user is logged in
  if (typeof req.user === 'undefined')
    res.redirect('/signin');
  else {
    Config.getConfigInstance((ConfigInstance) => {
      var config;
      ConfigInstance.getConfig((config) => {
        res.render('settings', {title: 'Vegable', config: config});
      });
    });
  }
});

// set new config info
router.route('/post').post(function (req, res) {
  Config.getConfigInstance((ConfigInstance) => {
    console.log(`Setting Location: `);
    console.log(req.body);

    ConfigInstance.setAddress(req.body.address);
    ConfigInstance.setCity(req.body.city);
    ConfigInstance.setState(req.body.state);
    ConfigInstance.setZip(req.body.zip);

    res.redirect('/settings');
  });
});

module.exports = router;
