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
const helmet = require('helmet');

// Sign in authentication
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;

const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

const logger = require('morgan');

// Main Application Singleton
const { VegableInstance } = require('./controllers/vegable');

// Application Routes
const IndexRouter = require('./routes/index');
const ApiRouter = require('./routes/api');
const SettingsRouter = require('./routes/settings');
const EventsRouter = require('./routes/events');
const PlantingsRouter = require('./routes/plantings');
const ZonesRouter = require('./routes/zones');

const app = express();

// Initialize a local authentication strategy for now.
// TODO: Add strategies for Facebook, Twitter, ... and/or OpenId, www.okta.com
passport.use(new LocalStrategy(
  ((username, password, callback) => {
    VegableInstance.validateUser(username, password, (err, user) => {
      if (err) { return callback(err); }
      if (!user) { return callback(null, false, { message: 'Incorrect username or password.' }); }
      return callback(null, user);
    });
  }),
));

passport.serializeUser((user, callback) => {
  callback(null, user);
});

passport.deserializeUser((user, callback) => {
  VegableInstance.getUser(user.email, (err, user) => {
    if (err) { return callback(err); }
    callback(null, user);
  });
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

app.use(helmet());
app.use(logger('dev'));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'eat-more-veggies', resave: false, saveUninitialized: false }));

// Initialize Passport and restore authentication state, if any, from the session.
app.use(passport.initialize());
app.use(passport.session());

/* Sign in */
app.post('/signin',
  passport.authenticate('local', { failureRedirect: '/signin' }),
  (req, res) => {
    res.redirect('/');
  });

app.use('/', IndexRouter);
app.use('/api', ApiRouter);
app.use('/settings', SettingsRouter);
app.use('/events', EventsRouter);
app.use('/plantings', PlantingsRouter);
app.use('/zones', ZonesRouter);

/* 404 */
app.all('*', (req, res) => {
  res.render('404');
});

module.exports = app;
