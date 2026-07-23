const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Entorno de la corrida UNITARIA. Se carga con `--require` antes que cualquier
 * spec (ver `.mocharc.json` del core).
 *
 * Por qué existe: varios módulos del core resuelven sus rutas al importarse
 * (`paths`, `logger`) y, sin esto, una corrida unitaria dejaría una carpeta
 * `core/reports/` con logs sueltos. Apuntando `REPORTS_ROOT` a una carpeta
 * temporal, las pruebas unitarias no ensucian el repositorio y el framework
 * queda intacto: no se cambia una línea de producción para poder testear.
 *
 * Ojo: esto NO reemplaza a `proyectoTemporal` en los specs que verifican
 * escritura en disco — esos necesitan su propia carpeta aislada por prueba.
 */
const RAIZ_TEMPORAL = fs.mkdtempSync(path.join(os.tmpdir(), 'triple-core-unit-run-'));

process.env.REPORTS_ROOT = RAIZ_TEMPORAL;
process.env.RUN_ID = 'unit';
// Las pruebas unitarias no hablan con ninguna aplicación ni usan credenciales.
// Se PRE-FIJAN vacías (BASE_URL, APP_USERNAME, PASSWORD) antes de que el core
// cargue el .env: dotenv no sobreescribe una variable ya definida, así que un
// .env presente en la máquina (necesario para los E2E) no filtra credenciales
// a la suite unitaria. Es exactamente lo que verifica el contrato de la suite.
process.env.BASE_URL = '';
process.env.APP_USERNAME = '';
process.env.PASSWORD = '';

exports.mochaGlobalTeardown = function () {
  fs.rmSync(RAIZ_TEMPORAL, { recursive: true, force: true });
};

exports.RAIZ_TEMPORAL = RAIZ_TEMPORAL;
