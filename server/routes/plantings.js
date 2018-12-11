/*
 * Plantings Router
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
var express = require('express');
var router = express.Router();

const Zones = require('../models/zones');
const Crops = require('../models/crops');
const Plantings = require('../models/plantings');

// GET home page
router.get('/', function(req, res, next) {
  // Make sure the user is logged in
  if (typeof req.user === 'undefined')
    res.redirect('/signin');
  else {
    let zones = [];
    Zones.getZonesInstance((ZonesInstance) => {
      ZonesInstance.getZones((zones) => {
        Crops.getCropsInstance((CropsInstance) => {
          CropsInstance.getAllCrops((crops) => {
            res.render('plantings', {title: 'Vegable', zones: zones, crops: crops});
          });
        });
      });
    });
  }
});

router.route('/getPlantings').get(function (req, res) {
  Plantings.getPlantingsInstance((PlantingsInstance) => {
    var plantings = [];
    PlantingsInstance.getAllPlantings((plantings) => {
      res.statusCode = 200;
      return res.json(plantings);
    });
  });
});

router.route('/getCrops').get(function (req, res) {
  Crops.getCropsInstance((CropsInstance) => {
    var crops = [];
    CropsInstance.getAllCrops((crops) => {
      res.statusCode = 200;
      return res.json(crops);
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
