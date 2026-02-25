const finder = require('./finder');
const patcher = require('./patcher');
const watcher = require('./watcher');

module.exports = {
  ...finder,
  ...patcher,
  ...watcher
};
