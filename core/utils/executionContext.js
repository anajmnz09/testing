const os = require('os');
const config = require('../config');

function inferEnvironment(baseUrl) {
  if (process.env.TEST_ENVIRONMENT) return process.env.TEST_ENVIRONMENT;
  if (!baseUrl) return 'DESCONOCIDO';
  if (/localhost|127\.0\.0\.1/i.test(baseUrl)) return 'LOCAL';
  if (/\btest\.|\bqa\./i.test(baseUrl)) return 'QA/TEST';
  if (/\bprod\.|\bwww\./i.test(baseUrl)) return 'PRODUCCIÓN';
  return 'QA/TEST';
}

// NOTA: no se lee process.env.USERNAME. En Windows es una variable reservada
// del sistema operativo (el usuario del SO), no del tester — ya causó un bug
// real en este proyecto (ver README). Se usa TESTER_NAME explícito o, en su
// defecto, os.userInfo() (API de Node, no una env var pisable).
function getTesterName() {
  if (process.env.TESTER_NAME) return process.env.TESTER_NAME;
  try {
    return os.userInfo().username;
  } catch (err) {
    return 'DESCONOCIDO';
  }
}

function buildStaticContext() {
  return {
    ambiente: inferEnvironment(process.env.BASE_URL),
    url: process.env.BASE_URL || 'N/D',
    sistemaOperativo: `${os.type()} ${os.release()} (${os.arch()})`,
    usuarioEjecutor: getTesterName(),
    zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
    navegadorConfigurado: config.browser.name,
    modoHeadless: config.browser.headless,
  };
}

async function enrichWithDriver(driver) {
  try {
    const [caps, rect] = await Promise.all([driver.getCapabilities(), driver.manage().window().getRect()]);
    return {
      navegadorVersion: caps.get('browserVersion') || caps.get('version') || 'N/D',
      resolucionVentana: `${rect.width}x${rect.height}`,
    };
  } catch (err) {
    return { navegadorVersion: 'N/D', resolucionVentana: 'N/D' };
  }
}

module.exports = { buildStaticContext, enrichWithDriver, inferEnvironment, getTesterName };
