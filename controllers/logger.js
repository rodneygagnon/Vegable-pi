/**
 * log4js logger
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const log4js = require('log4js');
log4js.configure({
   // TODO: persist the log in redis
   // appenders: {
   //    redis: { type: '@log4js-node/redis', channel: 'logs' }
   // },
   // categories: { default: { appenders: ['redis'], level: 'debug' } }
   appenders: { 'out': { type: 'stdout' } },
   categories: { default: { appenders: ['out'], level: 'debug' } }
 });

 var log = log4js.getLogger("app");

 module.exports = {
   log
 };
