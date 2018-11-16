/**
 * Programs Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
const {log} = require('../controllers/logger');

const uuidv4 = require('uuid/v4');
const Queue = require("bull");

const Config = require('./config');

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const programSchema = schema({
  id: String,          // Program UUID
  sid: Number,         // Station ID
  title: String,
  start: String, // ISO8601
  end: String, // ISO8601
  operations: Array     // List of things to do
});

const OPS = {
  irrgation: 0,
  fertigation: 1
}
Object.freeze(OPS);

const operationSchema = schema({
  type: Number,         // OPS
  amount: Number        // Liters
});

const ProgramsQueue = new Queue('ProgramsQueue');

let ProgramsInstance;

const getProgramsInstance = async (callback) => {
  if (ProgramsInstance) {
   callback(ProgramsInstance);
   return;
  }

  ProgramsInstance = await new Programs();
  log.debug("Programs Constructed! ");
  await ProgramsInstance.init(() => {
   log.debug("Programs Initialized! ");
   callback(ProgramsInstance);
  })
}

class Programs {
  constructor() {
    this.config = null;
  }

  async init(callback) {
    Config.getConfigInstance(async (gConfig) => {
      this.config = gConfig;

      // Set Queue processor
      ProgramsQueue.process(async (job, done) => {
        log.debug(`ProcessQueue.process: (job):${JSON.stringify(job)}`);
        done();
      });

      callback();
    });
  }

  async getPrograms(callback) {
    var programs = [];

    var redisPrograms = await db.hvalsAsync(dbKeys.dbProgramsKey);

    log.debug(`getPrograms: (${redisPrograms.length})`);

    for (var i = 0; i < redisPrograms.length; i++)
      programs[i] = await programSchema.validate(JSON.parse(redisPrograms[i]));

    callback(programs);
  }

// Update a program. Create if it doesn't exist. Delete if action=='delete'
  async updateProgram(program, action, callback) {
    try {
      var validProgram = await programSchema.validate(program);
      var savedProgram = JSON.parse(await db.hgetAsync(dbKeys.dbProgramsKey, validProgram.id));

      if (savedProgram) {
        if (action === 'delete') {
          log.debug(`updateProgram(delete): savedProgram(${JSON.stringify(savedProgram)})`);
          await db.hdelAsync(dbKeys.dbProgramsKey, savedProgram.id);

          // TODO: Remove job from bull queue
        } else {
          log.debug(`updateProgram(update): savedProgram(${JSON.stringify(savedProgram)})`);
          savedProgram.sid = validProgram.sid;
          savedProgram.title = validProgram.title;
          savedProgram.start = validProgram.start;
          savedProgram.end = validProgram.end;

          await db.hsetAsync(dbKeys.dbProgramsKey, savedProgram.id, JSON.stringify(savedProgram));
        }
      } else {
        log.debug(`updateProgram(create): validProgram(${JSON.stringify(validProgram)})`);

        // Assign a uuidv
        validProgram.id = uuidv4();

        await db.hsetAsync(dbKeys.dbProgramsKey, validProgram.id, JSON.stringify(validProgram));

        // Add event to the ProgramsQueue
        const job = await ProgramsQueue.add(validProgram, { jobId: validProgram.id, removeOnComplete: true });
        log.debug(`ProcessQueue.add: (job):${JSON.stringify(job)}`);
      }
    } catch (err) {
      log.error("updateProgram Failed to save program: " + err);
    }

    callback();
  }
}

module.exports = {
   Programs,
   getProgramsInstance
};
