#!/usr/bin/env node
const path = require('path');
const { merge } = require('mochawesome-merge');
const marge = require('mochawesome-report-generator');
const paths = require('../utils/paths');

async function generateHtmlReport(runId = paths.RUN_ID) {
  const resolved = paths.ensureRunDirs(runId);

  const jsonGlob = path.join(resolved.jsonDir, '*.json').split(path.sep).join('/');
  const mergedJson = await merge({ files: [jsonGlob] });

  await marge.create(mergedJson, {
    reportDir: resolved.htmlDir,
    reportFilename: 'index',
    reportTitle: 'Reporte de Automatización QA',
    reportPageTitle: 'Reporte de Pruebas - Selenium',
    inline: true,
    charts: true,
    overwrite: true,
  });

  return resolved;
}

module.exports = { generateHtmlReport };

if (require.main === module) {
  // Invocado standalone (npm run report:generate): si no viene un RUN_ID
  // explícito por env, regenera el reporte de la ejecución más reciente en
  // vez de crear una carpeta de run nueva y vacía.
  const runId = process.env.RUN_ID || paths.getLatestRunId();

  if (!runId) {
    console.error('No hay ninguna ejecución previa en reports/. Corré "npm test" primero.');
    process.exitCode = 1;
  } else {
    generateHtmlReport(runId)
      .then((resolved) => {
        paths.updateLatest(runId);
        console.log(`Reporte HTML generado en reports/${runId}/html/index.html (y copiado a reports/latest/)`);
      })
      .catch((err) => {
        console.error('Error generando el reporte:', err);
        process.exitCode = 1;
      });
  }
}
