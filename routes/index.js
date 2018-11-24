const express = require('express');
const router = express.Router();

const Zones = require('../model/zones');

var ZonesInstance;

/* GET home page. */
router.get('/', function(req, res, next) {
  Zones.getZonesInstance((ZonesInstance) => {
    var zones = [];
    ZonesInstance.getZones((zones) => {
      res.render('index', {title: 'Vegable', zones: zones});
    });
  });
});

router.route('/getZones').get(function (req, res) {
  Zones.getZonesInstance((ZonesInstance) => {
    var zones = [];
    ZonesInstance.getZones((zones) => {
      res.statusCode = 200;
      return res.json(zones);
    });
  });
});

router.route('/post').post(function (req, res) {
  Zones.getZonesInstance((ZonesInstance) => {
    ZonesInstance.setZone(req.body, () => {
      res.redirect('/');
    });
  });
});

router.route('/enable/:id').post(function (req, res) {
  Zones.getZonesInstance((ZonesInstance) => {
    ZonesInstance.switchZone(req.params.id, () => {
      res.redirect('/');
    });
  });
});
module.exports = router;
