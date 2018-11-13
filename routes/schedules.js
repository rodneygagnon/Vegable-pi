var express = require('express');
var router = express.Router();

const Config = require('../model/config');
const Schedules = require('../model/schedules');

/* GET home page. */
router.get('/', function(req, res, next) {
  let stations = [];
  Stations.getStationsInstance((StationsInstance) => {
    StationsInstance.getStations((stations) => {
      res.render('schedules', {title: 'Vegable', stations: stations});
    });
  });
});

router.route('/getSchedules').get(function (req, res) {
  Schedules.getSchedulesInstance((SchedulesInstance) => {
    var schedules = [];
    SchedulesInstance.getSchedules((schedules) => {
      res.statusCode = 200;
      return res.json(schedules);
    });
  });
});

router.route('/update').post(function (req, res) {
  console.log(`Update Schedule: ${JSON.stringify(req.body)}`);

  Schedules.getSchedulesInstance((SchedulesInstance) => {
    SchedulesInstance.updateSchedule(req.body, req.body.action, () => {
      res.redirect('/schedules');
    });
  });
 });

router.route('/delete/:id').post(function (req, res) {
  const id = req.params.id;
  console.log(`Delete Schedule: ID ${id}`);
  res.redirect('/schedules');
});

module.exports = router;
