const assert = require('assert');
const { testContext, textoIgual } = require('@triple/core');
const logger = require('@triple/core/utils/logger');
const fixtures = require('../support/fixtures');
const { asegurarTipoNominaQA, asegurarConceptoNominaQA, TIPO_NOMINA_QA, CONCEPTO_NOMINA_QA } = require('../support/catalogosQA');
const ComportamientoConceptoNominaDetallePage = require('../pages/ComportamientoConceptoNominaDetallePage');

const CASO = 'crear-comportamiento-concepto-nomina';
testContext.registrarCasoDesdeFormulario(CASO, ComportamientoConceptoNominaDetallePage.ESTRATEGIAS);

/**
 * Predicado de fila case-insensitive (`textoIgual`, core) — la app puede
 * guardar/mostrar el nombre del Concepto con distinto case del que se tipeó
 * en el buscador (ej. dirigido "ahorro cooperativa", guardado "AHORRO
 * COOPERATIVA"). Un `===` estricto acá daba un FALSO NEGATIVO real: el test
 * nunca detectaba que la combinación ya existía y siempre intentaba crear un
 * duplicado, que la app rechazaba.
 */
function esLaFila(fila, concepto, tipoNomina) {
  return (
    typeof fila['Concepto'] === 'string' &&
    typeof fila['Tipo Nómina'] === 'string' &&
    textoIgual(fila['Concepto'], concepto) &&
    textoIgual(fila['Tipo Nómina'], tipoNomina)
  );
}

/**
 * Crea un Comportamiento concepto Nómina nuevo desde Configuración > Nómina
 * > Comportamiento concepto Nómina, seleccionando "Concepto" y "Tipo
 * Nómina" (ambos catálogos con buscador, referencian registros de OTRAS
 * pantallas de este mismo módulo). "Todos los intervalos" se deja intacto
 * (viene encendido por defecto — ver `ComportamientoConceptoNominaDetallePage`,
 * estrategia `soloSiDirigido`) SALVO que el Panel dirija un "Intervalo": en
 * ese caso el switch se apaga primero (es la única forma de habilitar ese
 * dropdown) y luego se completa "Intervalo" con el valor dirigido.
 *
 * Este caso NO usa `completarConContexto` (su llenado es especial: reusa
 * fixtures QA en vez de autocompletar), así que valida la sincronización
 * ESTRATEGIAS↔UI explícitamente con `validarControlesDeclarados` justo
 * después de abrir el formulario — ver `GUIDELINES.md §Forms`.
 *
 * Para no crear un Concepto/Tipo Nómina nuevo en cada corrida ni tomar
 * cualquiera del catálogo (podría ser data real del ambiente), este caso
 * SIEMPRE usa los fixtures QA fijos "Concepto QA"/"Tipo Nómina QA" — si el
 * Panel dirige un valor propio, se respeta ese; si no, se asegura primero
 * que el fixture QA exista (lo crea si es la primera vez) y se usa ese
 * nombre. Ver `support/catalogosQA.js`.
 *
 * IDEMPOTENTE (confirmado con evidencia real): la app rechaza un
 * Comportamiento con la MISMA combinación Concepto+Tipo Nómina que uno ya
 * existente ("Error desconocido en el servidor" — es una restricción de
 * negocio real, no un bug). Como este caso usa fixtures QA FIJOS (mismo
 * Concepto/Tipo Nómina en toda corrida automática), se verifica primero si
 * la combinación YA existe en el listado; si es así, se da por satisfecho
 * el caso sin volver a crear (mismo criterio que `asegurarTipoNominaQA`/
 * `asegurarConceptoNominaQA`).
 *
 * Esa verificación de existencia usa `grid.esperarFilaSinFiltro` (lee las
 * filas SIN pasar por el buscador global) — confirmado con evidencia real que
 * `grid.buscar()`/`esperarFila` da un FALSO NEGATIVO en este grid puntual (el
 * buscador global no indexa "Concepto"), lo que hacía reintentar un create
 * duplicado que la app rechazaba, aunque el registro YA existiera. Ver
 * `DataGrid.esperarFilaSinFiltro` para el detalle y el mismo quirk ya
 * documentado en Cuentas Contables.
 */
