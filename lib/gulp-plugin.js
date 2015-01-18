'use strict';

var chalk = require('chalk')
  , through2 = require('through2')
  , poirot = require('./poirot')
  , PluginError = require('gulp-util').PluginError;

var PLUGIN_NAME = 'gulp-poirot';

module.exports = function() {
  //if (!transformFn) {
  //  throw new PluginError(PLUGIN_NAME,
  //    PLUGIN_NAME +
  //    ': Missing transform function!');
  //}
  return through2.obj(function(file, enc, cb) {
    //if (file.isStream()) {
    //  return this.emit('error',
    //    new PluginError(
    //      PLUGIN_NAME,
    //      PLUGIN_NAME + ': Streaming not supported'));
    //}
    var self = this;
    try {
      if (file.isBuffer()) {
        console.log(require('lodash').keys(file));
        console.log(file.history);
        console.log(file.path);
        file.path = file.path.replace(/\.html?$/, '.js');
        file.contents = new Buffer(poirot.compile(String(file.contents)));
        cb(null, file);
      } else if (file.isStream()) {
        return this.emit('error',
          new PluginError(
            PLUGIN_NAME,
            PLUGIN_NAME + ': Doesn\'t support streams'));
      }
    } catch (e) {
      console.log(chalk.red(e));
      return this.emit('error',
        new PluginError(
          PLUGIN_NAME,
          PLUGIN_NAME + ': Unable to transform "' + file.path +
          '" maybe it\'s not a valid HTML file.'));
    }
  });
};
