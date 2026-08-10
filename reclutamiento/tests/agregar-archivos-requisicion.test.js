const assert = require('assert');
const { createDriver, authFlow, evidence, testFiles } = require('@triple/core');
const problemLog = require('@triple/core/utils/problemLog');
const logger = require('@triple/core/utils/logger');
const testContext = require('@triple/core/context/testContext');
const requisicionesFlow = require('../flows/requisicionesFlow');
const DocumentosRequisicionPage = require('../pages/DocumentosRequisicionPage');
const { CLASIFICACIONES } = require('../data/documentos.data');

const CASO = 'importar-archivos-requisicion';
const ESTADO_ORIGEN = 'Autorizada';

// Sección del caso en el Execution Context. Vacía por defecto -> el test
// descubre la primera "Autorizada" y usa un archivo por defecto por cada
// clasificación. El usuario puede dirigir la prueba (requisición, archivo,
// subconjunto de clasificaciones) sin tocar el código.
testContext.registrarCaso(CASO, ['nombreRequisicion', 'idRequisicion', 'estado', 'archivo', 'clasificaciones']);

/**
 * importar-archivos-requisicion — Importar documentos a una requisición.
 *
 * Flujo: login -> módulo Reclutamiento -> listado -> primera requisición
 * "Autorizada" -> abrir detalle -> panel "Documentos" -> por CADA una de las 4
 * clasificaciones (en la MISMA requisición, sin cerrar sesión ni volver al
 * listado): elegir clasificación -> cargar archivo (sin diálogo del SO) ->
 * Guardar -> notify de éxito -> verificar que el documento quedó asociado.
 *
 * Test DELGADO: login/navegación de los flows del core, apertura de la
 * requisición del flow del módulo, y toda la mecánica de documentos del Page
 * Object (que compone FormsHeader, Popup, Form, FileUploader y Notify del core).
 * Screenshot/log/recuperación ante fallo los aplica la política global.
 */
