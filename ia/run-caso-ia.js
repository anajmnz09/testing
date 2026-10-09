#!/usr/bin/env node
'use strict';

/**
 * Runner de CASOS DE USO IA (independiente de los tests y de los Flujos): lee un PDF con la especificación de
 * un caso de uso, se la envía al modelo (OpenAI) y deja que el modelo opere la aplicación real por Selenium hasta
 * PASS / FAIL / BLOCKED, guardando la evidencia.
 *
 *   node ia/run-caso-ia.js <ruta-al-pdf>
 *
 * Entorno (nunca en el frontend; ver GUIDELINES §13):
 *   OPENAI_API_KEY   obligatoria · OPENAI_MODEL (def. gpt-6.1-sol) · OPENAI_BASE_URL (opcional)
 *   IA_MAX_ACCIONES (def. 40) · IA_MAX_MINUTOS (def. 20) · BASE_URL / APP_USERNAME / PASSWORD / HEADLESS (los de siempre)
 *
 * Salida: `ia/reports/<RUN_ID>/` (screenshots, logs, resultado.json, acciones.json, entrada.pdf). Código de salida:
 * 0 PASS · 1 FAIL · 3 BLOCKED. No usa flowContext/planner/requires/produces ni toca tests ni Page Objects.
 */
const fs = require('fs');
const path = require('path');

const RAIZ_IA = __dirname;

// Los reportes de IA van a ia/reports/<RUN_ID>/ (core/utils/paths lee estas variables al cargarse).
const pad = (n) => String(n).padStart(2, '0');
const ahora = new Date();
const RUN_ID =
  process.env.RUN_ID ||
  `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}_${pad(ahora.getHours())}-${pad(ahora.getMinutes())}-${pad(ahora.getSeconds())}`;
process.env.RUN_ID = RUN_ID;
process.env.REPORTS_ROOT = RAIZ_IA;

// La API key puede vivir en ia/.env (propio de esta función) o en el .env raíz; el core ya carga el segundo.
require('dotenv').config({ path: path.join(RAIZ_IA, '.env') });
const { createDriver, quitDriver } = require('@triple/core/utils/driver');
const authFlow = require('@triple/core/flows/authFlow');
const config = require('@triple/core/config');
const logger = require('@triple/core/utils/logger');
const paths = require('@triple/core/utils/paths');
const { sanitizeFileName } = require('@triple/core/utils/screenshot');
const chromeProfiles = require('@triple/core/utils/chromeProfiles');
const cliente = require('./clienteOpenAI');
const { crearNavegador } = require('./navegador');
const { ejecutarCaso } = require('./ejecutor');
const { extraerTexto } = require('./pdf');

const MAX_PDF_BYTES = 30 * 1024 * 1024;
const entero = (v, def) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : def);

function leerPdf(ruta) {
  if (!ruta) throw new Error('Uso: node ia/run-caso-ia.js <ruta-al-pdf>');
  if (!fs.existsSync(ruta) || !fs.statSync(ruta).isFile()) throw new Error(`No existe el PDF: ${ruta}`);
  const buf = fs.readFileSync(ruta);
  if (buf.length > MAX_PDF_BYTES) throw new Error('El PDF supera 30 MB.');
  if (buf.slice(0, 5).toString('latin1') !== '%PDF-') throw new Error('El archivo no es un PDF válido.');
  return buf;
}

/** Evidencia de la corrida: capturas numeradas + registro de acciones. */
function crearEvidencia(dirs) {
  const capturas = [];
  const acciones = [];
  return {
    capturas,
    acciones,
    guardarCaptura(base64, etiqueta) {
      const n = String(capturas.length + 1).padStart(2, '0');
      const archivo = `${n}_${sanitizeFileName(etiqueta) || 'captura'}.png`;
      fs.writeFileSync(path.join(dirs.screenshotsDir, archivo), base64, 'base64');
      capturas.push({ archivo, etiqueta });
      return archivo;
    },
    registrarAccion(a) {
      acciones.push({ ...a, t: new Date().toISOString() });
    },
  };
}

