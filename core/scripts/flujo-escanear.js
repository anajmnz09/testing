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
 *                            ESTRUCTURA (contratos ENTIDAD_FLUJO de los Page Objects: la clave llega a un localizador,
 *                            o el test llama a un creador / editor / eliminador declarado)
 *   DECLARADO EXPLÍCITAMENTE entidad+campo escritos junto a las claves del test (registrarCaso), en el
 *                            ESTRATEGIAS de un Page Object, o `requires`/`orden` de flujo-tests.js
 *   SUGERIDO                 señales débiles (fixture, claves sueltas): solo informativo, NUNCA una dependencia
 *   NO DETERMINADO           lo que el código no permite probar (uso dinámico de flowContext, declaración inválida,
 *                            persistencia sin contrato de entidad)
 *
 * Rol de cada test (derivado, nunca por nombre): productor estructural | productor explícito | transformación |
 * eliminador | consumidor | sin rol de flujo.
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

/** Clasifica un test (estructura reutilizada por el detalle y por --todo). */
function clasificar(ws, caso) {
  const archivo = path.join(RAIZ, ws, 'tests', `${caso}.test.js`);
  if (!fs.existsSync(archivo)) throw new Error(`No existe ${ws}/tests/${caso}.test.js`);
  const src = fs.readFileSync(archivo, 'utf8');
  const esc = escanearArchivo(archivo);
  const meta = metadataDe(ws)[caso] || {};
  const r = resolverMetadata([{ caso, archivo }], { [caso]: meta });
  const d = r.derivado[caso];
  const efectivo = r.metadata[caso];
  const consume = [...new Set((efectivo.requires || []).map((q) => q.tipo))];

  const productorEstructural = d.creadas;
  const productorExplicito = esc.produces.filter((t) => !d.creadas.includes(t) && !consume.includes(t));
  const transformacion = [...new Set([...d.editadas, ...esc.produces.filter((t) => consume.includes(t))])];

  const detectado = {
    produces: esc.produces,
    requires: esc.lecturas,
    estructura: esc.estructurales.map((x) => `${x.clave} ← ${x.entidad}.${x.campo} (vía ${x.via})`),
    creaciones: esc.creaciones.map((x) => `${x.entidad} (vía ${x.via})`),
    ediciones: esc.ediciones.map((x) => `${x.entidad} (vía ${x.via})`),
    eliminaciones: esc.eliminaciones.map((x) => `${x.entidad} (vía ${x.via})`),
  };
  const declarado = {
    enPageObject: esc.declaraciones.filter((x) => x.via === 'ESTRATEGIAS').map((x) => `${x.clave} ← ${x.entidad}.${x.campo} (ESTRATEGIAS del Page Object)`),
    redundantes: d.redundantes,
    enCodigo: esc.declaraciones.filter((x) => x.via !== 'ESTRATEGIAS').map((x) => `${x.clave} ← ${x.entidad}.${x.campo}${x.auto === false ? ' (sin automático)' : ''}`),
    enMetadata: (meta.requires || []).map((q) => `${q.clave || '(sin clave)'} ← ${q.tipo}${q.campo ? `.${q.campo}` : ''}`),
    orden: ordenesDeclarados(meta),
  };
  const sugerido = [];
  const fixture = (src.match(/fixtures\.(usar\w+|abrir\w+)/) || [])[1];
  if (fixture) sugerido.push(`usa el fixture ${fixture} (opera sobre un listado; el tipo de entidad NO se infiere del nombre)`);
  const declaradas = new Set(esc.declaraciones.map((x) => x.clave));
  const estructurales = new Set(esc.estructurales.map((x) => x.clave));
  const sueltas = esc.claves.filter((k) => !declaradas.has(k) && !estructurales.has(k));
  if (sueltas.length) sugerido.push(`claves de entrada sin entidad: ${sueltas.join(', ')} (una clave no dice de qué entidad es)`);

  const guarda = /\.(guardar|resultadoGuardado)\(/.test(src);
  const noDeterminado = [
    ...esc.indeterminado.map((x) => `uso de flowContext no determinable (línea ${x.linea}: ${x.motivo})`),
    ...esc.invalidas.map((x) => `${x.motivo} (línea ${x.linea})`),
    ...r.errores,
  ];
  const sinRolDeEscritura = !productorEstructural.length && !productorExplicito.length && !transformacion.length && !d.eliminadas.length && !esc.exclusiones.length;
  if (guarda && sinRolDeEscritura) noDeterminado.push('guarda un registro pero ningún Page Object que usa declara de qué entidad es (sin contrato ENTIDAD_FLUJO para esa operación)');

  let rol = 'sin rol de flujo';
  if (productorEstructural.length) rol = 'productor estructural';
  else if (productorExplicito.length) rol = 'productor explícito';
  else if (transformacion.length) rol = 'transformación';
  else if (d.eliminadas.length) rol = 'eliminador';
  else if (esc.exclusiones.length) rol = { atributo: 'acción/atributo', relacion: 'relación', traslado: 'traslado' }[esc.exclusiones[0].clase] || 'acción/atributo';
  else if (consume.length) rol = 'consumidor';

  return {
    ws, caso, rol, exclusiones: esc.exclusiones, detectado, declarado, sugerido, noDeterminado, consume,
    productorEstructural, productorExplicito, transformacion, eliminadas: d.eliminadas, respaldo: d.respaldo,
    tieneRequires: consume.length > 0, requiresEfectivos: efectivo.requires || [],
  };
}

function detalle(ws, caso) {
  const c = clasificar(ws, caso);
  const L = [`Analizando ${caso}.test.js (${ws})  →  rol: ${c.rol}`, '', 'DETECTADO CON CERTEZA'];
  c.detectado.produces.forEach((t) => L.push(`  ✓ publica "${t}" (flowContext.publish/update en el código)`));
  c.detectado.creaciones.forEach((x) => L.push(`  ✓ CREA ${x}${c.respaldo.includes(x.split(' ')[0]) ? ' — creación de respaldo (el test también la consume): no lo vuelve productor' : ''}`));
  c.detectado.ediciones.forEach((x) => L.push(`  ✓ EDITA ${x}`));
  c.detectado.eliminaciones.forEach((x) => L.push(`  ✓ ELIMINA ${x}`));
  c.exclusiones.forEach((x) => L.push(`  ✓ ACCIÓN sin entidad de flujo (${x.clase}): ${x.via} — decisión de negocio declarada en ACCIONES_FLUJO`));
  c.detectado.requires.forEach((t) => L.push(`  ✓ requires: ${t} (flowContext.get/entidad('${t}') en el código)`));
  c.detectado.estructura.forEach((x) => L.push(`  ✓ requires por estructura: ${x}`));
  if (L.length === 3 && !c.exclusiones.length) L.push('  (nada demostrable por código o estructura)');

  L.push('', 'DECLARADO EXPLÍCITAMENTE');
  c.declarado.enPageObject.forEach((x) => L.push(`  ✓ en el Page Object: ${x}`));
  c.declarado.enCodigo.forEach((x) => L.push(`  ✓ en el test: ${x}`));
  c.declarado.redundantes.forEach((x) => L.push(`  ✗ REDUNDANTE (quitar): ${x}`));
  c.declarado.enMetadata.forEach((x) => L.push(`  ✓ en flujo-tests.js (forma antigua): ${x}`));
  if (Object.keys(c.declarado.orden).length) L.push(`  ✓ orden de negocio (flujo-tests.js): ${JSON.stringify(c.declarado.orden)}`);
  if (!c.declarado.enCodigo.length && !c.declarado.enPageObject.length && !c.declarado.enMetadata.length && !Object.keys(c.declarado.orden).length) L.push('  (nada declarado)');

  L.push('', 'SUGERIDO (informativo: NO crea ninguna dependencia)');
  c.sugerido.forEach((x) => L.push(`  ? ${x}`));
  if (!c.sugerido.length) L.push('  (sin señales)');

  L.push('', 'NO DETERMINADO');
  c.noDeterminado.forEach((x) => L.push(`  ! ${x}`));
  if (!c.noDeterminado.length) L.push('  (nada)');
  L.push('', c.tieneRequires ? `Requires efectivos: ${c.requiresEfectivos.map((q) => (q.clave ? `${q.clave} ← ${q.tipo}.${q.campo}` : q.tipo)).join(', ')}` : 'Requires efectivos: ninguno');
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
  const por = (rol) => filas.filter((c) => c.rol === rol);
  const conLectura = filas.filter((c) => c.detectado.requires.length || c.detectado.estructura.length);
  const conDeclaracion = filas.filter((c) => c.declarado.enCodigo.length || c.declarado.enPageObject.length || c.declarado.enMetadata.length);
  const sugeridos = filas.filter((c) => c.sugerido.length && !c.tieneRequires);
  const noDet = filas.filter((c) => c.noDeterminado.length);
  const tipos = (lista, campo) => [...new Set(lista.flatMap((c) => c[campo]))].sort();
  const L = [
    `Total de tests: ${filas.length}`,
    '',
    'REQUIRES',
    `  detectados con certeza (lectura tipada o estructura): ${conLectura.length}`,
    `  declarados explícitamente (test, ESTRATEGIAS del Page Object o metadata): ${conDeclaracion.length}`,
    `  sugeridos (señales débiles, sin requires; no crean dependencias): ${sugeridos.length}`,
    `  tests sin requires: ${filas.filter((c) => !c.tieneRequires).length}`,
    '',
    'PRODUCES / ROL (derivado de la estructura, nunca del nombre)',
    `  productor estructural: ${por('productor estructural').length}   [${tipos(por('productor estructural'), 'productorEstructural').length} entidades]`,
    `  productor explícito (publish sin operación estructural): ${por('productor explícito').length}   [${por('productor explícito').map((c) => `${id(c)} → ${c.productorExplicito.join(',')}`).join('; ')}]`,
    `  transformación (requiere y produce la misma entidad): ${por('transformación').length}`,
    `  eliminador: ${por('eliminador').length}`,
    `  acción/atributo (decisión de negocio declarada): ${por('acción/atributo').length}   relación: ${por('relación').length}   traslado: ${por('traslado').length}`,
    `  consumidor puro: ${por('consumidor').length}`,
    `  sin rol de flujo: ${por('sin rol de flujo').length}`,
    `  no determinado (guarda sin contrato / uso indeterminable / contradicción): ${noDet.length}`,
    '',
    'Entidades producidas estructuralmente:',
    `  ${tipos(por('productor estructural'), 'productorEstructural').join(', ')}`,
    'Productores estructurales:',
    ...(por('productor estructural').length ? por('productor estructural').map((c) => `  ${id(c)}  → ${c.productorEstructural.join(', ')}${c.respaldo.length ? `   (respaldo: ${c.respaldo.join(', ')})` : ''}`) : ['  (ninguno)']),
    'Transformaciones:',
    ...(por('transformación').length ? por('transformación').map((c) => `  ${id(c)}  ↻ ${c.transformacion.join(', ')}`) : ['  (ninguna)']),
    'Eliminadores:',
    ...(por('eliminador').length ? por('eliminador').map((c) => `  ${id(c)}  ✕ ${c.eliminadas.join(', ')}`) : ['  (ninguno)']),
    'Con requires declarado (lo que la estructura no demuestra):',
    ...(conDeclaracion.length ? conDeclaracion.map((c) => `  ${id(c)}  ← ${[...c.declarado.enCodigo, ...c.declarado.enPageObject, ...c.declarado.enMetadata].join(', ')}`) : ['  (ninguno)']),
    ...(filas.some((c) => c.declarado.redundantes.length) ? ['Declaraciones REDUNDANTES (la estructura ya las demuestra; quitar):', ...filas.filter((c) => c.declarado.redundantes.length).map((c) => `  ${id(c)}  — ${c.declarado.redundantes.join('; ')}`)] : []),
    'No determinados (revisar: ¿necesitan contrato de entidad?):',
    ...(noDet.length ? noDet.map((c) => `  ${id(c)}  — ${c.noDeterminado.join('; ')}`.slice(0, 260)) : ['  (ninguno)']),
  ];
  if (process.argv.includes('--sugeridos')) {
    L.push('Sugeridos con fixture:', ...sugeridos.map((c) => `  ${id(c)}  — ${c.sugerido[0]}`));
  }
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
