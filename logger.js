// https://github.com/probot/probot/blob/v6.2.1/lib/logger.js

const Logger = require('bunyan');
const bunyanFormat = require('bunyan-format');

// Return a function that defaults to "info" level, and has properties for
// other levels:
//
//     robot.log("info")
//     robot.log.trace("verbose details");
//
Logger.prototype.wrap = function() {
  const fn = this.info.bind(this);

  // Add level methods on the logger
  ['trace', 'debug', 'info', 'warn', 'error', 'fatal'].forEach(level => {
    fn[level] = this[level].bind(this);
  });

  // Expose `child` method for creating new wrapped loggers
  fn.child = attrs => {
    // Bunyan doesn't allow you to overwrite name…
    const name = attrs.name;
    delete attrs.name;
    const log = this.child(attrs, true);

    // …Sorry, bunyan, doing it anwyway
    if (name) log.fields.name = name;

    return log.wrap();
  };

  // Expose target logger
  fn.target = logger;

  return fn;
};

const logger = new Logger({
  name: 'service-hooks-checker',
  level: process.env.LOG_LEVEL || 'info',
  stream: bunyanFormat({ outputMode: process.env.LOG_FORMAT || 'short' }, process.stderr)
});

module.exports = logger;
