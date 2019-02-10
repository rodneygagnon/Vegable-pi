/**
 * Weather Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */

const request = require('request');
const Queue = require('bull');
const Schema = require('schm');

const { log } = require('./logger');

const { SettingsInstance } = require('../models/settings');
const { ETrInstance } = require('../models/etr');

const darkskyWeatherURL = 'https://api.darksky.net/forecast/';
const cimisURL = 'http://et.water.ca.gov/api/data?appKey=';

const { db } = require('../models/db');
const { dbKeys } = require('../models/db');

const weatherSchema = Schema({
  date: String, // YYYYMMDD
  eto: Number, // (CIMIS) evapotranspiration (inches)
  solar: Number, // (CIMIS) Solar Radiation (Ly/Day)
  wind: Number, // (DARKSKY) Wind Speed (mph)
  precip: Number, // (DARKSKY) Rain (inches)
  precipProb: Number, // (DARKSKY)
  tempHi: Number, // (DARKSKY) ˚F
  tempLo: Number, // (DARKSKY) ˚F
  humidity: Number, // (DARKSKY)
});

/** DARKSKY */
const forecastSchema = Schema({
  time: Number, // UNIX time
  summary: String, // Description
  icon: String, // Icon Name
  sunriseTime: Number, // UNIX time
  sunsetTime: Number, // UNIX time
  moonPhase: Number,
  precipIntensity: Number, // Inches
  precipProbability: Number,
  precipType: String,
  temperatureHigh: Number, // ˚F
  temperatureHighTime: Number, // UNIX time
  temperatureLow: Number, // ˚F
  temperatureLowTime: Number, // UNIX Time
  dewPoint: Number, // ˚F
  humidity: Number, // %
  windSpeed: Number, // MPH
});

// Bull/Redis Jobs Queue
let WeatherQueue;

