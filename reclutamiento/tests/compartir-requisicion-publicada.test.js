const assert = require('assert');
const { createDriver, authFlow, evidence } = require('@triple/core');
const problemLog = require('@triple/core/utils/problemLog');
const logger = require('@triple/core/utils/logger');
const testContext = require('@triple/core/context/testContext');
const requisicionesFlow = require('../flows/requisicionesFlow');
const VacantePublicaPage = require('../pages/VacantePublicaPage');

const CASO = 'compartir-requisicion-publicada';
const ESTADO_ORIGEN = 'Autorizada';

// Sección del caso en el Execution Context (vacía por defecto → descubrimiento
// automático). El usuario puede dirigir la prueba a una requisición concreta.
testContext.registrarCaso(CASO, ['nombreRequisicion', 'idRequisicion', 'estado']);

/**
 * compartir-requisicion-publicada — Validar que una requisición PUBLICADA puede
 * compartirse correctamente.
 *
 * Flujo: login → módulo → listado → primera "Autorizada" → abrir → (si no está
 * publicada, se publica REUTILIZANDO el flujo existente) → abrir Compartir →
 * popup "Compartir enlace público de la vacante" → Copiar → notify de copiado →
 * abrir el enlace en pestaña nueva → el nombre público coincide con el original.
 *
 * Test DELGADO: login/navegación de los flows del core, apertura de la
 * requisición del flow del módulo, y toda la mecánica de compartir del Page
 * Object (RequisicionDetallePage). Screenshot/log/recuperación ante fallo los
 * aplica la política global.
 */
describe('Reclutamiento - Compartir Requisición Publicada', function () {
  this.timeout(300000);
  let driver;

  beforeEach(async function () {
    driver = await createDriver();
  });

  it(`${CASO}: comparte una requisición publicada y valida el enlace público`, async function () {
    // 1) Login + módulo + listado (flows existentes).
    await authFlow.login(driver);
    await requisicionesFlow.abrirListado(driver);

    // 2) Abrir la primera "Autorizada" (o la dirigida por el Execution Context).
    const referencia =
      testContext.get(CASO, 'nombreRequisicion') || testContext.get(CASO, 'idRequisicion');
    const estado = testContext.get(CASO, 'estado') || ESTADO_ORIGEN;

    const { detalle, total } = await requisicionesFlow.abrirPrimeraRequisicionConEstado(driver, {
      estado,
      nombreRequisicion: referencia,
    });
    if (!detalle) {
      await problemLog.registrarBloqueo(this, driver, {
        caso: this.test.fullTitle(),
        accion: `abrir la primera requisición con estado "${estado}"`,
        campo: 'Estado',
        valor: referencia || `${total} fila(s) con estado "${estado}"`,
      });
      assert.fail(`No se pudo abrir ninguna requisición con estado "${estado}" (encontradas: ${total}).`);
    }

    const nombre = await detalle.getNombre();
    assert.ok(nombre, 'No se pudo leer el nombre de la requisición abierta.');

    // 3) Verificar el switch "Publicada". Si no lo está, publicar REUTILIZANDO el
    //    flujo existente (no se reimplementa la publicación).
    if (!(await detalle.estaPublicada())) {
      logger.info(`compartir-publicada: "${nombre}" no estaba publicada; publicando (reuso)`);
      const pub = await detalle.publicar();
      assert.ok(
        pub.exito,
        `No se pudo publicar "${nombre}" para poder compartirla. Notify: "${pub.notify}".`
      );
      assert.ok(await detalle.publicadaConfirmada(), `El switch "Publicada" no quedó encendido en "${nombre}".`);
    }

    // 4) Abrir el menú Compartir → popup.
    const abierto = await detalle.abrirCompartir();
    if (!abierto) {
      await evidence.attachScreenshot(driver, this, { label: 'Compartir no abrió' });
      await problemLog.registrarBloqueo(this, driver, {
        caso: this.test.fullTitle(),
        accion: 'abrir el popup "Compartir enlace público de la vacante"',
        campo: 'Compartir',
        valor: nombre,
      });
      assert.fail(`No apareció el popup de Compartir para la requisición publicada "${nombre}".`);
    }

    // 5) Obtener el enlace y validar que es una URL pública.
    const enlace = await detalle.getEnlaceCompartido();
    assert.ok(
      enlace && /^https?:\/\//.test(enlace),
      `No se obtuvo un enlace público válido en el popup. Enlace: "${enlace}".`
    );

    // 6) Copiar → validar el notify de éxito ("Enlace copiado al portapapeles").
    const notify = await detalle.copiarEnlace();
    await evidence.attachScreenshot(driver, this, { label: 'Tras Copiar' });
    assert.ok(
      /copiado/i.test(notify.notify),
      `No apareció el notify de copiado tras Copiar. Notify recibido: "${notify.notify}".`
    );

    // 7) Abrir el enlace en una pestaña nueva y esperar la carga completa.
    await driver.executeScript((u) => window.open(u, '_blank'), enlace);
    const handles = await driver.getAllWindowHandles();
    await driver.switchTo().window(handles[handles.length - 1]);
    const nombrePublico = await new VacantePublicaPage(driver).esperarCarga().then((p) => p.getNombre());
    await evidence.attachScreenshot(driver, this, { label: 'Vacante pública' });

    evidence.saveEvidenceBuffer(
      'json',
      this,
      JSON.stringify({ nombre, enlace, notify: notify.notify, nombrePublico }, null, 2),
      { label: 'compartir-publicada', encoding: 'utf8' }
    );

    // 8) Criterio final: el nombre público coincide EXACTAMENTE con el original.
    assert.strictEqual(
      nombrePublico,
      nombre,
      `El nombre en la vacante pública ("${nombrePublico}") no coincide con el original ("${nombre}"). Enlace: ${enlace}.`
    );
  });
});