describe('Reclutamiento - Importar Archivos a Requisición', function () {
  this.timeout(600000);
  let driver;

  beforeEach(async function () {
    driver = await createDriver();
  });

  it(`${CASO}: importa las 4 clasificaciones en una requisición autorizada y valida cada carga`, async function () {
    // 1) Login + módulo + listado (flows existentes).
    await authFlow.login(driver);
    await requisicionesFlow.abrirListado(driver);

    // 2) Abrir la requisición (EC o descubrimiento automático). Reutiliza la
    //    misma lógica que pausar/publicar; no se duplica.
    const referencia =
      testContext.get(CASO, 'nombreRequisicion') || testContext.get(CASO, 'idRequisicion');
    const estadoOrigen = testContext.get(CASO, 'estado') || ESTADO_ORIGEN;

    const { detalle, total } = await requisicionesFlow.abrirPrimeraRequisicionConEstado(driver, {
      estado: estadoOrigen,
      nombreRequisicion: referencia,
    });

    if (!detalle) {
      await problemLog.registrarBloqueo(this, driver, {
        caso: this.test.fullTitle(),
        accion: `abrir la primera requisición con estado "${estadoOrigen}"`,
        campo: 'Estado',
        valor: referencia || `${total} fila(s) con estado "${estadoOrigen}"`,
      });
      assert.fail(
        `No se pudo abrir ninguna requisición con estado "${estadoOrigen}" ` +
          `(encontradas: ${total}${referencia ? `, referencia pedida: "${referencia}"` : ''}).`
      );
    }

    const nombreRequisicion = await testContext.getODescubrir(CASO, 'nombreRequisicion', () =>
      detalle.getNombre()
    );

    // 3) Abrir el panel "Documentos".
    const documentos = new DocumentosRequisicionPage(driver);
    const aperturaPanel = await documentos.abrirPanel();
    if (!aperturaPanel.abierto) {
      evidence.saveEvidenceBuffer('json', this, JSON.stringify(aperturaPanel, null, 2), {
        label: 'apertura-panel-documentos',
        encoding: 'utf8',
      });
      await problemLog.registrarBloqueo(this, driver, {
        caso: this.test.fullTitle(),
        accion: 'abrir el panel "Documentos" desde el header',
        campo: 'Documentos',
        valor: nombreRequisicion,
      });
      assert.fail(
        `No se pudo abrir el panel "Documentos" de la requisición "${nombreRequisicion}". ` +
          `Diagnóstico: ${JSON.stringify(aperturaPanel.boton)}`
      );
    }

    // 4) Clasificaciones a importar: las 4 por defecto, o el subconjunto del EC.
    const clasificaciones = testContext.get(CASO, 'clasificaciones') || CLASIFICACIONES;
    const archivoEC = testContext.get(CASO, 'archivo'); // opcional: un archivo dado por el usuario
    const resumen = [];

    for (const clasificacion of clasificaciones) {
      // 4.a) Resolver el archivo: si el EC indica uno, se usa; si no, un archivo
      //      por defecto DISTINTO por clasificación (nombre inequívoco para la
      //      validación). Nunca se hardcodea una ruta.
      const archivo = testFiles.resolver({ ruta: archivoEC, base: `documento-${clasificacion}` });

      const docsAntes = await documentos.contarDocumentos();
      const t0 = Date.now();

      let resultado;
      try {
        resultado = await documentos.importarDocumento({
          clasificacion,
          archivoRuta: archivo.ruta,
        });
      } catch (err) {
        evidence.saveEvidenceBuffer(
          'json',
          this,
          JSON.stringify({ clasificacion, archivo: archivo.nombre, error: err.message }, null, 2),
          { label: `importar-${clasificacion}-error`, encoding: 'utf8' }
        );
        await evidence.attachScreenshot(driver, this, { label: `Error importando ${clasificacion}` });
        throw err;
      }

      const tiempoCargaMs = Date.now() - t0;

      // 4.b) Primer criterio: notify de éxito.
      assert.ok(
        resultado.exito,
        `No hubo notify de éxito al importar "${archivo.nombre}" con clasificación "${clasificacion}". ` +
          `Notify: "${resultado.notify}" (inválido=${resultado.invalido}, errorSistema=${resultado.errorSistema}, ` +
          `guardarEncontrado=${resultado.guardar.encontrado}, guardarDeshabilitado=${resultado.guardar.deshabilitado}).`
      );

      // 4.c) Criterio final: el documento quedó ASOCIADO. Se reabre el panel
      //      (idempotente) y se verifica que aparezca el archivo y que la
      //      cantidad haya aumentado exactamente en 1.
      await documentos.abrirPanel();
      const aparece = await documentos.esperarDocumento(archivo.nombre);
      const docsDespues = await documentos.contarDocumentos();
      const adjuntos = await documentos.documentosAdjuntos();

      const item = {
        clasificacion,
        clasificacionElegida: resultado.clasificacionElegida,
        archivo: archivo.nombre,
        porDefecto: archivo.porDefecto,
        tiempoCargaMs,
        notify: resultado.notify,
        exito: resultado.exito,
        documentoAsociado: aparece,
        documentosAntes: docsAntes,
        documentosDespues: docsDespues,
      };
      resumen.push(item);
      logger.info(`importar-archivos-requisicion: ${JSON.stringify(item)}`);

      evidence.saveEvidenceBuffer('json', this, JSON.stringify({ ...item, adjuntos }, null, 2), {
        label: `importar-${clasificacion}`,
        encoding: 'utf8',
      });
      await evidence.attachScreenshot(driver, this, { label: `Documento ${clasificacion} asociado` });

      assert.ok(
        aparece,
        `El documento "${archivo.nombre}" (clasificación "${clasificacion}") no quedó listado en el panel ` +
          `de la requisición "${nombreRequisicion}". Adjuntos: ${JSON.stringify(adjuntos.map((d) => d.nombre))}.`
      );
      assert.strictEqual(
        docsDespues,
        docsAntes + 1,
        `Tras importar "${clasificacion}" se esperaba ${docsAntes + 1} documento(s) y hay ${docsDespues}.`
      );
    }

    // 5) Evidencia resumen del caso completo.
    evidence.saveEvidenceBuffer(
      'json',
      this,
      JSON.stringify({ requisicion: nombreRequisicion, clasificaciones: clasificaciones.length, resumen }, null, 2),
      { label: 'resumen-importaciones', encoding: 'utf8' }
    );

    assert.strictEqual(
      resumen.filter((r) => r.exito && r.documentoAsociado).length,
      clasificaciones.length,
      `No todas las clasificaciones se importaron y validaron correctamente: ${JSON.stringify(resumen)}`
    );
  });
});
