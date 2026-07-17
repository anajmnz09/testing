#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { LATEST_DIR } = require('../utils/paths');

const reportPath = path.join(LATEST_DIR, 'html', 'index.html');

if (!fs.existsSync(reportPath)) {
  console.error('No existe un reporte generado todavía. Corre "npm test" o "npm run report:generate" primero.');
  process.exitCode = 1;
} else {
  let command;
  let args;

  if (process.platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '', reportPath];
  } else if (process.platform === 'darwin') {
    command = 'open';
    args = [reportPath];
  } else {
    command = 'xdg-open';
    args = [reportPath];
  }

  spawn(command, args, { stdio: 'ignore', detached: true }).unref();
  console.log(`Abriendo reporte: ${reportPath}`);
}