class Weather {
  constructor() {
    if (!Weather.WeatherInstance) {
      Weather.init();

      Weather.WeatherInstance = this;

      // Get yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      this.getWeatherData(yesterday, (weatherData) => {
        this.getForecastData(() => {
          log.debug(`processJob: Weather Conditions (${yesterday}) : ${JSON.stringify(weatherData)}`);
        });
      });
    }
    return Weather.WeatherInstance;
  }

  static async init() {
    try {
      WeatherQueue = new Queue('WeatherQueue', { redis: { host: 'redis' } });

      // Set Queue processor
      WeatherQueue.process(async (job, done) => {
        WeatherInstance.processJob(job, done);
      });

      // Get the weather every morning @ 3am
      WeatherQueue.add({ task: 'Get Weather!' },
        { repeat: { cron: '0 3 * * *' }, removeOnComplete: true });
    } catch (err) {
      log.error(`WeatherInit: Failed to create WEATHER queue: ${err}`);
    }
    log.debug('*** Weather Initialized!');
  }

  async processJob(job, done) {
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    log.debug(`processJob: Getting Weather Conditions @ (${yesterday})`);

    this.getWeatherData(yesterday, (weatherData) => {
      this.getForecastData(() => {
        log.debug(`processJob: Weather Conditions (${yesterday}) : ${JSON.stringify(weatherData)}`);
      });
    });

    done();
  }

  async getWeatherData(targetDate, callback) {
    this.getDarkSkyConditions(targetDate, async (darkSkyData) => {
      this.getCimisConditions(targetDate, async (cimisData) => {
        // Add weather entry to Database
        const weatherData = {
          eto: (cimisData !== null ? cimisData.DayAsceEto.Value : 0),
          solar: (cimisData !== null ? cimisData.DaySolRadAvg.Value : 0),
          wind: (darkSkyData !== null ? darkSkyData.windSpeed : 0),
          precip: (darkSkyData !== null ? (darkSkyData.precipIntensity * 24) : 0),
          precipProb: (darkSkyData !== null ? darkSkyData.precipProbability : 0),
          tempHi: (darkSkyData !== null ? darkSkyData.temperatureHigh : 0),
          tempLo: (darkSkyData !== null ? darkSkyData.temperatureLow : 0),
          humidity: (darkSkyData !== null ? darkSkyData.humidity : 0),
        };

        callback(await this.setConditions(targetDate, weatherData));
      });
    });
  }

  getForecastData(callback) {
    this.getDarkSkyForecast(async (darkSkyData) => {
      try {
        const dailyForecast = darkSkyData.data;

        // Clear old forecast data
        await db.delAsync(dbKeys.dbForecastKey);

        for (let day = 0; day < dailyForecast.length; day++) {
          const forecast = await forecastSchema.validate(dailyForecast[day]);
          const zcnt = await db.zaddAsync(dbKeys.dbForecastKey, forecast.time, JSON.stringify(forecast));
          if (zcnt < 1) {
            log.warning(`setDailyForecast: (${day}) NOT SET ${JSON.stringify(forecast)}`);
          }
        }
      } catch (err) {
        log.error(`setDailyForecast: error setting daily forecast (${err})`);
      }
      callback();
    });
  }

  async setConditions(targetDate, weatherData) {
    const dateScore = targetDate.getFullYear() + ('0' + (targetDate.getMonth() + 1)).slice(-2)
                                             + ('0' + targetDate.getDate()).slice(-2);

    weatherData.date = dateScore;
    try {
      const weather = await weatherSchema.validate(weatherData);
      const zcnt = await db.zaddAsync(dbKeys.dbWeatherKey, dateScore, JSON.stringify(weather));
      if (zcnt < 1) {
        log.debug(`setConditions: (${dateScore}) NOT SET ${JSON.stringify(weather)}`);
      }
      return (weather);
    } catch (err) {
      log.error(`setConditions: error setting conditions (${err})`);
    }
    return (null);
  }

  // Return the total precipitation for a given date range.
  // NOTE: Leading '(' excludes the score from the results
  async getConditions(startDate, endDate) {
    const startScore = '(' + startDate.getFullYear() + ('0' + (startDate.getMonth() + 1)).slice(-2)
                                               + ('0' + startDate.getDate()).slice(-2);
    const endScore = endDate.getFullYear() + ('0' + (endDate.getMonth() + 1)).slice(-2)
                                         + ('0' + endDate.getDate()).slice(-2);

    const redisWeather = await db.zrangebyscoreAsync(dbKeys.dbWeatherKey, startScore, endScore);

    const weather = [];
    for (let i = 0; i < redisWeather.length; i++) {
      weather.push(weatherSchema.validate(JSON.parse(redisWeather[i])));
    }

    return (await Promise.all(weather));
  }

  // Get 7-Day Forecast
  async getForecast() {
    const redisForecast = await db.zrangebyscoreAsync(dbKeys.dbForecastKey, '-inf', '+inf');
    const forecast = [];
    for (let i = 0; i < redisForecast.length; i++) {
      forecast.push(forecastSchema.validate(JSON.parse(redisForecast[i])));
    }

    return (await Promise.all(forecast));
  }

  // ONLY used for testing
  clearWeatherData(targetDate) {
    db.del(dbKeys.dbWeatherKey);
  }

  async getPrecip(startDate, endDate) {
    const weather = await this.getConditions(startDate, endDate);

    let precip = 0;
    for (let i = 0; i < weather.length; i++) {
      precip += weather[i].precip;
    }
    return (precip);
  }

  // Return the ETo for a given date range.
  // Default to ETr table if we don't have CIMIS data for particular day
  async getDailyETo(startDate, endDate) {
    const dailyETo = [];
    const etzone = await SettingsInstance.getETZone();
    const dailyETr = await ETrInstance.getDailyETr(etzone, new Date(startDate), new Date(endDate));

    // For each day of the given range, push Cimis ETo or ETr if it doesn't exist
    for (let i = 0, day = startDate; day <= endDate; i++, day.setDate(day.getDate() + 1)) {
      const cimisDate = day.getFullYear() + ('0' + (day.getMonth() + 1)).slice(-2)
                        + ('0' + day.getDate()).slice(-2);
      const cimisETo = await db.zrangebyscoreAsync(dbKeys.dbWeatherKey, cimisDate, cimisDate);

      if (cimisETo === null || cimisETo === '') {
        dailyETo.push(Number(cimisETo));
      } else {
        dailyETo.push(dailyETr[i]);
      }
    }

    return (dailyETo);
  }

  async getETo(startDate, endDate) {
    const dailyETo = await this.getDailyETo(startDate, endDate);

    let eto = 0;
    for (let i = 0; i < dailyETo.length; i++) {
      eto += dailyETo[i].eto;
    }
    return (eto);
  }

  // Get Conditions
  async getCurrentConditions(callback) {
    const url = darkskyWeatherURL + await SettingsInstance.getDarkSkyKey() + '/'
              + await SettingsInstance.getLong() + ',' + await SettingsInstance.getLat()
              + '?exclude=[daily,minutely,hourly,flags]';

    request({
      url: url,
      json: true,
    }, (error, response, body) => {
      let currently = null;
      if (error || response.statusCode !== 200) {
        log.error(`getCurrentConditions: error (${error}) response (${JSON.stringify(response)})`);
      } else {
        currently = body.currently;
      }

      callback(error, currently);
    });
  }

  // Get Conditions
  async getDarkSkyConditions(targetDate, callback) {
    const url = darkskyWeatherURL + await SettingsInstance.getDarkSkyKey() + '/'
              + await SettingsInstance.getLong() + ',' + await SettingsInstance.getLat() + ','
              + Math.round(targetDate.getTime() / 1000) + '?exclude=[currently,hourly]';

    request({
      url: url,
      json: true,
    }, (error, response, body) => {
      let darkSkyData = null;

      if (error || response.statusCode !== 200) {
        log.error(`getDarkSkyConditions(${targetDate}): error (${error}) response (${JSON.stringify(response)})`);
      } else {
        darkSkyData = body.daily.data[0];
      }

      callback(darkSkyData);
    });
  }

  // Get Forecast
  async getDarkSkyForecast(callback) {
    const url = darkskyWeatherURL + await SettingsInstance.getDarkSkyKey() + '/'
              + await SettingsInstance.getLong() + ',' + await SettingsInstance.getLat()
              + '?exclude=[currently,minutely,hourly,flags]';

    request({
      url: url,
      json: true,
    }, (error, response, body) => {
      let darkSkyData = null;

      if (error || response.statusCode !== 200) {
        log.error(`getDarkSkyForecast: error (${error}) response (${JSON.stringify(response)})`);
      } else {
        darkSkyData = body.daily;
      }

      callback(darkSkyData);
    });
  }

  // Get Conditions
  async getCimisConditions(targetDate, callback) {
    const dateString = targetDate.getFullYear() + '-' + (targetDate.getMonth() + 1) + '-' + targetDate.getDate();
    const url = cimisURL + await SettingsInstance.getCimisKey() + '&targets=' + await SettingsInstance.getZip()
              + '&startDate=' + dateString + '&endDate=' + dateString;

    request({
      url: url,
      json: true,
    }, (error, response, body) => {
      let cimisData = null;

      if (error || response.statusCode !== 200) {
        log.error(`getCimisConditions(${targetDate}): error (${error}) response (${JSON.stringify(response)})`);
      } else {
        cimisData = body.Data.Providers[0].Records[0];
      }

      callback(cimisData);
    });
  }
}

const WeatherInstance = new Weather();
Object.freeze(WeatherInstance);

module.exports = {
  WeatherInstance,
};
