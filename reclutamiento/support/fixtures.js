const { createDriver, authFlow, navigationFlow, testContext } = require('@triple/core');
const SRHHNavBar = require('@triple/core/components/SRHHNavBar');
const RequisicionesPage = require('../pages/RequisicionesPage');
const SolicitudEmpleoPage = require('../pages/SolicitudEmpleoPage');
const BancoCandidatosPage = require('../pages/BancoCandidatosPage');

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

/** Igual que `usarListadoRequisiciones`, pero deja cargado el listado "Banco de candidatos". */
function usarListadoBancoCandidatos() {
  const ctx = {};
  beforeEach(async function () {
    ctx.driver = await createDriver();
    await authFlow.login(ctx.driver);
    await navigationFlow.abrirModulo(ctx.driver, 'Reclutamiento');
    const navBar = new SRHHNavBar(ctx.driver);
    await navBar.ir('Banco de candidatos');
    ctx.lista = await new BancoCandidatosPage(ctx.driver).estaCargado();
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
 * Localiza y abre el DETALLE de una requisición YA EXISTENTE.
 *
 * Entrada (Execution Context del `caso`): `codigo` y/o `nombre`. Si el usuario
 * indicó alguno, se abre esa requisición puntual (sea cual sea su estado: el
 * usuario sabe lo que pidió). Si no indicó ninguno, aplica el fallback según
 * `requiereEditable`.
 *
 * @param {{lista: RequisicionesPage}} ctx  contexto de `usarListadoRequisiciones`
 * @param {string} caso                     nombre del caso (sección del contexto)
 * @param {object} [opts]
 * @param {boolean} [opts.requiereEditable=true]  el caso va a EDITAR la
 *   requisición (agregar comentario/pregunta): el fallback, sin `codigo`/
 *   `nombre` en el contexto, necesita una requisición en un estado editable.
 *   Verificado en la app: una "Autorizada" tiene el formulario con campos
 *   deshabilitados (p. ej. "Comentario"), mientras que una "Pausada" es
 *   totalmente editable — por eso el fallback usa "Pausada".
 *   Con `false` (casos que solo NAVEGAN/CONSULTAN desde el detalle, ej.
 *   "B. Elegibles", "Solicitudes de Empleo": no editan nada) el fallback NO
 *   fuerza ningún estado — abre la primera requisición del listado tal cual
 *   está, porque a esos casos el estado no les importa. Confirmado bug real:
 *   antes de este parámetro, estos casos heredaban el filtro "Pausada" del
 *   fallback de edición sin necesitarlo (`DataGrid: filtrar por columna
 *   "Estado" = "Pausada"` en CADA corrida, aunque ningún test declare esa
 *   condición).
 *
 * Devuelve `{ detalle, identificador }`, donde `identificador` es el texto por el
 * que reabrir la requisición después de guardar (código/nombre provisto, o el
 * nombre leído del detalle en el caso fallback).
 */
async function abrirRequisicionExistente(ctx, caso, { requiereEditable = true } = {}) {
  const codigo = testContext.get(caso, 'codigo');
  const nombre = testContext.get(caso, 'nombre');
  const identificador = codigo || nombre;

  if (identificador) {
    const detalle = await ctx.lista.abrirDetalle(identificador);
    return { detalle, identificador };
  }

  // El estado se puede dirigir con la clave "estado" del Execution Context
  // (sirve para ambos casos: dirigir el estado a editar, o dirigir qué estado
  // consultar). Sin dirección explícita, el default depende de si el caso
  // necesita edición.
  const estadoDirigido = testContext.get(caso, 'estado');
  const estado = estadoDirigido || (requiereEditable ? 'Pausada' : null);

  await ctx.lista.esperarFilas();
  if (estado) await ctx.lista.filtrarPorEstado(estado);
  const detalle = await ctx.lista.abrirPorEstado(estado, 0);
  if (!detalle) {
    throw new Error(
      `${caso}: no se indicó "codigo"/"nombre" en el Execution Context y no hay ` +
        `requisiciones${estado ? ` en estado "${estado}"` : ''} para abrir.`
    );
  }
  return { detalle, identificador: (await detalle.getNombre()).trim() };
}

module.exports = {
  usarListadoRequisiciones,
  usarListadoSolicitudesEmpleo,
  usarListadoBancoCandidatos,
  iniciarColectorErroresJs,
  erroresJs,
  abrirRequisicionExistente,
};
