'use strict';
const { tick } = require('./tick');

// Runs a tick now, then schedules the next one only after the previous finished
// (setTimeout chaining), so ticks never overlap. Errors are logged, never thrown.
function startPollerLoop(deps, { tickImpl = tick } = {}) {
  let stopped = false;
  let timer = null;

  async function run() {
    timer = null;
    try {
      const report = await tickImpl(deps);
      deps.log('info', `tick: ${report && report.action}`, report);
    } catch (e) {
      deps.log('error', `tick threw: ${e.message}`, { stack: e.stack });
    }
    if (!stopped) timer = setTimeout(run, deps.config.pollIntervalMs);
  }

  run();
  return {
    stop() {
      stopped = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

module.exports = { startPollerLoop };
