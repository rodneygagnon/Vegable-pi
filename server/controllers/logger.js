/**
 * Winston / Loggly logger
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */

const { createLogger, format, transports } = require('winston');
const { Loggly } = require('winston-loggly-bulk');

/**
 * Winston/Loggly logging
 */
const env = process.env.NODE_ENV || 'development';
const log = createLogger({
  transports: [
    new transports.Console({
      level: env === 'development' ? 'debug' : 'info',
      format: format.combine(
        format.colorize(),
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss'
        }),
        format.printf(
          info => `${info.timestamp} [ ${info.level} ]: ${info.message}`
        )
      )
    }),
    new Loggly({
      level: 'info',
      inputToken: "cc52e012-7f18-4d5a-ac03-f8f82eca256c",
      subdomain: "vegable",
      tags: ["Vegable"],
      json:true
   })
  ]
});

module.exports = {
  log
};
