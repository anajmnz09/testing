const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { testContext, evidence } = require('@triple/core');
const fixtures = require('../support/fixtures');

const CASO = 'agregar-foto-solicitud-empleo';
// Fixture genérica del framework (avatar neutro, sin datos personales), NO la
// imagen personal usada en la prueba manual inicial. Ver
// reclutamiento/data/fixtures/README (o el propio archivo) para su origen.
const FOTO_QA = path.join(__dirname, '..', 'data', 'fixtures', 'avatar-qa.png');

// Entradas del caso: `codigo` dirige a una solicitud puntual (sin él, se
// elige una al azar del listado, igual que en agregar-valoracion). `archivo`
// permite dirigir la prueba a otra imagen; sin él, se usa la fixture QA.
testContext.registrarCaso(CASO, ['codigo', 'archivo']);

/**
 * Sube una foto a una Solicitud de Empleo EXISTENTE (no crea ninguna) y
 * confirma que quedó aplicada. Alcance ÚNICO: la foto — no toca valoración,
 * datos personales/del puesto, preguntas personalizadas ni documentos.
 */
describe('Reclutamiento - Agregar Foto a Solicitud de Empleo', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoSolicitudesEmpleo();

  it(`${CASO}: sube una foto a una solicitud existente y confirma que quedó aplicada`, async function () {
    const codigo = testContext.get(CASO, 'codigo');
    const { detalle, codigo: codigoUsado } = codigo
      ? { detalle: await ctx.lista.abrirDetalle(codigo), codigo }
      : await ctx.lista.abrirAleatoria();

    const archivoIndicado = testContext.get(CASO, 'archivo');
    let rutaFoto = FOTO_QA;
    if (archivoIndicado) {
      rutaFoto = path.resolve(archivoIndicado);
      if (!fs.existsSync(rutaFoto)) {
        throw new Error(
          `${CASO}: el archivo indicado en el Execution Context no existe: "${rutaFoto}". ` +
            'Corregí la ruta o dejá el campo "archivo" vacío para usar la fixture QA.'
        );
      }
    }

    const srcAntes = await detalle.getFotoSrc();

    await detalle.editar();
    await detalle.subirFoto(rutaFoto);
    await detalle.guardar();

    const res = await detalle.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba guardado exitoso para "${codigoUsado}". Notify: "${res.notify}"`);

    const srcDespues = await detalle.getFotoSrc();
    await evidence.attachScreenshot(ctx.driver, this, { label: 'Foto aplicada' });

    assert.notStrictEqual(
      srcDespues,
      srcAntes,
      `La foto de "${codigoUsado}" no cambió tras guardar (src antes y después son iguales).`
    );
    assert.ok(
      !srcDespues.includes('SRH-PFP-Negro'),
      `La foto de "${codigoUsado}" sigue mostrando el placeholder por defecto tras guardar (src: "${srcDespues}").`
    );
  });
});
