/**
 * OSPi Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const fs = require('fs');
const gpio = require('onoff').Gpio;

const {log} = require('./logger');
const {SettingsInstance} = require('../models/settings');

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

let OSPiStationsBitMask = 0;

class OSPi {
  constructor() {
    if (!OSPi.OSPiInstance) {
      this.enabled = false;

      OSPi.init();

      OSPi.OSPiInstance = this;
    }
    return OSPi.OSPiInstance;
  }

  static async init () {
    // Read the RPi System info before initilizing OSPi
    await this.getRPiInformation();
    if (typeof this.rpiRevision === 'undefined' || this.rpiRevision === 0) {
      log.debug(`*** We are not running on a rPi ***`);
      log.debug(`    RPI Info: Revision(${this.rpiRevision}) Serial(${this.rpiSerial})`);
    } else {
      this.zoneCount = await SettingsInstance.getZones();

      this.OSPiSRClock = new gpio(OSPiConfig.Pins.SRClock, 'out');
      this.OSPiSROutputDisable = new gpio(OSPiConfig.Pins.SROutputDisable, 'out');
      this.OSPiSRLatch = new gpio(OSPiConfig.Pins.SRLatch, 'out');
      this.OSPiSRData = new gpio(OSPiConfig.Pins.SRData, 'out');

      // pull shift register OD HIGH to disable output
      this.OSPiSROutputDisable.writeSync(OSPiConfig.Status.ON);

      this.OSPiSRLatch.writeSync(OSPiConfig.Status.ON);

      this.applyStationBitmask();

      // pull shift register OD LOW to ENABLE output
      this.OSPiSROutputDisable.writeSync(OSPiConfig.Status.OFF);

      // Setup Rain Sensor
      this.OSPiRainSensor = new gpio(OSPiConfig.Pins.RainSensor, 'in');
      // attachInterrupt(PIN_RAINSENSOR, "falling", flow_isr);

      // TEMPORARY FOR TESTING
      this.OSPiSRLatch.writeSync(OSPiConfig.Status.OFF);
      // TEMPORARY FOR TESTING

      this.enabled = true;
    }
    log.debug(`*** OSPi Initialized!`);
  }

  static getRPiInformation() {
    // Get Device Info
    var obj = fs.readFileSync('/proc/cpuinfo', 'utf8');
    var lines = obj.split('\n');

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      if (line.startsWith('Revision'))
        this.rpiRevision = line.split(':')[1].trim();

      if (line.startsWith('Serial'))
          this.rpiSerial = line.split(':')[1].trim();
    }
  }

  async switchStation(stationId, value) {
    if (this.enabled === false)
      return;

    if (value)
      OSPiStationsBitMask |= value << (stationId - 1);
    else
      OSPiStationsBitMask &= ~(!value << (stationId - 1));

    this.applyStationBitmask();
  }

  async applyStationBitmask() {
    if (this.enabled === false)
      return;

    // turn off the latch pin
    this.OSPiSRLatch.writeSync(OSPiConfig.Status.OFF);

    log.debug(`  -- OSPI apply bitmask: 0x${OSPiStationsBitMask.toString(16)}`)

    for (var i = 0; i < this.zoneCount; i++) {
      var value = (OSPiStationsBitMask & (0x01 << ((numStations-1) - i))) ? OSPiConfig.Status.ON : OSPiConfig.Status.OFF;

      this.OSPiSRClock.writeSync(OSPiConfig.Status.OFF);
      this.OSPiSRData.writeSync(value);
      this.OSPiSRClock.writeSync(OSPiConfig.Status.ON);
    }

    // latch the outputs
    this.OSPiSRLatch.writeSync(OSPiConfig.Status.ON);
  }
}

const OSPiInstance = new OSPi();
Object.freeze(OSPiInstance);

module.exports = {
  OSPiInstance
}
