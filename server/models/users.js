/**
 * Users Singleton
 *
 * @author: rgagnon
 * @copyright 2018 vegable.io
 */
'use strict';

const bcrypt = require('bcryptjs');
const uuidv4 = require('uuid/v4');

const {log} = require('../controllers/logger');

const Settings = require('./settings');

const {db} = require("./db");
const {dbKeys} = require("./db");

const schema = require("schm");
const userSchema = schema({
  id: Number,
  name: String,
  email: String,
  password: String
});

let UsersInstance;

const getUsersInstance = async (callback) => {
  if (UsersInstance) {
    callback(UsersInstance);
    return;
  }

  UsersInstance = await new Users();
  await UsersInstance.init(() => {
    log.debug("*** Users Initialized! ");
    callback(UsersInstance);
  })
}

class Users {
  constructor() {
    this.config = null;
  }

  async init(callback) {

    Settings.getSettingsInstance(async (gSettings) => {
      this.config = gSettings;

      this.salt = bcrypt.genSaltSync(10);

      var userCount = await db.hlenAsync(dbKeys.dbUsersKey);

      // Create default user if necessary
      if (userCount == 0) {
        var user = {id: uuidv4(), name: await this.config.getDefaultUser(),
                    email: await this.config.getDefaultEmail(),
                    password: bcrypt.hashSync(await this.config.getDefaultPassword(), this.salt)};

        if (!await db.hsetAsync(dbKeys.dbUsersKey, user.email, JSON.stringify(user)))
          log.debug(`User Init: failed to add default user (${user})`);

        userCount = await db.hlenAsync(dbKeys.dbUsersKey);
      }

      callback();
    });
  }

  async getUsers(callback) {
    var users = [];

    var redisUsers = await db.hvalsAsync(dbKeys.dbUsersKey);
    for (var i = 0; i < redisUsers.length; i++)
      users[i] = await usersSchema.validate(JSON.parse(redisUsers[i]));

    callback(users);
  }

  async getUser(email) {
    var user = null;
    try {
      user = JSON.parse(await db.hgetAsync(dbKeys.dbUsersKey, email));
    } catch (err) {
      log.error("getUser Failed to get user: " + err);
    }
    return user;
  }

  async validateUser(username, password) {
    var validUser = null;
    try {
      var user = await this.getUser(username);
      if (user) {
        if (username === user.email) {
          try {
            if (bcrypt.compareSync(password, user.password))
              validUser = user;
          } catch (err) {
            log.error(`validateUser: password failed: ${err}`);
          }
        } else {
          log.error(`validateUser: invalid email (${username})`);
        }
      } else
        log.error(`validateUser: user does not exist (${username})`);
    } catch (err) {
      log.error(`getUser Failed to get user: ${err}`);
    }
    return validUser;
  }

  // Update a user. Create if it doesn't exist. Delete if action=='delete'
  async updateUser(user, action, callback) {
    log.debug(`updateUser: (${JSON.stringify(user)})`);

      try {
        var validUser = await userSchema.validate(user);

        let savedUser = null;

        // id is set if we are updating/deleting a user, go find them
        if (typeof user.id !== 'undefined' && user.id !== "") {
          var redisUsers = await db.hvalsAsync(dbKeys.dbUsersKey);

          log.debug(`updateUser(count): ${redisUsers.length}`);

          for (var i = 0; i < redisUsers.length; i++) {
            var user = await usersSchema.validate(JSON.parse(redisUsers[i]));

            if (user.email === validUser.email) {
              savedUser = user;
              log.debug(`updateUser(found): del old user(${JSON.stringify(savedUser)})`);
              break;
            }
          }
        }

        if (savedUser) {
          if (action === 'delete') { // DELETE a schedule
            log.debug(`updateUser(delete): del old user(${removeUser})`);
            await db.hdelAsync(dbKeys.dbUsersKey, removeUser.id);

          } else { // UPDATE a user
            savedUser.id = validUser.id;
            savedUser.name = validUser.name;
            savedUser.email = validUser.email;
            savedUser.password = bcrypt.hashSync(validUser.password, this.salt);

            log.debug(`updateUser(update): update user(${JSON.stringify(savedUser)})`);

            if (!await db.hsetAsync(dbKeys.dbUsersKey, savedUser.id, JSON.stringify(savedUser)))
              log.debug(`updateUser(update): failed to update (${savedUser})`);
          }

        // CREATE a new user
        } else {
          log.debug(`updateUser(create): validUser(${JSON.stringify(validUser)})`);

          // Assign a uuidv
          validUser.id = uuidv4();
          validUser.password = bcrypt.hashSync(validUser.password, this.salt);

          if (!await db.hsetAsync(dbKeys.dbUsersKey, validUser.email, JSON.stringify(validUser)))
            log.debug(`updateUser(update): failed to update (${validUser})`);
        }
      } catch (err) {
        log.error("updateUser Failed to save user: " + err);
      }

      callback();
    }
}

module.exports = {
  UsersInstance,
  getUsersInstance
};