async function main() {
  const inicio = new Date();
  paths.ensureReportDirs();
  const dirs = paths.getRunPaths();
  console.log(`Reportes IA: ${RUN_ID}`);

  const evidencia = crearEvidencia(dirs);
  const salida = { runId: RUN_ID, inicio: inicio.toISOString(), modelo: cliente.leerConfiguracion().modelo };
  let driver = null;
  let resultado;

  try {
    const pdf = leerPdf(process.argv[2]);
    fs.writeFileSync(path.join(dirs.runDir, 'entrada.pdf'), pdf);
    salida.pdf = { nombre: path.basename(process.argv[2]), bytes: pdf.length };
    // El TEXTO del caso es la fuente principal. El PDF solo se adjunta (referencia visual opcional) si trae imágenes
    // de contenido o si el texto no se pudo extraer bien (p. ej. PDF escaneado).
    const info = extraerTexto(pdf);
    const adjuntarPdf = !info.suficiente || info.imagenes > 0;
    salida.especificacion = {
      paginas: info.paginas,
      caracteres: info.texto.length,
      imagenes: info.imagenes,
      textoSuficiente: info.suficiente,
      pdfAdjunto: adjuntarPdf,
      motivoPdf: !info.suficiente ? 'texto insuficiente (se envía el PDF para que el modelo lo lea)' : info.imagenes > 0 ? 'contiene imágenes (referencia visual opcional)' : null,
    };
    fs.writeFileSync(path.join(dirs.runDir, 'especificacion.txt'), info.texto);
    logger.info(`ia: especificación ${info.paginas} pág., ${info.texto.length} caracteres de texto, ${info.imagenes} imagen(es); PDF adjunto: ${adjuntarPdf ? 'sí' : 'no'}`);
    if (!cliente.leerConfiguracion().apiKey) {
      throw Object.assign(new Error('Falta OPENAI_API_KEY (defínela en el .env raíz o en ia/.env; solo la lee el servidor).'), { bloqueo: true });
    }

    driver = await createDriver();
    await authFlow.login(driver);
    const baseUrl = process.env.BASE_URL;
    logger.info(`ia: sesión iniciada; modelo ${salida.modelo}`);

    resultado = await ejecutarCaso({
      crearMensaje: (cuerpo) => cliente.crearMensaje(cuerpo),
      navegador: crearNavegador(driver, { baseUrl }),
      evidencia,
      texto: info.texto,
      pdfBase64: adjuntarPdf ? pdf.toString('base64') : null,
      imagenes: info.imagenes,
      maxAcciones: entero(process.env.IA_MAX_ACCIONES, 40),
      maxMs: entero(process.env.IA_MAX_MINUTOS, 20) * 60 * 1000,
      log: (m) => logger.info(`ia: ${m}`),
    });
  } catch (e) {
    logger.error(`ia: ${e.message}`);
    resultado = { estado: 'BLOCKED', resumen: '', motivo: e.message, verificaciones: [], acciones: evidencia.acciones.length, uso: { entrada: 0, salida: 0 } };
  } finally {
    if (driver) {
      if (config.panel.mantenerNavegadorAbierto) logger.info('KEEP_BROWSER_OPEN activo: el navegador queda abierto.');
      else await quitDriver(driver).catch((e) => logger.warn(`ia: no se pudo cerrar el navegador (${e.message})`));
    }
  }

  const fin = new Date();
  const final = { ...salida, ...resultado, fin: fin.toISOString(), duracionMs: fin - inicio, capturas: evidencia.capturas };
  fs.writeFileSync(path.join(dirs.runDir, 'resultado.json'), JSON.stringify(final, null, 2));
  fs.writeFileSync(path.join(dirs.runDir, 'acciones.json'), JSON.stringify(evidencia.acciones, null, 2));

  try {
    const r = chromeProfiles.limpiarPerfiles();
    console.log(`Limpieza automática post-ejecución: perfiles Chrome eliminados ${r.eliminados}; residuales ${chromeProfiles.contarPerfiles()}`);
    paths.pruneOldRuns(config.reports.keep);
  } catch (e) {
    console.log(`Limpieza automática post-ejecución: ADVERTENCIA — ${e.message}`);
  }

  console.log(`Resultado IA: ${final.estado} — ${final.motivo || final.resumen || ''}`.trim());
  console.log(`@@IA_RESULTADO@@${JSON.stringify({ runId: RUN_ID, estado: final.estado })}`);
  process.exitCode = final.estado === 'PASS' ? 0 : final.estado === 'FAIL' ? 1 : 3;
}

main().catch((e) => {
  console.error('Error en el runner IA:', e.message);
  process.exitCode = 3;
});
