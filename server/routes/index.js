/**
 * @file Vegable WebApp Index Routes
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */
'use strict';

const express = require('express');
const router = express.Router();

const {UsersInstance} = require('../models/users');

/**
 * Route to render Index view
 * @name index
 * @function
 * @returns {object} user - user
 */
router.get('/', function(req, res, next) {
  // Make sure the user is logged in
  if (typeof req.user === 'undefined')
    res.redirect('/signin');
  else {
    res.render('index', {title: 'Vegable', user: req.user });
  }
});

/**
 * Route to render Sign In view
 * @name signin
 * @function
 */
router.get('/signin', function(req, res, next) {
  res.render('signin');
});

/**
 * Route to render Sign Up view
 * @name signup
 * @function
 */
router.get('/signup', function(req, res, next) {
  res.render('signup');
});

/**
 * Route to sign out and redirect to Sign In view
 * @name signout
 * @function
 */
router.get('/signout', function(req, res, next) {
  req.logout();
  res.redirect('/signin');
});

/**
 * Route to handle user registration and redirect to Sign In view
 * @name signup
 * @function
 * @param {object} user - user
 */
router.post('/signup', function(req, res, next) {
  UsersInstance.updateUser(req.body, "" /* action */, (result) => {
    // TODO: check result of new user registration before redirecting
    res.redirect('/signin');
  });
});

module.exports = router;
