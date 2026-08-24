const logger = require('@triple/core/utils/logger');

/**
 * Registros QA FIJOS (nombre estable, sin sufijo) que otras pantallas de
 * Nómina referencian desde sus catálogos con buscador (ej. "Comportamiento
 * concepto Nómina" elige un "Concepto"/"Tipo Nómina" existente). A
 * diferencia de `nombreUnicoQA` (que genera un nombre NUEVO y distinto en
 * cada corrida, pensado para probar el flujo de Crear en sí), acá el
 * objetivo es lo contrario: un ÚNICO registro identificable, reusado por
 * TODAS las corridas, para no crear uno nuevo cada vez ni depender de
 * "el primero que aparezca" (que podría ser data real del ambiente).
 *
 * Confirmado con el usuario: mientras estos registros no existan, el propio
 * test los crea la primera vez que corre (quedan disponibles para las
 * corridas siguientes, de este caso y de cualquier otro que los necesite).
 */
const TIPO_NOMINA_QA = 'Tipo Nómina QA';
const CONCEPTO_NOMINA_QA = 'Concepto QA';

/**
 * Asegura que exista un "Tipo Nómina" fijo llamado `TIPO_NOMINA_QA`: si ya
 * está en el listado, no hace nada; si no, lo crea con datos QA mínimos
 * (primera opción disponible en cada selectbox, 1 intervalo de pago al
 * 100% en "Distribución de Pago" — ver `TipoNominaDetallePage`).
 *
 * @param {import('selenium-webdriver').WebDriver} driver
 */
async function asegurarTipoNominaQA(driver) {
  const TipoNominaPage = require('../pages/TipoNominaPage');
  const lista = await TipoNominaPage.ir(driver);

  const filas = await lista.grid.esperarFila(TIPO_NOMINA_QA, (f) => f['Nombre'] === TIPO_NOMINA_QA, 5000, 500);
  if (filas) {
    logger.info(`catalogosQA: "${TIPO_NOMINA_QA}" ya existe, no se crea de nuevo`);
    return TIPO_NOMINA_QA;
  }

  logger.info(`catalogosQA: "${TIPO_NOMINA_QA}" no existe todavía, creándolo`);
  const TipoNominaDetallePage = require('../pages/TipoNominaDetallePage');
  const detalle = await lista.crear();
  await detalle.setCampo('Nombre', TIPO_NOMINA_QA);
  await detalle.setCampo('Código nómina', 'QA1');
  await detalle.setCampo('Intervalo de pago', '1');
  await detalle.completarDistribucionPago([100]);
  // Resto de selectbox requeridos ("Forma Cálculo"/"Frecuencia salarial"/
  // "Tipo Empleados"): primera opción disponible — es un fixture QA, su
  // valor concreto no importa, solo que exista y sea seleccionable.
  for (const label of Object.keys(TipoNominaDetallePage.ESTRATEGIAS)) {
    if (['Nombre', 'Código nómina', 'Intervalo de pago'].includes(label)) continue;
    if (!(await detalle.form.estaVacio(label))) continue;
    await detalle.setCampo(label);
  }
  await detalle.guardar();
  const res = await detalle.resultadoGuardado();
  if (!res.exito) {
    throw new Error(`catalogosQA: no se pudo crear "${TIPO_NOMINA_QA}". Notify: "${res.notify}"`);
  }
  return TIPO_NOMINA_QA;
}

/**
 * Asegura que exista un "Concepto de nómina" fijo llamado
 * `CONCEPTO_NOMINA_QA`: si ya está en el listado, no hace nada; si no, lo
 * crea con datos QA mínimos (primera opción disponible en cada selectbox —
 * ver `ConceptoNominaDetallePage`).
 *
 * @param {import('selenium-webdriver').WebDriver} driver
 */
async function asegurarConceptoNominaQA(driver) {
  const ConceptoNominaPage = require('../pages/ConceptoNominaPage');
  const lista = await ConceptoNominaPage.ir(driver);

  const filas = await lista.grid.esperarFila(CONCEPTO_NOMINA_QA, (f) => f['Nombre'] === CONCEPTO_NOMINA_QA, 5000, 500);
  if (filas) {
    logger.info(`catalogosQA: "${CONCEPTO_NOMINA_QA}" ya existe, no se crea de nuevo`);
    return CONCEPTO_NOMINA_QA;
  }

  logger.info(`catalogosQA: "${CONCEPTO_NOMINA_QA}" no existe todavía, creándolo`);
  const ConceptoNominaDetallePage = require('../pages/ConceptoNominaDetallePage');
  const detalle = await lista.crear();
  await detalle.setCampo('Nombre', CONCEPTO_NOMINA_QA);
  // Resto de selectbox requeridos ("Tipo concepto"/"Clase"/"Origen"/"Tipo
  // Ingreso"/"Tipo Valor"): primera opción disponible — es un fixture QA, su
  // valor concreto no importa, solo que exista y sea seleccionable.
  for (const label of Object.keys(ConceptoNominaDetallePage.ESTRATEGIAS)) {
    if (label === 'Nombre') continue;
    if (!(await detalle.form.estaVacio(label))) continue;
    await detalle.setCampo(label);
  }
  await detalle.guardar();
  const res = await detalle.resultadoGuardado();
  if (!res.exito) {
    throw new Error(`catalogosQA: no se pudo crear "${CONCEPTO_NOMINA_QA}". Notify: "${res.notify}"`);
  }
  return CONCEPTO_NOMINA_QA;
}

module.exports = {
  TIPO_NOMINA_QA,
  CONCEPTO_NOMINA_QA,
  asegurarTipoNominaQA,
  asegurarConceptoNominaQA,
};
