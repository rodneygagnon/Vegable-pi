/*
 * Vegable-pi
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */

// Main Express Application
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const dotenv = require('dotenv');

dotenv.load();

const redis   = require("redis");
const RedisStore = require('connect-redis')(session);

// Security
const helmet = require('helmet');

// Sign in authentication
const passport = require('passport');
const Auth0Strategy = require('passport-auth0');

const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const flash = require('connect-flash');

const morgan = require('morgan');

// Main Application Singleton
const { VegableInstance } = require('./controllers/vegable');
const { milli_per_hour } = require('../config/constants');

// Application Routes
const AuthRouter = require('./routes/auth');
const IndexRouter = require('./routes/index');
const ApiRouter = require('./routes/api');
const SettingsRouter = require('./routes/settings');
const EventsRouter = require('./routes/events');
const PlantingsRouter = require('./routes/plantings');
const ZonesRouter = require('./routes/zones');

const app = express();

// Initialize a local authentication strategy for now.
var strategy = new Auth0Strategy({
   domain:       process.env.AUTH0_DOMAIN,
   clientID:     process.env.AUTH0_CLIENT_ID,
   clientSecret: process.env.AUTH0_CLIENT_SECRET,
   callbackURL:  '/callback'
  },
  function(accessToken, refreshToken, extraParams, profile, done) {
    // accessToken is the token to call Auth0 API (not needed in the most cases)
    // extraParams.id_token has the JSON Web Token
    // profile has all the information from the user
    return done(null, profile);
  }
);
passport.use(strategy);

passport.serializeUser((user, callback) => {
  callback(null, user);
});

passport.deserializeUser((user, callback) => {
  callback(null, user);
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieParser());

app.use(session({
  secret: 'eat-more-veggies',
  cookie: { maxAge: 24 * milli_per_hour },
  store: new RedisStore({ host: 'redis' }),
  saveUninitialized: false,
  resave: false
}));

// Initialize Passport and restore authentication state, if any, from the session.
app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

// Handle auth failure error messages
app.use(function (req, res, next) {
  if (req && req.query && req.query.error) {
    req.flash('error', req.query.error);
  }
  if (req && req.query && req.query.error_description) {
    req.flash('error_description', req.query.error_description);
  }
  next();
});

app.use(function (req, res, next) {
  res.locals.user = req.user;
  next();
});

app.use('/', AuthRouter);
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
