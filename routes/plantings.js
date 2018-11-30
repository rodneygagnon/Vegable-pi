/*
 * Plantings Router
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
var express = require('express');
var router = express.Router();

const Config = require('../model/config');
const Zones = require('../model/zones');
const Plantings = require('../model/plantings');

// GET home page
router.get('/', function(req, res, next) {
  // Make sure the user is logged in
  if (typeof req.user === 'undefined')
    res.redirect('/signin');
  else {
    let zones = [];
    Zones.getZonesInstance((ZonesInstance) => {
      ZonesInstance.getZones((zones) => {
        res.render('plantings', {title: 'Vegable', zones: zones});
      });
    });
  }
});

router.route('/getPlantings').get(function (req, res) {
  Plantings.getPlantingsInstance((PlantingsInstance) => {
    var plantings = [];
    PlantingsInstance.getPlantings((plantings) => {
      res.statusCode = 200;
      return res.json(plantings);
    });
  });
});

router.route('/update').post(function (req, res) {
  console.log(`Update Planting: ${JSON.stringify(req.body)}`);

  Plantings.getPlantingsInstance((PlantingsInstance) => {
    PlantingsInstance.updatePlanting(req.body, req.body.action, () => {
      res.redirect('/plantings');
    });
  });
});

module.exports = router;
