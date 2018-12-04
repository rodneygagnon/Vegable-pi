/**
 * log4js logger
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const log4js = require('log4js');
log4js.configure({
   // appenders: {
   //    redis: { type: '@log4js-node/redis', maxLogSize: 10485760, backups: 3, channel: 'logs' }
   // },
   // categories: { default: { appenders: ['redis'], level: 'debug' } }

   appenders: { 'out': { type: 'stdout' } },
   categories: { default: { appenders: ['out'], level: 'debug' } }

   //appenders: { 'file': { type: 'file', filename: '/var/log/vegable.log', maxLogSize: 10485760, backups: 3,} },
   //categories: { default: { appenders: ['file'], level: 'debug' } }
 });

 var log = log4js.getLogger("app");

 module.exports = {
   log
 };
