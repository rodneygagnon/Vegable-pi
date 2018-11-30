/*
 * Schedules Router
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
var express = require('express');
var router = express.Router();

const url = require('url');
const querystring = require('querystring');

const Config = require('../model/config');
const Schedules = require('../model/schedules');
const Zones = require('../model/zones');

// GET home page - send zones
router.get('/', function(req, res, next) {
  let zones = [];
  Zones.getZonesInstance((ZonesInstance) => {
    ZonesInstance.getZones((zones) => {
      res.render('schedules', {title: 'Vegable', zones: zones});
    });
  });
});

// service fullcalendar's events url
router.route('/getSchedules').get(function (req, res) {
  let parsedUrl = url.parse(req.url);
  let parsedQs = querystring.parse(parsedUrl.query);

  Schedules.getSchedulesInstance((SchedulesInstance) => {
    var schedules = [];
    SchedulesInstance.getSchedules(parsedQs.start, parsedQs.end, (schedules) => {
      res.statusCode = 200;
      return res.json(schedules);
    });
  });
});

// create, update or delete an event
router.route('/update').post(function (req, res) {
  console.log(`Update Schedule: ${JSON.stringify(req.body)}`);

  Schedules.getSchedulesInstance((SchedulesInstance) => {
    SchedulesInstance.updateSchedule(req.body, req.body.action, () => {
      res.redirect('/schedules');
    });
  });
 });

module.exports = router;
