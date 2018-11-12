// Main Express Application
const express = require('express');

// Security
const https = require('https')
const helmet = require('helmet')

const fs = require('fs')
const path = require('path');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const logger = require('morgan');

// Load Env Settings
const Settings = require("./settings");

const Vegable = require("./vegable");

var VegableInstance;

// Initialize Vegable
Vegable.getVegableInstance((VegableInstance) => {
  // Before we start listening for requests, we need to ensure
  // we are fully up and running
});

var app = express();

// Application Routes
const IndexRouter = require('./routes/index');
const SettingsRouter = require('./routes/settings');
const ProgramsRouter = require('./routes/programs');

app.set('view engine', 'ejs');

app.use(helmet());
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', IndexRouter);
app.use('/settings', SettingsRouter);
app.use('/programs', ProgramsRouter);

// TODO: Shutdown or redirect HTTP traffic
// app.get('/', indexRouter); //Not Necessary??
https.createServer({
  key: fs.readFileSync('./ssl/server.key'),
  cert: fs.readFileSync('./ssl/server.cert')
}, app)
.listen(Settings.https_port, function () {
  console.log('HTTPS listening on port ' + Settings.https_port)
})

module.exports = app;
