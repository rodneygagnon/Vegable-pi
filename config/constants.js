/**
 * @file Constants
 * @author Rodney Gagnon <rodney@vegable.co>
 * @copyright 2018 vegable.io
 * @version 0.1
 */
'use strict';

/** Space Constants */
const gpm_cfs = 448.83;    // gallons-per-minute to cubic-feet-per-second
const sqft_acre = 43560;

/** Time Constants */
const milli_per_sec = 1000;
const milli_per_min = milli_per_sec * 60;
const milli_per_hour = milli_per_min * 60;
const milli_per_day = milli_per_hour * 24;

 module.exports = {
   gpm_cfs,
   sqft_acre,
   milli_per_sec,
   milli_per_min,
   milli_per_hour,
   milli_per_day
 };
