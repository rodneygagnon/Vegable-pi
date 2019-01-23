/**
 * @file Vegable WebApp Events Routes
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const express = require('express');

const { EventsInstance } = require('../models/events');
const { ZonesInstance } = require('../models/zones');

const router = express.Router();

/**
 * Route to render Events view
 * @name events
 * @function
 * @param {object} user - user
 * @returns {array} zones - list of zones
 */
router.get('/', (req, res, next) => {
  // Make sure the user is logged in
  if (typeof req.user === 'undefined') {
    res.redirect('/signin');
  } else {
    ZonesInstance.getPlantingZones((zones) => {
      res.render('events', { title: 'Vegable', zones: zones });
    });
  }
});

/**
 * Route to create, update, delete an event and redirect Events view
 * @name events/update
 * @function
 * @param {object} event - event
 * @param {string} action - _null_ or _delete_
 */
router.route('/update').post(async (req, res) => {
  let result;

  if (req.body.action === 'delete') {
    result = await EventsInstance.delEvent(req.body);
  } else {
    result = await EventsInstance.setEvent(req.body);
  }

  res.redirect('/events');
});

module.exports = router;
