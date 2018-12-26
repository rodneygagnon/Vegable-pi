/*
 * Events Router
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
var express = require('express');
var router = express.Router();

const Events = require('../models/events');
const Zones = require('../models/zones');

// GET home page - send zones
router.get('/', function(req, res, next) {
  // Make sure the user is logged in
  if (typeof req.user === 'undefined')
    res.redirect('/signin');
  else {
    let zones = [];
    Zones.getZonesInstance((ZonesInstance) => {
      ZonesInstance.getPlantingZones((zones) => {
        res.render('events', {title: 'Vegable', zones: zones});
      });
    });
  }
});

// create, update or delete an event
router.route('/update').post(function (req, res) {
  console.log(`Update Event: ${JSON.stringify(req.body)}`);

  Events.getEventsInstance((EventsInstance) => {
    EventsInstance.updateEvent(req.body, req.body.action, () => {
      res.redirect('/events');
    });
  });
 });

module.exports = router;
