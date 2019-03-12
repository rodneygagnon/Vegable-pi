/**
 * @file Constants
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */

/** Space Constants */
const GPMtoCFS = 448.83; // gallons-per-minute to cubic-feet-per-second
const SqftPerAcre = 43560;

const AppRateEmitterLineConversion = 231.1;
const AppRateDripConversion = 1.604;

/** Time Constants */
const MilliPerSec = 1000;
const MilliPerMin = MilliPerSec * 60;
const MilliPerHour = MilliPerMin * 60;
const MilliPerDay = MilliPerHour * 24;

module.exports = {
  GPMtoCFS,
  SqftPerAcre,
  AppRateEmitterLineConversion,
  AppRateDripConversion,
  MilliPerSec,
  MilliPerMin,
  MilliPerHour,
  MilliPerDay,
};
