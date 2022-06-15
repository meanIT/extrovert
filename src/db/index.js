'use strict';

const mongoose = require('mongoose');
const taskSchema = require('./task');

exports.db = null;

exports.registerExtrovertModels = function registerExtrovertModels(conn) {
  if (conn == null) {
    conn = mongoose;
  }

  conn.model('_Task', taskSchema, '_Task');

  exports.db = conn;

  return conn;
};