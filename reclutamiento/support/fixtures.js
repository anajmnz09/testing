const { createDriver, authFlow, navigationFlow, testContext } = require('@triple/core');
const RequisicionesPage = require('../pages/RequisicionesPage');
const SolicitudEmpleoPage = require('../pages/SolicitudEmpleoPage');

/**
 * Fixtures compartidos por los casos del módulo.
 *
 * Al pasar a "un caso = un archivo", el arranque común (crear driver, login,
 * entrar al módulo, dejar el listado cargado) se repetiría en cada archivo. Vive
 * acá una sola vez: cada test lo invoca y recibe un contexto vivo.
 */

/**
 * Registra el beforeEach estándar y devuelve un contexto que se completa antes
 * de cada test: `{ driver, lista }`.
 *
 * Se usa dentro de un describe():
 *   const ctx = fixtures.usarListadoRequisiciones();
 *   it('...', async function () { await ctx.lista.abrirFormularioCrear(); });
 */
function usarListadoRequisiciones() {
  const ctx = {};
  beforeEach(async function () {
    ctx.driver = await createDriver();
    await authFlow.login(ctx.driver);
    await navigationFlow.abrirModulo(ctx.driver, 'Reclutamiento');
    ctx.lista = await new RequisicionesPage(ctx.driver).listo();
  });
  return ctx;
}

/** Igual que `usarListadoRequisiciones`, pero deja cargado el listado "Solicitudes de Empleo". */
function usarListadoSolicitudesEmpleo() {
  const ctx = {};
  beforeEach(async function () {
    ctx.driver = await createDriver();
    await authFlow.login(ctx.driver);
    await navigationFlow.abrirModulo(ctx.driver, 'Reclutamiento');
    ctx.lista = await SolicitudEmpleoPage.ir(ctx.driver);
  });
  return ctx;
}

/**
 * Colector de errores JS de la página. Útil en cualquier caso que necesite
 * detectar que la aplicación se rompió del lado del cliente.
 */
async function iniciarColectorErroresJs(driver) {
  await driver.executeScript(
    'window.__qaErrors=[];window.addEventListener("error",function(e){window.__qaErrors.push(String(e.message))});'
  );
}

async function erroresJs(driver) {
  return driver.executeScript('return window.__qaErrors || []');
}

/**
 * Localiza y abre el DETALLE de una requisición YA EXISTENTE para los casos que
 * NO crean requisición (agregar comentario / pregunta a una existente).
 *
 * Entrada (Execution Context del `caso`): `codigo` y/o `nombre`. Si el usuario
 * indicó alguno, se abre esa requisición puntual. Si no indicó ninguno, se toma
 * como fallback la primera requisición en estado "Autorizada" del listado (se
 * reutilizan `filtrarPorEstado` + `abrirPorEstado`, ya existentes).
 *
 * Devuelve `{ detalle, identificador }`, donde `identificador` es el texto por el
 * que reabrir la requisición después de guardar (código/nombre provisto, o el
 * nombre leído del detalle en el caso fallback).
 *
 * @param {{lista: RequisicionesPage}} ctx  contexto de `usarListadoRequisiciones`
 * @param {string} caso                     nombre del caso (sección del contexto)
 */
async function abrirRequisicionExistente(ctx, caso) {
  const codigo = testContext.get(caso, 'codigo');
  const nombre = testContext.get(caso, 'nombre');
  const identificador = codigo || nombre;

  if (identificador) {
    const detalle = await ctx.lista.abrirDetalle(identificador);
    return { detalle, identificador };
  }

  // Fallback: sin entrada explícita, editar la primera requisición en un estado
  // EDITABLE. Verificado en la app: una requisición "Autorizada" tiene el
  // formulario de edición con campos deshabilitados (p. ej. "Comentario"), mientras
  // que una "Pausada" es totalmente editable. Por eso el fallback usa "Pausada"
  // (sirve tanto para agregar comentario como pregunta). El estado se puede dirigir
  // con la clave "estado" del Execution Context. Si no hay ninguna, se falla claro.
  const estado = testContext.get(caso, 'estado') || 'Pausada';
  await ctx.lista.esperarFilas();
  await ctx.lista.filtrarPorEstado(estado);
  const detalle = await ctx.lista.abrirPorEstado(estado, 0);
  if (!detalle) {
    throw new Error(
      `${caso}: no se indicó "codigo"/"nombre" en el Execution Context y no hay ` +
        `requisiciones en estado "${estado}" para editar.`
    );
  }
  return { detalle, identificador: (await detalle.getNombre()).trim() };
}

module.exports = {
  usarListadoRequisiciones,
  usarListadoSolicitudesEmpleo,
  iniciarColectorErroresJs,
  erroresJs,
  abrirRequisicionExistente,
};