describe('Configuración - Crear Comportamiento Concepto Nómina', function () {
  this.timeout(300000);
  const ctx = fixtures.usarListadoComportamientoConceptoNomina();

  it(`${CASO}: crea un Comportamiento concepto Nómina nuevo completando su formulario`, async function () {
    const conceptoDirigido = testContext.get(CASO, 'Concepto');
    const tipoNominaDirigido = testContext.get(CASO, 'Tipo Nómina');

    const concepto = conceptoDirigido || (await asegurarConceptoNominaQA(ctx.driver));
    const tipoNomina = tipoNominaDirigido || (await asegurarTipoNominaQA(ctx.driver));
    logger.info(`${CASO}: Concepto="${concepto}", Tipo Nómina="${tipoNomina}" (fixtures QA: "${CONCEPTO_NOMINA_QA}"/"${TIPO_NOMINA_QA}")`);

    // `asegurar*QA` navega a sus propios listados — hay que volver al de
    // esta pantalla antes de continuar.
    ctx.lista = await require('../pages/ComportamientoConceptoNominaPage').ir(ctx.driver);

    // `esperarFilaSinFiltro` (NO `esperarFila`/buscador global): confirmado con
    // evidencia real que el buscador global de ESTE grid no indexa "Concepto"
    // (columna tipo catálogo) — devuelve 0 filas aunque el registro exista y
    // sea visible sin filtrar (`aria-rowcount="0"` real de la app, no una
    // lectura equivocada de Selenium). Usar `esperarFila` acá daba un falso
    // negativo, reintentaba crear un duplicado, y la app lo rechazaba con
    // "Error desconocido en el servidor" — ver `DataGrid.esperarFilaSinFiltro`.
    const yaExiste = await ctx.lista.grid.esperarFilaSinFiltro((f) => esLaFila(f, concepto, tipoNomina), 5000, 500);
    if (yaExiste) {
      logger.info(
        `${CASO}: ya existe un Comportamiento para Concepto="${concepto}"/Tipo Nómina="${tipoNomina}" — no se crea de nuevo (la app rechaza duplicar la combinación), se da por satisfecho el caso.`
      );
      return;
    }

    const form = await ctx.lista.crear();
    await form.form.validarControlesDeclarados(ComportamientoConceptoNominaDetallePage.ESTRATEGIAS, {
      etiqueta: ComportamientoConceptoNominaDetallePage.NOMBRE_ENTIDAD,
    });
    await form.setCampo('Concepto', concepto);
    await form.setCampo('Tipo Nómina', tipoNomina);

    // "Intervalo" está DESHABILITADO mientras "Todos los intervalos" esté
    // encendido (default de la app) — confirmado por el usuario: si el Panel
    // dirige un "Intervalo", primero hay que apagar el switch para poder
    // acceder a ese dropdown. Un booleano `false` dirigido para el switch no
    // se puede leer directo de testContext (cuenta como "no dirigido" — mismo
    // criterio en todo el framework), así que la señal real de esa intención
    // es que "Intervalo" venga con un valor.
    const intervaloDirigido = testContext.get(CASO, 'Intervalo');
    if (intervaloDirigido) {
      await form.setCampo('Todos los intervalos', false);
      await form.setCampo('Intervalo', intervaloDirigido);
    } else {
      const todosLosIntervalos = testContext.get(CASO, 'Todos los intervalos');
      if (todosLosIntervalos !== undefined) {
        await form.setCampo('Todos los intervalos', todosLosIntervalos);
      }
    }

    await form.guardar();
    const res = await form.resultadoGuardado();
    assert.ok(res.exito, `Se esperaba creación exitosa para Concepto="${concepto}"/Tipo Nómina="${tipoNomina}". Notify: "${res.notify}"`);

    const filaCreada = await ctx.lista.grid.esperarFilaSinFiltro((f) => esLaFila(f, concepto, tipoNomina));
    assert.ok(
      filaCreada,
      `Concepto="${concepto}"/Tipo Nómina="${tipoNomina}" no aparece en el listado de Comportamiento Concepto Nómina tras crearlo.`
    );
  });
});
