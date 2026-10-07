#!/usr/bin/env node
/**
 * Escáner de contrato de flujo (diagnóstico). NO ejecuta ningún test, no abre Selenium ni Mocha y no
 * modifica nada: solo lee el código.
 *
 *   node core/scripts/flujo-escanear.js <modulo>/<caso>      un test
 *   node core/scripts/flujo-escanear.js --todo [--sugeridos] conteos y listas de todos los módulos
 *
 * Separa SIEMPRE cuatro cosas; solo las dos primeras crean dependencias:
 *   DETECTADO CON CERTEZA    lo que el código demuestra: publish/update y get/entidad con tipo literal, y la
 *                            ESTRUCTURA (la clave llega a un localizador de un Page Object con ENTIDAD_FLUJO)
 *   DECLARADO EXPLÍCITAMENTE entidad+campo escritos junto a las claves del test (registrarCaso), en el
 *                            ESTRATEGIAS de un Page Object, o `requires`/`orden` de flujo-tests.js
 *   SUGERIDO                 señales débiles (fixture, claves sueltas): solo informativo, NUNCA una dependencia
 *   NO DETERMINADO           lo que el código no permite probar (uso dinámico de flowContext, declaración inválida)
 */
const fs = require('fs');
const path = require('path');
const { escanearArchivo } = require('../utils/flowScanner');
const { resolverMetadata, ordenesDeclarados } = require('../utils/flowMetadata');

const RAIZ = path.resolve(__dirname, '..', '..');
const workspaces = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).workspaces.filter((w) => w !== 'core');

function metadataDe(ws) {
  const f = path.join(RAIZ, ws, 'data', 'flujo-tests.js');
  return fs.existsSync(f) ? require(f) : {};
}

/** Clasifica un test en las cuatro categorías (estructura reutilizada por el detalle y por --todo). */
function clasificar(ws, caso) {
  const archivo = path.join(RAIZ, ws, 'tests', `${caso}.test.js`);
  if (!fs.existsSync(archivo)) throw new Error(`No existe ${ws}/tests/${caso}.test.js`);
  const src = fs.readFileSync(archivo, 'utf8');
  const esc = escanearArchivo(archivo);
  const meta = metadataDe(ws)[caso] || {};
  const r = resolverMetadata([{ caso, archivo }], { [caso]: meta });

  const detectado = {
    produces: esc.produces,
    requires: esc.lecturas,
    estructura: esc.estructurales.map((d) => `${d.clave} ← ${d.entidad}.${d.campo} (vía ${d.via})`),
  };
  const declarado = {
    enPageObject: esc.declaraciones.filter((d) => d.via === 'ESTRATEGIAS').map((d) => `${d.clave} ← ${d.entidad}.${d.campo} (ESTRATEGIAS del Page Object)`),
    redundantes: r.derivado[caso].redundantes,
    enCodigo: esc.declaraciones.filter((d) => d.via !== 'ESTRATEGIAS').map((d) => `${d.clave} ← ${d.entidad}.${d.campo}${d.auto === false ? ' (sin automático)' : ''}`),
    enMetadata: (meta.requires || []).map((q) => `${q.clave || '(sin clave)'} ← ${q.tipo}${q.campo ? `.${q.campo}` : ''}`),
    orden: ordenesDeclarados(meta),
  };
  const sugerido = [];
  const fixture = (src.match(/fixtures\.(usar\w+|abrir\w+)/) || [])[1];
  if (fixture) sugerido.push(`usa el fixture ${fixture} (opera sobre un listado; el tipo de entidad NO se infiere del nombre)`);
  const declaradas = new Set(esc.declaraciones.map((d) => d.clave));
  const sueltas = esc.claves.filter((k) => !declaradas.has(k));
  if (sueltas.length) sugerido.push(`claves de entrada sin entidad: ${sueltas.join(', ')} (una clave no dice de qué entidad es)`);
  const noDeterminado = [
    ...esc.indeterminado.map((x) => `uso de flowContext no determinable (línea ${x.linea}: ${x.motivo})`),
    ...esc.invalidas.map((x) => `${x.motivo} (línea ${x.linea})`),
    ...r.errores,
  ];
  const tieneRequires = r.metadata[caso].requires && r.metadata[caso].requires.length > 0;
  return { ws, caso, detectado, declarado, sugerido, noDeterminado, tieneRequires, requiresEfectivos: r.metadata[caso].requires || [] };
}

