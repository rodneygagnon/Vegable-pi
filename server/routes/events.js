/*
 * Events Router
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
var express = require('express');
var router = express.Router();

const {EventsInstance} = require('../models/events');
const {ZonesInstance} = require('../models/zones');

// GET home page - send zones
router.get('/', function(req, res, next) {
  // Make sure the user is logged in
  if (typeof req.user === 'undefined')
    res.redirect('/signin');
  else {
    let zones = [];
    ZonesInstance.getPlantingZones((zones) => {
      res.render('events', {title: 'Vegable', zones: zones});
    });
  }
});

// create, update or delete an event
router.route('/update').post(async function (req, res) {
  var result;

  if (req.body.action === 'delete')
    result = await EventsInstance.delEvent(req.body);
  else
    result = await EventsInstance.setEvent(req.body);

  res.redirect('/events');
 });

module.exports = router;
