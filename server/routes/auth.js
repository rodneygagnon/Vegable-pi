
const express = require('express');
const passport = require('passport');

const router = express.Router();

// Perform the login, after login Auth0 will redirect to callback
router.get('/login', passport.authenticate('auth0', { scope: 'openid email profile' }), (req, res) => {
  res.redirect('/');
});

// Perform the final stage of authentication and redirect to previously requested URL or '/user'
router.get('/callback', (req, res, next) => {
  passport.authenticate('auth0', (err, user, info) => {
    if (err) {
      return next(err);
    }
    if (!user) {
      return res.redirect('/login');
    }

    req.logIn(user, (err) => {
      if (err) {
        return next(err);
      }
      const { returnTo } = req.session;
      delete req.session.returnTo;

      res.redirect(returnTo || '/');
    });
  })(req, res, next);
});

// Perform session logout and redirect to homepage
router.get('/logout', (req, res) => {
  req.logout();
  res.redirect('https://vegable.auth0.com/v2/logout?client_id=KJpVsek53NpH5UwR4j8rKvd0jvM8RFWS&returnTo=http://localhost:3001');
});

module.exports = router;
