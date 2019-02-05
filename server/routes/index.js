/**
 * @file Vegable WebApp Index Routes
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

const express = require('express');
const validator = require('validator');

const { log } = require('../controllers/logger');

const { SettingsInstance } = require('../models/settings');
const { UsersInstance } = require('../models/users');
const { ZonesInstance } = require('../models/zones');

const router = express.Router();

/**
 * Route to render Index view
 * @name index
 * @function
 * @returns {object} user - user
 */
router.get('/', async (req, res, next) => {
  if (await SettingsInstance.getRegistered() == 0) {
    res.redirect('/register');
  } else {
    // Make sure the user is logged in
    if (typeof req.user === 'undefined') {
      res.redirect('/signin');
    } else {
      res.render('index', { title: 'Vegable', user: req.user });
    }
  }
});

/**
 * Route to render Sign In view
 * @name signin
 * @function
 */
router.get('/signin', async (req, res, next) => {
  if (await SettingsInstance.getRegistered() == 0) {
    res.redirect('/register');
  } else {
    res.render('signin');
  }
});

/**
 * Route to render Sign Up view
 * @name signup
 * @function
 */
router.get('/signup', async (req, res, next) => {
  if (await SettingsInstance.getRegistered() == 0) {
    res.redirect('/register');
  } else {
    res.render('signup');
  }
});

/**
 * Route to render Recover view
 * @name recover
 * @function
 */
router.get('/recover', async (req, res, next) => {
  if (await SettingsInstance.getRegistered() == 0) {
    res.redirect('/register');
  } else {
    res.render('recover');
  }
});

/**
 * Route to sign out and redirect to Sign In view
 * @name signout
 * @function
 */
router.get('/signout', (req, res, next) => {
  req.logout();
  res.redirect('/signin');
});

/**
 * Route to handle user registration and redirect to Sign In view
 * @name signup
 * @function
 * @param {object} user - user
 */
router.post('/signup', (req, res, next) => {
  UsersInstance.updateUser(req.body, '' /* action */, (result) => {
    // TODO: check result of new user registration before redirecting
    res.redirect('/signin');
  });
});

/**
 * Route to render Register view
 * @name register
 * @function
 * @returns {object} config - location configuration
 * @returns {object} etrs - reference evapotranspiration zones
 */
router.get('/register', (req, res, next) => {
  SettingsInstance.getSettings((config) => {
    SettingsInstance.getETrs((etrs) => {
      res.render('register', { title: 'Vegable', config: config, etrs: etrs });
    });
  });
});

/**
 * Route to register device and redirect signin view
 * @name register/setup
 * @function
 * @param {object} settings - Name, Email, Password, Address, City, State, Zip, ET Zone, ...
 */
router.route('/register/setup').post((req, res) => {
  log.debug(`register/setup: Request Data (${JSON.stringify(req.body)})`);

  if (validator.isEmpty(req.body.username) || !validator.isEmail(req.body.email)
    || validator.isEmpty(req.body.password) || validator.isEmpty(req.body.address)
    || validator.isEmpty(req.body.city) || validator.isEmpty(req.body.state)
    || !validator.isPostalCode(req.body.zip, 'US') || validator.isEmpty(req.body.etzone)
    || validator.isEmpty(req.body.zonename) || validator.isEmpty(req.body.start)
    || validator.isEmpty(req.body.area) || validator.isEmpty(req.body.swhc)
    || validator.isEmpty(req.body.emitterCount) || validator.isEmpty(req.body.emitterRate)
    || validator.isEmpty(req.body.practice)) {
      log.error(`register/setup: Bad Registration Data (${JSON.stringify(req.body)})`);
      res.redirect(400, '/register');
    } else {
      const user = { name: req.body.username,
                     email: req.body.email,
                     password: req.body.password
                   };
      UsersInstance.updateUser(user, '' /* action */, async (result) => {
        await SettingsInstance.setLocation(req.body.address, req.body.city,
                                           req.body.state, req.body.zip, req.body.zip);
        await SettingsInstance.setETZone(req.body.etzone);
        await SettingsInstance.setPractice(req.body.practice);

        const zoneOne = { id: 3, /* Zone 1 ID */
                          name: req.body.zonename,
                          area:req.body.area,
                          emitterCount: req.body.emitterCount,
                          emitterRate: req.body.emitterRate,
                          swhc: req.body.swhc,
                          start: req.body.start
                        };
        await ZonesInstance.setZone(zoneOne);

        await SettingsInstance.setRegistered(Date.now());

        res.redirect('/signin');
    });
  }
});

module.exports = router;
