const fs = require('fs');
const path = require('path');
const { LOGS_DIR } = require('./paths');

const LOG_FILE_NAME = 'execution.log';

function timestamp() {
  return new Date().toTimeString().slice(0, 8); // HH:MM:SS
}

function writeLine(line) {
  console.log(line);
  try {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
    fs.appendFileSync(path.join(LOGS_DIR, LOG_FILE_NAME), `${line}\n`);
  } catch (err) {
    // Un problema escribiendo el log a disco no debe interrumpir la prueba.
  }
}

function info(message) {
  writeLine(`${timestamp()} - ${message}`);
}

function error(message, err) {
  const detail = err && err.message ? ` - ${err.message}` : '';
  writeLine(`${timestamp()} - ERROR: ${message}${detail}`);
}

function testStart(title) {
  info(`Iniciando: ${title}`);
}

function testEnd(title, state, durationMs) {
  const durationLabel = typeof durationMs === 'number' ? ` (${durationMs}ms)` : '';
  info(`Finalizado: ${title} [${state}]${durationLabel}`);
}

/**
 * Marca el inicio de un paso y devuelve el timestamp para medir su duración con stepDone().
 */
function step(message) {
  info(message);
  return Date.now();
}

function stepDone(message, startedAt) {
  const durationLabel = typeof startedAt === 'number' ? ` (${Date.now() - startedAt}ms)` : '';
  info(`${message}${durationLabel}`);
}

module.exports = { info, error, testStart, testEnd, step, stepDone };
