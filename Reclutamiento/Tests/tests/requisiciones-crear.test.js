const assert = require('assert');
const { createDriver, authFlow, navigationFlow, evidence, logger } = require('@triple/core');
const RequisicionesPage = require('../pages/RequisicionesPage');
const RequisicionFormPage = require('../pages/RequisicionFormPage');
const datos = require('../data/requisiciones.data');

const { RAZON } = RequisicionFormPage;

// El manejo de driver, screenshots (SCREENSHOT_MODE) y logging es automático
// (core/utils/mochaRootHooks.js). Estos tests describen el flujo de negocio y
// reutilizan los flows/componentes existentes + los Page Objects del módulo.
describe('Reclutamiento - Crear Requisición', function () {
  this.timeout(300000); // el flujo real (crear + reabrir) es largo

  let driver;
  let lista;

  beforeEach(async function () {
    driver = await createDriver();
    await authFlow.login(driver);
    await navigationFlow.abrirModulo(driver, 'Reclutamiento');
    lista = await new RequisicionesPage(driver).listo();
  });

  // Inicializa un colector de errores JS de la página (para TC-003).
  async function iniciarColectorErrores() {
    await driver.executeScript(
      'window.__qaErrors=[];window.addEventListener("error",function(e){window.__qaErrors.push(String(e.message))});'
    );
  }
  async function erroresJs() {
    return driver.executeScript('return window.__qaErrors || []');
  }

  // ---------------------------------------------------------------------------
  // TC-001 — Creación: completar todos los requeridos, guardar, reabrir y validar.
  // ---------------------------------------------------------------------------
  it('TC-001: crea una requisición (Creación) y valida la información al reabrir', async function () {
    const nombre = datos.nombreQA('TC001');
    await lista.abrirFormularioCrear();

    const form = await new RequisicionFormPage(driver).estaCargado();
    await form.seleccionarRazon(RAZON.CREACION);
    const d = await form.completarRequeridos(nombre);
    await form.guardar();

    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa. Notify: "${res.notify}"`);

    // Reabrir la requisición creada y validar que cargó correctamente.
    await lista.volverAlListado();
    const detalle = await lista.abrirDetalle(nombre);
    assert.strictEqual((await detalle.getNombre()).trim(), nombre, 'El nombre no coincide');
    assert.ok((await detalle.getRequisitos()).includes(d.requisitos), 'Requisitos no cargó');
    assert.ok((await detalle.getResponsabilidades()).includes(d.responsabilidades), 'Responsabilidades no cargó');
    assert.ok((await detalle.getDescripcion()).includes(d.descripcion), 'Descripción no cargó');
  });

  // ---------------------------------------------------------------------------
  // TC-002 — Sustitución: solo los campos obligatorios (incluye Persona a sustituir).
  // ---------------------------------------------------------------------------
  it('TC-002: crea una requisición (Sustitución) con solo los obligatorios', async function () {
    const nombre = datos.nombreQA('TC002');
    await lista.abrirFormularioCrear();

    const form = await new RequisicionFormPage(driver).estaCargado();
    await form.seleccionarRazon(RAZON.SUSTITUCION);
    // La persona se elige PRIMERO: auto-rellena Sucursal/Departamento/Puesto y
    // limpia Horario/Modalidad, por eso completarRequeridos va después (llena lo vacío).
    await form.seleccionarPrimeraPersonaASustituir();
    await form.completarRequeridos(nombre);

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa. Notify: "${res.notify}"`);
  });

  // ---------------------------------------------------------------------------
  // TC-003 — Sustitución: probar varios empleados en "Persona a sustituir" y
  // detectar automáticamente si alguno rompe la app (404 / error / cuelga).
  // ---------------------------------------------------------------------------
  it('TC-003: ningún empleado en "Persona a sustituir" debe romper la aplicación', async function () {
    this.retries(0); // es un detector: si encuentra el bug debe fallar, no reintentar
    // 1) Obtener la lista de empleados disponibles.
    await lista.abrirFormularioCrear();
    let form = await new RequisicionFormPage(driver).estaCargado();
    await form.seleccionarRazon(RAZON.SUSTITUCION);
    const empleados = (await form.empleadosDisponibles()).slice(0, datos.TC003_MAX_EMPLEADOS);
    assert.ok(empleados.length > 0, 'No hay empleados disponibles para sustituir');
    logger.info(`TC-003: probando ${empleados.length} empleados`);

    // 2) Probar cada empleado en un formulario fresco (aísla cada caso).
    const fallidos = [];
    for (const emp of empleados) {
      await lista.volverAlListado();
      await lista.abrirFormularioCrear();
      form = await new RequisicionFormPage(driver).estaCargado();
      await form.seleccionarRazon(RAZON.SUSTITUCION);
      await iniciarColectorErrores();

      let detalle = null;
      try {
        await form.seleccionarPersonaASustituir(emp); // dispara la carga desde el empleado

        // Señales de fallo (las 4 acordadas):
        const notify = await form.getNotify(3000);
        const formOk = await form.formularioPresente();
        const url = await driver.getCurrentUrl();
        const jsErrs = await erroresJs();
        if (/error/i.test(notify) || !formOk || /404|not[_-]?found/i.test(url) || jsErrs.length > 0) {
          detalle = { empleado: emp, notify, formOk, url, jsErrs };
        }
      } catch (err) {
        // El cuelgue/timeout al seleccionar el empleado (la carga nunca termina)
        // ES una de las señales de fallo: la app deja de responder.
        detalle = { empleado: emp, colgado: true, error: err.message.split('\n')[0] };
      }

      if (detalle) {
        logger.error(`TC-003: empleado problemático -> ${JSON.stringify(detalle)}`);
        try {
          await evidence.attachScreenshot(driver, this, { label: `Fallo con empleado: ${emp}` });
          await evidence.saveEvidenceBuffer('json', this, JSON.stringify(detalle, null, 2), { label: 'contexto-fallo', encoding: 'utf8' });
        } catch (e) { /* la app puede estar colgada; igual reportamos */ }
        fallidos.push(detalle);
        break; // no seguir usando un empleado que rompe la app
      }
      logger.info(`TC-003: empleado OK -> "${emp}"`);
    }

    assert.strictEqual(
      fallidos.length,
      0,
      `Empleado(s) que rompen la app: ${JSON.stringify(fallidos)}`
    );
  });

  // ---------------------------------------------------------------------------
  // TC-004 — Validación: no debe permitir guardar con requeridos vacíos.
  // ---------------------------------------------------------------------------
  it('TC-004: no permite guardar dejando campos requeridos vacíos', async function () {
    await lista.abrirFormularioCrear();
    const form = await new RequisicionFormPage(driver).estaCargado();

    await form.guardar(); // sin completar nada
    const res = await form.resultadoGuardado();

    assert.ok(!res.exito, 'No debería haberse creado la requisición');
    assert.ok(res.invalido, `Debería marcar el formulario como inválido. Notify: "${res.notify}"`);
    assert.ok(await form.sigueEnFormulario(), 'Debe seguir en el formulario de creación');
  });

  // ---------------------------------------------------------------------------
  // TC-005 — Creación con Pregunta Personalizada; validar que quedó almacenada.
  // ---------------------------------------------------------------------------
  it('TC-005: crea una requisición con pregunta personalizada y la valida al reabrir', async function () {
    const nombre = datos.nombreQA('TC005');
    await lista.abrirFormularioCrear();

    const form = await new RequisicionFormPage(driver).estaCargado();
    await form.seleccionarRazon(RAZON.CREACION);
    await form.completarRequeridos(nombre);
    await form.agregarPreguntaPersonalizada(datos.preguntaPersonalizada);
    await form.guardar();

    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa. Notify: "${res.notify}"`);

    await lista.volverAlListado();
    const detalle = await lista.abrirDetalle(nombre);
    // La pregunta puede mostrarse por su "Nombre del campo" o por el texto de la pregunta.
    const porNombre = await detalle.tienePreguntaPersonalizada(datos.preguntaPersonalizada.nombreCampo);
    const porTexto = await detalle.tienePreguntaPersonalizada('disponibilidad inmediata');
    assert.ok(porNombre || porTexto, 'La pregunta personalizada no quedó almacenada');
  });

  // ---------------------------------------------------------------------------
  // TC-006 — Creación con Comentario; validar que quedó almacenado al reabrir.
  // ---------------------------------------------------------------------------
  it('TC-006: crea una requisición con comentario y lo valida al reabrir', async function () {
    const nombre = datos.nombreQA('TC006');
    await lista.abrirFormularioCrear();

    const form = await new RequisicionFormPage(driver).estaCargado();
    await form.seleccionarRazon(RAZON.CREACION);
    await form.completarRequeridos(nombre);
    await form.setComentario(datos.comentario);
    await form.guardar();

    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa. Notify: "${res.notify}"`);

    await lista.volverAlListado();
    const detalle = await lista.abrirDetalle(nombre);
    assert.ok((await detalle.getComentario()).includes(datos.comentario), 'El comentario no quedó almacenado');
  });
});
