const { initAgenda, scheduleWeekly, cancelWeekly, getStatus } = require('./agenda');

module.exports = {
  start: async () => initAgenda(),
  scheduleWeekly,
  cancelWeekly,
  getStatus,
};
