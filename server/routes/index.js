/*
 * Index Router
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
const express = require('express');
const router = express.Router();

const {UsersInstance} = require('../models/users');

// GET home page
router.get('/', function(req, res, next) {
  // Make sure the user is logged in
  if (typeof req.user === 'undefined')
    res.redirect('/signin');
  else {
    res.render('index', {title: 'Vegable', user: req.user });
  }
});

// GET sign in, up and out.
router.get('/signin', function(req, res, next) {
  res.render('signin');
});
router.get('/signup', function(req, res, next) {
  res.render('signup');
});
router.get('/signout', function(req, res, next) {
  req.logout();
  res.redirect('/signin');
});

// POST handle new user registration
router.post('/signup', function(req, res, next) {
  UsersInstance.updateUser(req.body, "" /* action */, (result) => {
    // TODO: check result of new user registration before redirecting
    res.redirect('/signin');
  });
});

module.exports = router;
