var express = require('express');
var router = express.Router();

const Config = require('../model/config');

var ConfigInstance;

/* GET home page. */
router.get('/', function(req, res, next) {
  Config.getConfigInstance((ConfigInstance) => {
    var config;
    ConfigInstance.getConfig((config) => {
      res.render('settings', {title: 'Vegable', config: config});
    });
  });
});

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
