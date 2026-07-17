const fs = require('fs');
const path = require('path');

// Los reportes se escriben en el proyecto que ejecuta los tests (el módulo),
// NO dentro del core. Por eso la raíz se deriva del cwd del proceso (o de
// REPORTS_ROOT si el orquestador lo pasa explícitamente al proceso hijo),
// no de __dirname (que apuntaría a la carpeta del core).
const PROJECT_DIR = process.env.REPORTS_ROOT || process.cwd();
const ROOT_DIR = PROJECT_DIR;
const REPORTS_ROOT_DIR = path.join(PROJECT_DIR, 'reports');
const LATEST_DIR = path.join(REPORTS_ROOT_DIR, 'latest');

function pad(n) {
  return String(n).padStart(2, '0');
}

function generateRunId(date = new Date()) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`
  );
}

// El RUN_ID se calcula una sola vez por proceso. Si viene heredado por env
// (el proceso orquestador scripts/run-tests.js se lo pasa al proceso hijo de
// Mocha) se reutiliza el mismo, así todo un run cae en la misma carpeta.
// Si no viene (ej. correr mocha directo sin pasar por run-tests.js), se genera uno nuevo.
const RUN_ID = process.env.RUN_ID || generateRunId();

function getRunDir(runId = RUN_ID) {
  return path.join(REPORTS_ROOT_DIR, runId);
}

function getRunPaths(runId = RUN_ID) {
  const runDir = getRunDir(runId);
  return {
    runId,
    runDir,
    htmlDir: path.join(runDir, 'html'),
    jsonDir: path.join(runDir, 'json'),
    screenshotsDir: path.join(runDir, 'screenshots'),
    logsDir: path.join(runDir, 'logs'),
    evidenceDir: path.join(runDir, 'evidence'),
  };
}

const CURRENT = getRunPaths(RUN_ID);

function ensureRunDirs(runId = RUN_ID) {
  const p = getRunPaths(runId);
  [p.runDir, p.htmlDir, p.jsonDir, p.screenshotsDir, p.logsDir, p.evidenceDir].forEach((dir) => {
    fs.mkdirSync(dir, { recursive: true });
  });
  return p;
}

function listRuns() {
  if (!fs.existsSync(REPORTS_ROOT_DIR)) return [];
  return fs
    .readdirSync(REPORTS_ROOT_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== 'latest')
    .map((entry) => entry.name)
    .sort(); // el formato YYYY-MM-DD_HH-mm-ss ordena cronológicamente como string
}

function getLatestRunId() {
  const runs = listRuns();
  return runs.length ? runs[runs.length - 1] : null;
}

function pruneOldRuns(keep) {
  if (!Number.isFinite(keep) || keep <= 0) return [];
  const runs = listRuns();
  const excess = runs.length - keep;
  if (excess <= 0) return [];

  const toDelete = runs.slice(0, excess);
  toDelete.forEach((runId) => {
    fs.rmSync(getRunDir(runId), { recursive: true, force: true });
  });
  return toDelete;
}

function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function updateLatest(runId = RUN_ID) {
  const runDir = getRunDir(runId);
  if (!fs.existsSync(runDir)) return;

  fs.rmSync(LATEST_DIR, { recursive: true, force: true });
  copyDirSync(runDir, LATEST_DIR);
}

module.exports = {
  ROOT_DIR,
  REPORTS_ROOT_DIR,
  REPORTS_DIR: REPORTS_ROOT_DIR, // alias retrocompatible
  LATEST_DIR,
  RUN_ID,
  RUN_DIR: CURRENT.runDir,
  HTML_DIR: CURRENT.htmlDir,
  JSON_DIR: CURRENT.jsonDir,
  SCREENSHOTS_DIR: CURRENT.screenshotsDir,
  LOGS_DIR: CURRENT.logsDir,
  EVIDENCE_DIR: CURRENT.evidenceDir,
  ensureReportDirs: () => ensureRunDirs(RUN_ID),
  ensureRunDirs,
  generateRunId,
  getRunDir,
  getRunPaths,
  listRuns,
  getLatestRunId,
  pruneOldRuns,
  updateLatest,
};
