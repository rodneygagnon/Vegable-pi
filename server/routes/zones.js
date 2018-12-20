/*
 * Zones Router
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
const express = require('express');
const router = express.Router();

const Zones = require('../models/zones');

var ZonesInstance;

// GET home page
router.get('/', function(req, res, next) {
  // Make sure the user is logged in
  if (typeof req.user === 'undefined')
    res.redirect('/signin');
  else {
    res.render('zones');
  }
});

// update zone name, desc, flow info
router.route('/update').post(function (req, res) {
  Zones.getZonesInstance((ZonesInstance) => {
    ZonesInstance.setZone(req.body, () => {
      res.redirect('/zones');
    });
  });
});

// ad hoc turning on/off zones
router.route('/enable/:id').post(function (req, res) {
  Zones.getZonesInstance((ZonesInstance) => {
    ZonesInstance.switchZone(req.params.id, () => {
      res.redirect('/zones');
    });
  });
});

module.exports = router;
