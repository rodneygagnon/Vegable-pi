/*
 * Vegable-pi
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */

// Main Express Application
const express = require('express');
const session = require('express-session');

// Security
const helmet = require('helmet')

// Sign in authentication
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

// TODO: Should only need one of these -- fix it
const logger = require('morgan');
const {log} = require('./controllers/logger');

// Main Application Singleton
const Vegable = require("./vegable");

var VegableInstance;

// Initialize Vegable
Vegable.getVegableInstance((VegableInstance) => {

  // Initialize a local authentication strategy for now.
  // TODO: Add strategies for Facebook, Twitter, ... and/or OpenId, www.okta.com
  passport.use(new LocalStrategy(
    function(username, password, callback) {
      VegableInstance.validateUser(username, password, function(err, user) {
        if (err) { return callback(err); }
        if (!user) { return callback(null, false, { message: 'Incorrect username or password.' }); }
        return callback(null, user);
      });
    }
  ));

  passport.serializeUser(function(user, callback) {
    callback(null, user);
  });

  passport.deserializeUser(function(user, callback) {
    VegableInstance.getUser(user.email, function (err, user) {
      if (err) { return callback(err); }
      callback(null, user);
    });
  });
});

var app = express();

// Application Routes
const IndexRouter = require('./routes/index');
const ApiRouter = require('./routes/api');
const SettingsRouter = require('./routes/settings');
const EventsRouter = require('./routes/events');
const PlantingsRouter = require('./routes/plantings');

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

app.use(helmet());
app.use(logger('dev'));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'eat-more-veggies', resave: false, saveUninitialized: false }));

// Initialize Passport and restore authentication state, if any, from the session.
app.use(passport.initialize());
app.use(passport.session());

/* Sign in */
app.post('/signin',
  passport.authenticate('local', { failureRedirect: '/signin' }),
  function(req, res) {
    res.redirect('/');
  });

app.use('/', IndexRouter);
app.use('/api', ApiRouter);
app.use('/settings', SettingsRouter);
app.use('/events', EventsRouter);
app.use('/plantings', PlantingsRouter);

/* 404 */
app.all('*', function(req, res) {
    res.render('404');
});

module.exports = app;
