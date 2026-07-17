#!/usr/bin/env node
const fs = require('fs');
const paths = require('../utils/paths');

const runs = paths.listRuns();

runs.forEach((runId) => {
  fs.rmSync(paths.getRunDir(runId), { recursive: true, force: true });
});

fs.rmSync(paths.LATEST_DIR, { recursive: true, force: true });

// No se pre-crea una carpeta de run nueva: eso lo hace la próxima vez que
// corra "npm test". Solo se garantiza que reports/ exista como carpeta raíz.
fs.mkdirSync(paths.REPORTS_ROOT_DIR, { recursive: true });

console.log(
  runs.length
    ? `Se eliminaron ${runs.length} ejecución(es) anterior(es) (${runs.join(', ')}) y reports/latest/.`
    : 'No había ejecuciones anteriores que limpiar.'
);
console.log('reports/ queda vacío hasta la próxima corrida de "npm test".');
