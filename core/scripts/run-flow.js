#!/usr/bin/env node
/**
 * Runner de FLUJOS (capa adicional; `run-tests.js` no cambia su uso): ejecuta
 * varios casos seleccionados en UN solo proceso Mocha, con un navegador/sesión
 * compartidos y un `flowContext` para pasar entidades de un test al siguiente.
 *
 *   node core/scripts/run-flow.js <modulo>/<caso> [<modulo>/<caso> ...]
 *   ej.: node core/scripts/run-flow.js reclutamiento/consultar-solicitudes-desde-requisicion reclutamiento/crear-req-creacion
 *   --plan: solo PLANIFICA (no abre navegador ni crea carpetas de reportes) e imprime el plan
 *           como una línea `@@FLOW_PLAN@@<json>` — lo usa el Panel para previsualizar el orden.
 *
 * El orden lo calcula el planner (`utils/flowPlanner.js`) desde la metadata
 * `requires`/`produces` de `<modulo>/data/flujo-tests.js`; el orden en que se
 * escriben los casos solo desempata. Si el plan tiene errores (ambigüedad,
 * ciclo, `require` sin ninguna fuente) se informa y NO se abre el navegador.
 *
 * Contexto: cada caso lee el `execution-context.json` de SU módulo. Los reportes del flujo
 * (JSON, screenshots, evidencias, logs, `flow-estado.json`) van a `flujo/reports/<RUN_ID>/`;
 * la metadata de pantallas sigue saliendo del módulo del PRIMER caso (`REPORTS_ROOT`).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..', '..');

function parsearSeleccion(args) {
  return args.map((a) => {
    const [modulo, caso] = a.split('/');
    if (!modulo || !caso) throw new Error(`Caso inválido "${a}": se espera <modulo>/<caso>.`);
    const archivo = path.join(RAIZ, modulo, 'tests', `${caso}.test.js`);
    if (!fs.existsSync(archivo)) throw new Error(`No existe el test: ${path.relative(RAIZ, archivo)}`);
    return { modulo, caso, archivo };
  });
}

function leerMetadata(seleccion) {
  const metadata = {};
  for (const m of new Set(seleccion.map((s) => s.modulo))) {
    const f = path.join(RAIZ, m, 'data', 'flujo-tests.js');
    if (!fs.existsSync(f)) continue;
    Object.assign(metadata, require(f));
  }
  return metadata;
}

async function main() {
  const argv = process.argv.slice(2);
  const soloPlan = argv.includes('--plan');
  const args = argv.filter((a) => !a.startsWith('--'));
  if (!args.length) throw new Error('Uso: run-flow.js [--plan] <modulo>/<caso> [...]');
  const seleccion = parsearSeleccion(args);

  // Deben fijarse ANTES de cargar paths/testContext (leen el entorno al requerirse).
  // REPORTS_ROOT: módulo del primer caso (contexto/metadata, como siempre). Los REPORTES del
  // flujo van aparte (`flujo/reports/<RUN_ID>/`): un flujo no pertenece a un solo módulo.
  process.env.REPORTS_ROOT = path.join(RAIZ, seleccion[0].modulo);
  process.env.TRIPLE_REPORTS_BASE = path.join(RAIZ, 'flujo');

  const paths = require('../utils/paths');
  if (!soloPlan) paths.ensureReportDirs();

  // Contexto POR CASO: cada caso usa el `execution-context.json` de SU módulo
  // (override por módulo: EXECUTION_CONTEXT_<MODULO>, espejo de EXECUTION_CONTEXT).
  // Se escribe un plan preliminar y se activa el modo flujo en este proceso para
  // que `testContext` (planificación: ¿el Panel dirige este dato?) lea el
  // archivo correcto de cada módulo.
  const contextos = {};
  for (const s of seleccion) {
    contextos[s.caso] =
      process.env[`EXECUTION_CONTEXT_${s.modulo.toUpperCase()}`] ||
      path.join(RAIZ, s.modulo, 'data', 'execution-context.json');
  }
  // En modo --plan el plan preliminar va al temp del SO (nada en reports/: una
  // simple previsualización no debe aparecer como una corrida en el historial).
  const planFile = soloPlan
    ? path.join(os.tmpdir(), `triple-flow-plan-${process.pid}.json`)
    : path.join(paths.getRunDir(), 'flow-plan.json');
  fs.writeFileSync(planFile, JSON.stringify({ contextos, bindings: [] }), 'utf8');
  process.env.TRIPLE_FLOW_PLAN = planFile;

  const testContext = require('../context/testContext');
  const { planificar } = require('../utils/flowPlanner');
  const { resolverMetadata } = require('../utils/flowMetadata');
  const { runMocha, finalizarCorrida } = require('./run-tests');

  // Metadata EFECTIVA: `produces` derivado del código (análisis estático, sin ejecutar nada) + la
  // metadata mínima de flujo-tests.js. Una discrepancia código/metadata es un ERROR de plan.
  const declarada = leerMetadata(seleccion);
  const resuelta = resolverMetadata(seleccion, declarada);
  const metadata = resuelta.metadata;
  const plan = planificar(seleccion, metadata, {
    claveConocida: (caso, clave) => {
      const seccion = testContext.getCaso(caso);
      return Object.keys(seccion).length ? Object.prototype.hasOwnProperty.call(seccion, clave) : null;
    },
  });
  plan.contextos = contextos;
  plan.errores.push(...resuelta.errores);
  plan.avisos.push(...resuelta.avisos);

  if (soloPlan) {
    try {
      fs.unlinkSync(planFile);
    } catch (e) {
      /* best-effort */
    }
    const resumen = {
      orden: plan.orden.map((x) => ({ modulo: x.modulo, caso: x.caso })),
      avisos: plan.avisos,
      errores: plan.errores,
      produce: plan.produce,
      elimina: plan.elimina,
      requiere: plan.requiere,
      // ¿el caso declara metadata de flujo? (sin ella corre como paso independiente)
      conMetadata: Object.fromEntries(seleccion.map((x) => [x.caso, !!declarada[x.caso] || metadata[x.caso].produces.length > 0 || (metadata[x.caso].requires || []).length > 0])),
    };
    console.log(`@@FLOW_PLAN@@${JSON.stringify(resumen)}`);
    return;
  }

  console.log(`Flujo: ${paths.RUN_ID}`);
  console.log(`Reportes del flujo: flujo/${paths.RUN_ID}`);
  console.log(`Orden: ${plan.orden.map((s) => s.caso).join(' -> ') || '(vacío)'}`);
  plan.avisos.forEach((a) => console.log(`  aviso: ${a}`));
  if (plan.errores.length) {
    plan.errores.forEach((e) => console.error(`  ERROR de plan: ${e}`));
    console.error('El flujo NO se ejecutó (no se abrió ningún navegador).');
    process.exitCode = 1;
    return;
  }

  fs.writeFileSync(planFile, JSON.stringify(plan, null, 2), 'utf8');

  const { exitCode, logPath } = await runMocha(
    plan.orden.map((s) => s.archivo),
    {
      requires: [path.join(__dirname, '..', 'utils', 'flowHooks.js')],
      env: { TRIPLE_FLOW_PLAN: planFile },
    }
  );
  finalizarCorrida(logPath);
  process.exitCode = exitCode;
}

main().catch((err) => {
  console.error('Error ejecutando el flujo:', err.message);
  process.exitCode = 1;
});
