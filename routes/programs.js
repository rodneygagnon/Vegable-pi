var express = require('express');
var router = express.Router();

const Config = require('../model/config');

/* GET home page. */
router.get('/', function(req, res, next) {
  let stations = [];
  Stations.getStationsInstance((StationsInstance) => {
    StationsInstance.getStations((stations) => {
      res.render('programs', {title: 'Vegable', stations: stations});
    });
  });
});

router.route('/getPrograms').get(function (req, res) {
  Programs.getProgramsInstance((ProgramsInstance) => {
    var programs = [];
    ProgramsInstance.getPrograms((programs) => {
      res.statusCode = 200;
      return res.json(programs);
    });
  });
});

router.route('/update').post(function (req, res) {
  console.log(`Update Program: ${JSON.stringify(req.body)}`);

  Programs.getProgramsInstance((ProgramsInstance) => {
    ProgramsInstance.updateProgram(req.body, req.body.action, () => {
      res.redirect('/programs');
    });
  });
 });

router.route('/delete/:id').post(function (req, res) {
  const id = req.params.id;
  console.log(`Delete Program: ID ${id}`);
  res.redirect('/programs');
});

module.exports = router;
