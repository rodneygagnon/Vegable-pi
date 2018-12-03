/**
 * OSPi Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const {log} = require('./logger');

const gpio = require('pigpio').Gpio;

const Settings = require('../models/settings');

var OSPiConfig = {
  Status: {
    ON: 1,
    OFF: 0
  },

  Pins: {
    SRClock: 4,
    RainSensor: 14,
    SROutputDisable: 17,
    SRLatch: 22,
    SRData: 27
  }
}

let OSPiInstance;
let OSPiStationsBitMask = 0;

const getOSPiInstance = async (callback) => {
  if (OSPiInstance) {
    callback(OSPiInstance);
    return;
  }

  OSPiInstance = await new OSPi();
  log.debug("OSPi Constructed! ");
  await OSPiInstance.init(() => {
    log.debug("OSPi Initialized! ");
    callback(OSPiInstance);
  })
}

class OSPi {
  constructor() {
    this.enabled = false;
  }

  async init (callback) {

    Settings.getSettingsInstance(async (gSettings) => {
      this.config = gSettings;

      this.OSPiSRClock = new gpio(OSPiConfig.Pins.SRClock, {mode: gpio.OUTPUT});
      this.OSPiSROutputDisable = new gpio(OSPiConfig.Pins.SROutputDisable, {mode: gpio.OUTPUT});
      this.OSPiSRLatch = new gpio(OSPiConfig.Pins.SRLatch, {mode: gpio.OUTPUT});
      this.OSPiSRData = new gpio(OSPiConfig.Pins.SRData, {mode: gpio.OUTPUT});

      // pull shift register OD HIGH to disable output
      this.OSPiSROutputDisable.digitalWrite(OSPiConfig.Status.ON);

      this.OSPiSRLatch.digitalWrite(OSPiConfig.Status.ON);

      this.applyStationBitmask();

      // pull shift register OD LOW to ENABLE output
      this.OSPiSROutputDisable.digitalWrite(OSPiConfig.Status.OFF);

      // Setup Rain Sensor
      this.OSPiRainSensor = new gpio(OSPiConfig.Pins.RainSensor, {mode: gpio.INPUT});
      // attachInterrupt(PIN_RAINSENSOR, "falling", flow_isr);

      //TEMPORARY FOR TESTING
      this.OSPiSRLatch.digitalWrite(OSPiConfig.Status.OFF);
      // TEMPORARY FOR TESTING

      this.enabled = true;
      callback();
    });
  }

  async switchStation(stationId, value) {
    if (value)
      OSPiStationsBitMask |= value << (stationId - 1);
    else
      OSPiStationsBitMask &= ~(!value << (stationId - 1));

    log.debug(`switchStation: Station Bitmask: 0x${OSPiStationsBitMask.toString(16)}`)

    this.applyStationBitmask();
  }

  async applyStationBitmask() {
    // turn off the latch pin
    this.OSPiSRLatch.digitalWrite(OSPiConfig.Status.OFF);

    log.debug(`  -- apply OSPI bitmask: 0x${OSPiStationsBitMask.toString(16)}`)

    var numStations = await this.config.getZones();
    for (var i = 0; i < numStations; i++) {
      var value = (OSPiStationsBitMask & (0x01 << ((numStations-1) - i))) ? OSPiConfig.Status.ON : OSPiConfig.Status.OFF;

      this.OSPiSRClock.digitalWrite(OSPiConfig.Status.OFF);
      this.OSPiSRData.digitalWrite(value);
      this.OSPiSRClock.digitalWrite(OSPiConfig.Status.ON);
    }

    // latch the outputs
    this.OSPiSRLatch.digitalWrite(OSPiConfig.Status.ON);
  }
}

module.exports = {
  OSPi,
  getOSPiInstance
};
