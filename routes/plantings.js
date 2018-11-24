var express = require('express');
var router = express.Router();

const Config = require('../model/config');
const Plantings = require('../model/plantings');

/* GET home page. */
router.get('/', function(req, res, next) {
  let zones = [];
  Zones.getZonesInstance((ZonesInstance) => {
    ZonesInstance.getZones((zones) => {
      res.render('plantings', {title: 'Vegable', zones: zones});
    });
  });
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

router.route('/delete/:id').post(function (req, res) {
  const id = req.params.id;
  console.log(`Delete Planting: ID ${id}`);
  res.redirect('/plantings');
});

module.exports = router;
