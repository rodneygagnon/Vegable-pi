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

var enabled = false;
var zoneCount = 0;

var OSPiSRClock,
    OSPiSROutputDisable,
    OSPiSRLatch,
    OSPiSRData,
    OSPiSROutputDisable,
    OSPiRainSensor;
var OSPiStationsBitMask = 0;

class OSPi {
  constructor() {
    if (!OSPi.OSPiInstance) {
      OSPi.enabled = false;
      OSPi.init();
      OSPi.OSPiInstance = this;
    }
    return OSPi.OSPiInstance;
  }

  static async init () {
    // Read the RPi System info before initilizing OSPi
    var rpiInfo = await OSPi.getRPiInformation();
    if (typeof rpiInfo.revision === 'undefined' || rpiInfo.revision === 0) {
      log.debug(`*** OSPi NOT Initialized (We are not running on a rPi)!`);
      return;
    }

    OSPi.enabled = true;
    OSPi.zoneCount = await SettingsInstance.getZones();

    OSPi.OSPiSRClock = new gpio(OSPiConfig.Pins.SRClock, 'out');
    OSPi.OSPiSROutputDisable = new gpio(OSPiConfig.Pins.SROutputDisable, 'out');
    OSPi.OSPiSRLatch = new gpio(OSPiConfig.Pins.SRLatch, 'out');
    OSPi.OSPiSRData = new gpio(OSPiConfig.Pins.SRData, 'out');

    // pull shift register OD HIGH to disable output
    OSPi.OSPiSROutputDisable.writeSync(OSPiConfig.Status.ON);

    OSPi.OSPiSRLatch.writeSync(OSPiConfig.Status.ON);

    OSPiInstance.applyStationBitmask();

    // pull shift register OD LOW to ENABLE output
    OSPi.OSPiSROutputDisable.writeSync(OSPiConfig.Status.OFF);

    // Setup Rain Sensor
    OSPi.OSPiRainSensor = new gpio(OSPiConfig.Pins.RainSensor, 'in');
    // attachInterrupt(PIN_RAINSENSOR, "falling", flow_isr);

    // TEMPORARY FOR TESTING
    OSPi.OSPiSRLatch.writeSync(OSPiConfig.Status.OFF);
    // TEMPORARY FOR TESTING

    log.debug(`*** OSPi Initialized!`);
  }

  static getRPiInformation() {
    // Get Device Info
    var obj = fs.readFileSync('/proc/cpuinfo', 'utf8');
    var lines = obj.split('\n');

    var revision, serial;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      if (line.startsWith('Revision'))
        revision = line.split(':')[1].trim();

      if (line.startsWith('Serial'))
        serial = line.split(':')[1].trim();
    }

    log.debug(`rPi System Info: Revision(${revision}) Serial(${serial})`);

    return({revision: revision, serial: serial});
  }

  async switchStation(stationId, value) {
    if (!OSPi.enabled)
      return;

    if (value)
      OSPiStationsBitMask |= value << (stationId - 1);
    else
      OSPiStationsBitMask &= ~(!value << (stationId - 1));

    OSPiInstance.applyStationBitmask();
  }

  async applyStationBitmask() {
    // turn off the latch pin
    OSPi.OSPiSRLatch.writeSync(OSPiConfig.Status.OFF);

    log.debug(`  -- OSPI apply bitmask: 0x${OSPiStationsBitMask.toString(16)}`)

    for (var i = 0; i < OSPi.zoneCount; i++) {
      var value = (OSPiStationsBitMask & (0x01 << ((OSPi.zoneCount-1) - i))) ? OSPiConfig.Status.ON : OSPiConfig.Status.OFF;

      OSPi.OSPiSRClock.writeSync(OSPiConfig.Status.OFF);
      OSPi.OSPiSRData.writeSync(value);
      OSPi.OSPiSRClock.writeSync(OSPiConfig.Status.ON);
    }

    // latch the outputs
    OSPi.OSPiSRLatch.writeSync(OSPiConfig.Status.ON);
  }
}

const OSPiInstance = new OSPi();
Object.freeze(OSPiInstance);

module.exports = {
  OSPiInstance
}
