/*
 * Plantings Router
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
var express = require('express');
var router = express.Router();

const {ZonesInstance} = require('../models/zones');
const {CropsInstance} = require('../models/crops');
const {PlantingsInstance} = require('../models/plantings');

// GET home page
router.get('/', function(req, res, next) {
  // Make sure the user is logged in
  if (typeof req.user === 'undefined')
    res.redirect('/signin');
  else {
    let zones = [];
    ZonesInstance.getPlantingZones((zones) => {
      CropsInstance.getCrops((crops) => {
        res.render('plantings', {title: 'Vegable', zones: zones, crops: crops});
      });
    });
  }
});

router.route('/update').post(async function (req, res) {
  var result;

  if (req.body.action === 'delete')
    result = await PlantingsInstance.delPlanting(req.body);
  else
    result = await PlantingsInstance.setPlanting(req.body);

  // Tell the zone of a planting change
  await ZonesInstance.updatePlantings(result.zids);

  res.redirect('/plantings');
});

module.exports = router;
