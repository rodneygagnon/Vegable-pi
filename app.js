// Main Express Application
const express = require('express');
const session = require('express-session');

// Security
const https = require('https')
const helmet = require('helmet')

// Sign in authentication
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;

const fs = require('fs')
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

// TODO: Should only need one of these -- fix it
const logger = require('morgan');
const {log} = require('./controllers/logger');

// Load Env Settings
const Settings = require("./settings");

const Vegable = require("./vegable");

var VegableInstance;

// Initialize Vegable
Vegable.getVegableInstance((VegableInstance) => {
  // Before we start listening for requests, we need to ensure
  // we are fully up and running
  passport.use(new LocalStrategy(
    function(username, password, callback) {
      VegableInstance.validateUser({ username: username, password: password }, function(err, user) {
        if (err) { return callback(err); }
        if (!user) { return callback(null, false, { message: 'Incorrect username or password.' }); }
        return callback(null, user);
      });
    }
  ));

  passport.serializeUser(function(user, callback) {
    callback(null, user.username);
  });

  passport.deserializeUser(function(username, callback) {
    VegableInstance.getUserByName(username, function (err, user) {
      if (err) { return callback(err); }
      callback(null, user);
    });
  });
});

var app = express();

// Application Routes
const IndexRouter = require('./routes/index');
const SettingsRouter = require('./routes/settings');
const SchedulesRouter = require('./routes/schedules');
const PlantingsRouter = require('./routes/plantings');

app.set('view engine', 'ejs');

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
app.use('/settings', SettingsRouter);
app.use('/schedules', SchedulesRouter);
app.use('/plantings', PlantingsRouter);

// TODO: Shutdown or redirect HTTP traffic
// app.get('/', indexRouter); //Not Necessary??
https.createServer({
  key: fs.readFileSync('./ssl/server.key'),
  cert: fs.readFileSync('./ssl/server.cert')
}, app)
.listen(Settings.https_port, function () {
  log.info('HTTPS listening on port ' + Settings.https_port)
})

module.exports = app;
