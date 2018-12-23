/**
 * Controllers Mocha Test
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
const expect = require('expect');

const config = require('../config/config');

const GeoLocation = require('../server/controllers/geolocation');
//const Weather = require("../server/controllers/weather");

const {log} = require('../server/controllers/logger');
log.level = 'error'; // setting to error to suppress debug (default) messages

// GeoLocation Tests
it ('should return the lat and long', (done) => {
  GeoLocation.getGeoLocationInstance(config.default_mapbox_key, (gGeoLocation) => {
    gGeoLocation.getLatLong(config.default_address, config.default_city,
                            config.default_state, config.default_zip, (error, latitude, longitude) => {
      expect(latitude).toBe(config.default_lat);
      expect(longitude).toBe(config.default_long);
      done();
    });
  });
});

// Weather Tests
// it ('should connect and return dark sky weather data', () => {
//   Weather.getWeatherInstance((weather) => {
//     Weather.getConditions((error, conditions) => {
//       if (error) throw error;
//       else
//         // TODO: check more than just 'undefined'
//         if (typeof conditions === 'undefined')
//           throw new Error('conditions undefined')
//     });
//   });
// });
//
// it ('should connect and return cimis weather data', () => {
//   // Get yesterday's date
//   var d = new Date();
//   d.setDate(d.getDate() - 1);
//
//   Weather.getWeatherInstance((weather) => {
//     Weather.getCimisConditions(d, (error, conditions) => {
//       if (error) throw error;
//       else
//       // TODO: check more than just 'undefined'
//       if (typeof conditions === 'undefined')
//         throw new Error('conditions undefined')
//     });
//
//   });
// });
