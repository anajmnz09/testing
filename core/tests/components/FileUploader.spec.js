const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');
const FileUploader = require('../../components/FileUploader');

/**
 * FileUploader — carga de archivos sin diálogo del SO.
 *
 * Comportamiento observable: envía la ruta ABSOLUTA del archivo al
 * `input[type=file]` (así el navegador procesa el archivo sin abrir el diálogo
 * nativo), elige el input que declara `accept` cuando hay varios, y FALLA
 * explícito si el archivo no existe.
 *
 * No usa el driver jsdom porque los elementos de Selenium exponen métodos
 * asíncronos (`sendKeys`, `getAttribute`); se usa un doble mínimo que registra
 * a qué input se envió la ruta.
 */

/** Driver de prueba: inputs con getAttribute/sendKeys asíncronos, registra envíos. */
function driverConInputs(inputs) {
  const enviados = [];
  const elementos = inputs.map((cfg, i) => ({
    _id: cfg.id || `input-${i}`,
    async getAttribute(a) { return cfg[a] !== undefined ? cfg[a] : null; },
    async sendKeys(valor) { enviados.push({ id: cfg.id || `input-${i}`, valor }); },
  }));
  return {
    enviados,
    async wait(cond, timeout) {
      const limite = Date.now() + (timeout || 200);
      for (;;) {
        const v = await cond(this);
        if (v) return v;
        if (Date.now() >= limite) throw new Error('timeout');
        await new Promise((r) => setTimeout(r, 5));
      }
    },
    async findElements() { return elementos; },
  };
}

function archivoTmp(nombre = 'up.txt', contenido = 'contenido') {
  const ruta = path.join(os.tmpdir(), `triple-fu-${Date.now()}-${nombre}`);
  fs.writeFileSync(ruta, contenido, 'utf8');
  return ruta;
}

describe('FileUploader (unitario)', function () {
  const TIMEOUT = 60;

  it('envía la ruta absoluta del archivo al input', async function () {
    const ruta = archivoTmp();
    try {
      const driver = driverConInputs([{ id: 'file', accept: '.txt' }]);
      const res = await new FileUploader(driver).subir(ruta, { timeout: TIMEOUT });

      expect(driver.enviados).to.have.lengthOf(1);
      expect(driver.enviados[0].valor).to.equal(path.resolve(ruta));
      expect(res.nombre).to.equal(path.basename(ruta));
      expect(res.bytes).to.be.greaterThan(0);
    } finally {
      fs.rmSync(ruta, { force: true });
    }
  });

  it('cuando hay varios inputs, elige el que declara accept', async function () {
    const ruta = archivoTmp();
    try {
      const driver = driverConInputs([
        { id: 'sin-accept' },
        { id: 'con-accept', accept: '.jpg,.png,.pdf,.txt' },
      ]);
      await new FileUploader(driver).subir(ruta, { timeout: TIMEOUT });

      expect(driver.enviados[0].id).to.equal('con-accept');
    } finally {
      fs.rmSync(ruta, { force: true });
    }
  });

  it('si ninguno declara accept, usa el primero', async function () {
    const ruta = archivoTmp();
    try {
      const driver = driverConInputs([{ id: 'a' }, { id: 'b' }]);
      await new FileUploader(driver).subir(ruta, { timeout: TIMEOUT });

      expect(driver.enviados[0].id).to.equal('a');
    } finally {
      fs.rmSync(ruta, { force: true });
    }
  });

  it('FALLA explícito si el archivo no existe (no envía nada)', async function () {
    const driver = driverConInputs([{ id: 'file', accept: '.txt' }]);
    let error = null;
    try {
      await new FileUploader(driver).subir('/no/existe/doc.pdf', { timeout: TIMEOUT });
    } catch (e) { error = e; }

    expect(error, 'debía lanzar').to.not.equal(null);
    expect(error.message).to.match(/no existe/);
    expect(driver.enviados).to.be.empty;
  });

  it('resuelve una ruta relativa a absoluta antes de enviarla', async function () {
    const driver = driverConInputs([{ id: 'file', accept: '.txt' }]);
    await new FileUploader(driver).subir('package.json', { timeout: TIMEOUT });

    expect(path.isAbsolute(driver.enviados[0].valor)).to.equal(true);
  });
});
