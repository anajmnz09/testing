#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const config = require('../config');
const paths = require('../utils/paths');
const { generateHtmlReport } = require('./generate-report');

function toGlobPath(p) {
  return p.split(path.sep).join('/');
}

/**
 * Resuelve el target de Mocha de forma tolerante a la carpeta desde la que se
 * invoca. npm normaliza el cwd a la raíz del módulo, pero el ARGUMENTO del path
 * se sigue interpretando desde ahí; entonces, parado en `tests/`, uno escribe el
 * nombre del archivo "pelado" y Mocha no lo encuentra. Este helper antepone
 * `tests/` cuando tiene sentido, así `npm test -- foo.test.js` funciona desde
 * cualquier lado, sin romper las formas que ya andaban.
 *
 * Reglas (conservadoras: solo reescribe cuando es claramente correcto):
 *  - ya apunta a `tests/…` o es ruta absoluta -> se deja igual.
 *  - existe tal cual desde la raíz del módulo -> se deja igual.
 *  - `tests/<target>` existe como archivo/carpeta -> se usa esa.
 *  - es un glob (`*?{[`) -> se asume dentro de `tests/`.
 *  - si nada aplica -> se deja igual (que Mocha reporte el error original).
 */
function resolverTarget(target) {
  const primerSeg = target.replace(/\\/g, '/').split('/')[0];
  if (primerSeg === 'tests' || path.isAbsolute(target)) return target;
  if (fs.existsSync(path.join(paths.ROOT_DIR, target))) return target;

  const prefijado = `tests/${target}`;
  if (fs.existsSync(path.join(paths.ROOT_DIR, prefijado))) return prefijado;
  if (/[*?{[]/.test(target)) return prefijado;
  return target;
}

async function runMocha(target) {
  // Se resuelven por nombre/ubicación del core (no por rutas del módulo), así
  // funciona con node_modules hoisteado por workspaces y desde cualquier módulo.
  const mochaEntry = require.resolve('mocha/bin/mocha.js');
  const rootHooksEntry = path.join(__dirname, '..', 'utils', 'mochaRootHooks.js');

  const jsonDirRelative = toGlobPath(path.relative(paths.ROOT_DIR, paths.JSON_DIR));

  const args = [
    mochaEntry,
    target,
    '--timeout', String(config.timeouts.testTimeoutMs),
    '--retries', String(config.retries),
    '--require', rootHooksEntry,
    '--reporter', 'mochawesome',
    '--reporter-options',
    `reportDir=${jsonDirRelative},reportFilename=results,json=true,html=false,overwrite=true,quiet=true`,
  ];

  const logPath = path.join(paths.LOGS_DIR, 'run-stdout.log');
  const logStream = fs.createWriteStream(logPath);

  const exitCode = await new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: paths.ROOT_DIR,
      shell: false,
      // REPORTS_ROOT garantiza que el proceso hijo (Mocha) escriba en la misma
      // carpeta de reportes del módulo que calculó el proceso padre.
      env: { ...process.env, RUN_ID: paths.RUN_ID, REPORTS_ROOT: paths.ROOT_DIR },
    });

    child.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      logStream.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      logStream.write(chunk);
    });
    child.on('close', (code) => resolve(code === null ? 1 : code));
  });

  logStream.end();

  return { exitCode, logPath };
}

async function main() {
  const targetSolicitado = process.argv[2] || 'tests';
  const target = resolverTarget(targetSolicitado);

  paths.ensureReportDirs();
  console.log(`Ejecución: ${paths.RUN_ID}`);
  console.log(
    target === targetSolicitado
      ? `Target: ${target}`
      : `Target: ${target} (resuelto desde "${targetSolicitado}")`
  );

  const { exitCode, logPath } = await runMocha(target);

  console.log('\nGenerando reporte HTML...');
  await generateHtmlReport(paths.RUN_ID);

  paths.updateLatest(paths.RUN_ID);

  const deleted = paths.pruneOldRuns(config.reports.keep);
  if (deleted.length) {
    console.log(`Retención (KEEP_REPORTS=${config.reports.keep}): se eliminaron ${deleted.length} ejecución(es) antigua(s): ${deleted.join(', ')}`);
  }

  console.log(`Reporte HTML: ${path.relative(paths.ROOT_DIR, path.join(paths.LATEST_DIR, 'html', 'index.html'))}`);
  console.log(`Reporte de esta ejecución: reports/${paths.RUN_ID}/html/index.html`);
  console.log(`Log de ejecución: ${path.relative(paths.ROOT_DIR, logPath)}`);

  process.exitCode = exitCode;
}

main().catch((err) => {
  console.error('Error ejecutando la suite:', err);
  process.exitCode = 1;
});