function detalle(ws, caso) {
  const c = clasificar(ws, caso);
  const L = [`Analizando ${caso}.test.js (${ws})`, '', 'DETECTADO CON CERTEZA'];
  L.push(c.detectado.produces.length ? `  ✓ produces: ${c.detectado.produces.join(', ')} (flowContext.publish/update en el código)` : '  ✓ produces: nada');
  c.detectado.requires.forEach((t) => L.push(`  ✓ requires: ${t} (flowContext.get/entidad('${t}') en el código)`));
  c.detectado.estructura.forEach((d) => L.push(`  ✓ requires por estructura: ${d}`));
  if (!c.detectado.requires.length && !c.detectado.estructura.length) L.push('  - requires: ninguno demostrable');

  L.push('', 'DECLARADO EXPLÍCITAMENTE');
  c.declarado.enPageObject.forEach((d) => L.push(`  ✓ en el Page Object: ${d}`));
  c.declarado.enCodigo.forEach((d) => L.push(`  ✓ en el test: ${d}`));
  c.declarado.redundantes.forEach((d) => L.push(`  ✗ REDUNDANTE (quitar): ${d}`));
  c.declarado.enMetadata.forEach((d) => L.push(`  ✓ en flujo-tests.js (forma antigua): ${d}`));
  if (Object.keys(c.declarado.orden).length) L.push(`  ✓ orden de negocio (flujo-tests.js): ${JSON.stringify(c.declarado.orden)}`);
  if (!c.declarado.enCodigo.length && !c.declarado.enPageObject.length && !c.declarado.enMetadata.length && !Object.keys(c.declarado.orden).length) L.push('  (nada declarado)');

  L.push('', 'SUGERIDO (informativo: NO crea ninguna dependencia)');
  c.sugerido.forEach((x) => L.push(`  ? ${x}`));
  if (!c.sugerido.length) L.push('  (sin señales)');

  L.push('', 'NO DETERMINADO');
  c.noDeterminado.forEach((x) => L.push(`  ! ${x}`));
  if (!c.noDeterminado.length) L.push('  (nada: el código no tiene formas indeterminables)');
  L.push(
    '',
    c.tieneRequires
      ? `Requires efectivos: ${c.requiresEfectivos.map((q) => (q.clave ? `${q.clave} ← ${q.tipo}.${q.campo}` : q.tipo)).join(', ')}`
      : 'Requires efectivos: ninguno (si este test consume una entidad de un flujo, declare entidad+campo junto a su clave: ver GUIDELINES §12)'
  );
  return L.join('\n');
}

function todo() {
  const filas = [];
  for (const ws of workspaces) {
    const dir = path.join(RAIZ, ws, 'tests');
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.test.js'))) filas.push(clasificar(ws, f.replace('.test.js', '')));
  }
  const id = (c) => `${c.ws}/${c.caso}`;
  const conLectura = filas.filter((c) => c.detectado.requires.length || c.detectado.estructura.length);
  const soloEstructura = filas.filter((c) => c.detectado.estructura.length);
  const conDeclaracion = filas.filter((c) => c.declarado.enCodigo.length || c.declarado.enPageObject.length || c.declarado.enMetadata.length);
  const sugeridos = filas.filter((c) => c.sugerido.length && !c.tieneRequires);
  const noDet = filas.filter((c) => c.noDeterminado.length);
  const sinRequires = filas.filter((c) => !c.tieneRequires);
  const conFixture = sugeridos.filter((c) => c.sugerido.some((x) => x.startsWith('usa el fixture')));
  const L = [
    `Total de tests: ${filas.length}`,
    `  requires DETECTADOS con certeza (lectura tipada o estructura): ${conLectura.length}  [por estructura: ${soloEstructura.length}]`,
    `  requires DECLARADOS explícitamente (test, ESTRATEGIAS del Page Object o metadata): ${conDeclaracion.length}`,
    `  SUGERIDOS (señales débiles, sin requires; no crean dependencias): ${sugeridos.length}`,
    `  NO DETERMINADOS (uso dinámico de flowContext, declaración inválida o contradicción): ${noDet.length}`,
    `  tests SIN requires: ${sinRequires.length}`,
    '',
    'Con requires detectado:',
    ...(conLectura.length ? conLectura.map((c) => `  ${id(c)}  ← ${[...c.detectado.requires, ...c.detectado.estructura].join(', ')}`) : ['  (ninguno)']),
    'Con requires declarado:',
    ...(conDeclaracion.length ? conDeclaracion.map((c) => `  ${id(c)}  ← ${[...c.declarado.enCodigo, ...c.declarado.enPageObject, ...c.declarado.enMetadata].join(', ')}`) : ['  (ninguno)']),
    ...(filas.some((c) => c.declarado.redundantes.length) ? ['Declaraciones REDUNDANTES (la estructura ya las demuestra; quitar):', ...filas.filter((c) => c.declarado.redundantes.length).map((c) => `  ${id(c)}  — ${c.declarado.redundantes.join('; ')}`)] : []),
    `Sugeridos que operan sobre un listado vía fixture: ${conFixture.length} (informativo; solo necesitan declaración si un autor decide que participen en un flujo consumiendo una entidad)`,
    ...(process.argv.includes('--sugeridos') ? conFixture.map((c) => `  ${id(c)}  — ${c.sugerido[0]}`) : ['  (use --todo --sugeridos para listarlos)']),
    'No determinados:',
    ...(noDet.length ? noDet.map((c) => `  ${id(c)}  — ${c.noDeterminado.join('; ')}`) : ['  (ninguno)']),
  ];
  return L.join('\n');
}

try {
  const arg = process.argv[2];
  if (!arg) throw new Error('Uso: flujo-escanear.js <modulo>/<caso> | --todo');
  if (arg === '--todo') console.log(todo());
  else {
    const [ws, caso] = arg.split('/');
    console.log(detalle(ws, caso));
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
