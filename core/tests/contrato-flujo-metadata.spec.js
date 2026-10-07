const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const { escanearArchivo } = require('../utils/flowScanner');
const { tiposDeclarados, ordenesDeclarados, resolverMetadata } = require('../utils/flowMetadata');
const { contratosEnArchivo } = require('../utils/flowEstructura');

/**
 * CONTRATO de la metadata de flujos (`<modulo>/data/flujo-tests.js`) frente al CÓDIGO de los tests.
 *
 * Contrato de ENTIDAD (`ENTIDAD_FLUJO` de los Page Objects de listado): su `tipo` lo produce algún test, su
 * `referencia` está entre los campos publicados y sus métodos existen. Los `requires` que la estructura demuestra
 * no se repiten como declaración manual (una declaración redundante rompe el contrato).
 *
 * `produces` se DERIVA del código (`flowContext.publish/update('tipo')`, escáner estático
 * `core/utils/flowScanner.js`) y `requires` se DETECTA (`flowContext.get('tipo')`) o se DECLARA junto a
 * las claves del test (`registrarCaso` / `ESTRATEGIAS` con `entidad` + `campo`); la metadata solo
 * conserva lo que el código no puede saber (`orden`). La metadata es OPCIONAL por test: un test sin
 * entrada, o sin ninguna señal de flujo, sigue siendo válido (solo, o como paso independiente de un
 * flujo). Lo que se vigila acá es que nada quede desactualizado o en desacuerdo con el código y rompa o
 * desconecte un flujo en silencio:
 *  - cada entrada corresponde a un test que existe (`tests/<caso>.test.js`);
 *  - si una entrada declara `produces` (forma antigua), COINCIDE con lo que el código publica;
 *  - `orden` solo se declara para un tipo que el test realmente produce, y es único por tipo;
 *  - un test cuyo uso de `flowContext` no se puede determinar estáticamente DEBE declarar `produces`;
 *  - `requires` (declarado o detectado) es consistente: sin contradicciones ni declaraciones inválidas,
 *    la entidad la produce algún test, el `campo` está entre los que esa entidad publica y la `clave`
 *    existe en el test.
 */
const RAIZ = path.resolve(__dirname, '..', '..');
const workspaces = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).workspaces || [];

function leerMetadata() {
  const out = [];
  for (const ws of workspaces) {
    const archivo = path.join(RAIZ, ws, 'data', 'flujo-tests.js');
    if (!fs.existsSync(archivo)) continue;
    // eslint-disable-next-line global-require, import/no-dynamic-require
    for (const [caso, meta] of Object.entries(require(archivo))) out.push({ ws, caso, meta });
  }
  return out;
}

/** Todos los tests (`*.test.js`) de todos los módulos, escaneados estáticamente. */
function escanearTodos() {
  const out = [];
  for (const ws of workspaces) {
    const dir = path.join(RAIZ, ws, 'tests');
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.test.js'))) {
      out.push({ ws, caso: f.replace(/\.test\.js$/, ''), ...escanearArchivo(path.join(dir, f)) });
    }
  }
  return out;
}

describe('contrato de la metadata de flujos (flujo-tests.js) vs el código', function () {
  const entradas = leerMetadata();
  const tests = escanearTodos();
  const escaneo = (ws, caso) => tests.find((t) => t.ws === ws && t.caso === caso);

  it('hay metadata de al menos un módulo (el contrato no pasa por vacío)', function () {
    expect(entradas.length).to.be.greaterThan(0);
  });

  it('cada entrada corresponde a un test existente del mismo módulo', function () {
    const huerfanas = entradas
      .filter((e) => !fs.existsSync(path.join(RAIZ, e.ws, 'tests', `${e.caso}.test.js`)))
      .map((e) => `${e.ws}/${e.caso}`);
    expect(huerfanas, `metadata de tests que ya no existen: ${huerfanas.join(', ')}`).to.deep.equal([]);
  });

  it('produces/orden/requires tienen la forma esperada', function () {
    for (const { ws, caso, meta } of entradas) {
      const id = `${ws}/${caso}`;
      for (const p of meta.produces || []) {
        if (typeof p === 'string') {
          expect(p, `${id}: produces`).to.not.be.empty;
        } else {
          expect(p.tipo, `${id}: produces.tipo`).to.be.a('string').and.not.empty;
          expect(p.orden, `${id}: produces.orden`).to.be.a('number');
        }
      }
      for (const [tipo, n] of Object.entries(meta.orden || {})) {
        expect(n, `${id}: orden.${tipo}`).to.be.a('number');
      }
      for (const r of meta.requires || []) {
        expect(r.tipo, `${id}: requires.tipo`).to.be.a('string').and.not.empty;
        if (r.clave !== undefined) {
          expect(r.clave, `${id}: requires.clave`).to.be.a('string').and.not.empty;
          expect(r.campo, `${id}: requires.campo (nunca se deduce de la clave)`).to.be.a('string').and.not.empty;
        }
      }
    }
  });

  it('el produces declarado (forma antigua) COINCIDE con lo que el código publica', function () {
    const discrepancias = [];
    for (const { ws, caso, meta } of entradas) {
      const declarados = tiposDeclarados(meta);
      const esc = escaneo(ws, caso);
      if (!esc || !declarados.length || esc.indeterminado.length) continue;
      const a = [...declarados].sort().join(',');
      const b = [...esc.produces].sort().join(',');
      if (a !== b) discrepancias.push(`${ws}/${caso}: metadata [${a}] ≠ código [${b || 'nada'}]`);
    }
    expect(discrepancias, discrepancias.join('; ')).to.deep.equal([]);
  });

  it('un test cuyo uso de flowContext no se puede determinar estáticamente declara produces en la metadata', function () {
    const sinDeclarar = tests
      .filter((t) => t.indeterminado.length)
      .filter((t) => !tiposDeclarados((entradas.find((e) => e.ws === t.ws && e.caso === t.caso) || { meta: {} }).meta).length)
      .map((t) => `${t.ws}/${t.caso} (${t.indeterminado.map((x) => x.motivo).join('; ')})`);
    expect(sinDeclarar, sinDeclarar.join('; ')).to.deep.equal([]);
  });

  it('el `orden` solo se declara para un tipo que el test produce, y es único por tipo', function () {
    const vistos = new Map();
    const problemas = [];
    for (const { ws, caso, meta } of entradas) {
      const esc = escaneo(ws, caso);
      const produce = esc && !esc.indeterminado.length ? esc.produces : tiposDeclarados(meta);
      for (const [tipo, n] of Object.entries(ordenesDeclarados(meta))) {
        if (!produce.includes(tipo)) problemas.push(`${ws}/${caso}: orden para "${tipo}" pero no lo produce`);
        const k = `${tipo}#${n}`;
        if (vistos.has(k)) problemas.push(`${vistos.get(k)} y ${ws}/${caso} comparten orden (${k})`);
        else vistos.set(k, `${ws}/${caso}`);
      }
    }
    expect(problemas, problemas.join('; ')).to.deep.equal([]);
  });

  /** Metadata declarada de un test (o {}), y el resultado de resolver su metadata efectiva. */
  const metaDe = (ws, caso) => (entradas.find((e) => e.ws === ws && e.caso === caso) || { meta: {} }).meta;
  const resueltos = tests.map((t) => {
    const archivo = path.join(RAIZ, t.ws, 'tests', `${t.caso}.test.js`);
    const r = resolverMetadata([{ caso: t.caso, archivo }], { [t.caso]: metaDe(t.ws, t.caso) });
    return { ...t, requires: r.metadata[t.caso].requires || [], errores: r.errores, derivado: r.derivado[t.caso] };
  });

  it('ningún test tiene contradicciones ni declaraciones inválidas (requires detectado vs declarado en código y metadata)', function () {
    const errores = resueltos.flatMap((r) => r.errores.map((e) => `${r.ws}/${r.caso}: ${e}`));
    expect(errores, errores.join('\n')).to.deep.equal([]);
  });

  it('toda entidad requerida (detectada o declarada) la produce algún test', function () {
    const producidos = new Set();
    for (const t of tests) {
      for (const p of t.indeterminado.length ? tiposDeclarados(metaDe(t.ws, t.caso)) : t.produces) producidos.add(p);
    }
    const sinProductor = resueltos
      .flatMap((r) => r.requires.map((q) => ({ id: `${r.ws}/${r.caso}`, tipo: q.tipo })))
      .filter((x) => !producidos.has(x.tipo))
      .map((x) => `${x.id} requiere la entidad "${x.tipo}", que ningún test produce`);
    expect(sinProductor, sinProductor.join('; ')).to.deep.equal([]);
  });

  it('el `campo` de cada requires está entre los campos que esa entidad publica (cuando el código lo demuestra)', function () {
    const publicados = {}; // tipo -> Set de campos | null (alguna publicación no es un objeto literal)
    for (const t of tests) {
      for (const [tipo, campos] of Object.entries(t.camposPublicados || {})) {
        if (campos === null || publicados[tipo] === null) publicados[tipo] = null;
        else publicados[tipo] = new Set([...(publicados[tipo] || []), ...campos]);
      }
    }
    const problemas = [];
    for (const r of resueltos) {
      for (const q of r.requires.filter((x) => x.campo)) {
        const conocidos = publicados[q.tipo];
        if (conocidos && !conocidos.has(q.campo)) {
          problemas.push(`${r.ws}/${r.caso}: "${q.clave}" ← ${q.tipo}.${q.campo}, pero "${q.tipo}" solo publica [${[...conocidos].join(', ')}]`);
        }
      }
    }
    expect(problemas, problemas.join('; ')).to.deep.equal([]);
  });

  it('la clave de cada requires de la METADATA existe entre las claves que el test registra', function () {
    const problemas = [];
    for (const e of entradas) {
      const esc = escaneo(e.ws, e.caso);
      if (!esc) continue;
      const existentes = new Set([...esc.claves, ...esc.declaraciones.map((d) => d.clave)]);
      for (const q of (e.meta.requires || []).filter((x) => x.clave)) {
        if (!existentes.has(q.clave)) problemas.push(`${e.ws}/${e.caso}: la metadata enlaza la clave "${q.clave}", que el test no registra`);
      }
    }
    expect(problemas, problemas.join('; ')).to.deep.equal([]);
  });

  it('un test sin requires ni metadata de flujo es válido (no hay obligación de declarar nada)', function () {
    const sinNada = resueltos.filter((r) => !r.requires.length && !r.derivado.produces.length);
    expect(sinNada.length).to.be.greaterThan(0);
    for (const r of sinNada) expect(r.errores, `${r.ws}/${r.caso}`).to.deep.equal([]);
  });

  it('ninguna declaración manual (test o metadata) es redundante con lo que la estructura ya demuestra', function () {
    const redundantes = resueltos.flatMap((r) => r.derivado.redundantes.map((x) => `${r.ws}/${r.caso}: ${x}`));
    expect(redundantes, redundantes.join(' | ')).to.deep.equal([]);
  });

  /** Page Objects (`<ws>/pages/*.js`) que declaran ENTIDAD_FLUJO. */
  const pagesConContrato = () => {
    const out = [];
    for (const ws of workspaces) {
      const dir = path.join(RAIZ, ws, 'pages');
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.js'))) {
        const archivo = path.join(dir, f);
        if (!/ENTIDAD_FLUJO/.test(fs.readFileSync(archivo, 'utf8'))) continue;
        out.push({ id: `${ws}/pages/${f}`, archivo, ...contratosEnArchivo(archivo) });
      }
    }
    return out;
  };

  it('cada ENTIDAD_FLUJO es válida: tipo producido por algún test, referencia publicada y métodos existentes', function () {
    const publicados = {};
    for (const t of tests) {
      for (const [tipo, campos] of Object.entries(t.camposPublicados || {})) {
        if (campos === null || publicados[tipo] === null) publicados[tipo] = null;
        else publicados[tipo] = new Set([...(publicados[tipo] || []), ...campos]);
      }
    }
    const pos = pagesConContrato();
    expect(pos.length, 'al menos un Page Object declara ENTIDAD_FLUJO').to.be.greaterThan(0);
    const problemas = [];
    for (const po of pos) {
      po.invalidas.forEach((i) => problemas.push(`${po.id}: ${i.motivo}`));
      const src = fs.readFileSync(po.archivo, 'utf8');
      for (const c of po.contratos) {
        if (!(c.tipo in publicados)) problemas.push(`${po.id}: la entidad "${c.tipo}" no la produce ningún test`);
        else if (publicados[c.tipo] && !publicados[c.tipo].has(c.referencia)) {
          problemas.push(`${po.id}: referencia "${c.referencia}" no está entre los campos que publica "${c.tipo}" [${[...publicados[c.tipo]].join(', ')}]`);
        }
        for (const m of c.metodos) {
          if (!new RegExp(String.raw`\n\s*(?:static\s+)?(?:async\s+)?${m}\s*\(`).test(src)) problemas.push(`${po.id}: el método "${m}" no existe en el Page Object`);
        }
      }
    }
    expect(problemas, problemas.join(' | ')).to.deep.equal([]);
  });

  it('la cadena real obtiene sus requires de la estructura, sin declaración manual en los tests', function () {
    const porEstructura = {
      'reclutamiento/editar-paquete-beneficios-solicitud-empleo': ['solicitud'],
      'reclutamiento/cambiar-solicitud-primera-entrevista': ['solicitud'],
      'reclutamiento/cambiar-solicitud-segunda-entrevista': ['solicitud'],
      'reclutamiento/cambiar-solicitud-tercera-entrevista': ['solicitud'],
      'reclutamiento/cambiar-solicitud-oferta-empleo': ['solicitud'],
      'reclutamiento/cambiar-solicitud-crear-empleado': ['solicitud'],
      'reclutamiento/consultar-solicitudes-desde-requisicion': ['requisicion'],
      'nomina/asignar-empleado-nomina': ['empleado'],
    };
    for (const [id, tipos] of Object.entries(porEstructura)) {
      const r = resueltos.find((x) => `${x.ws}/${x.caso}` === id);
      expect([...new Set(r.requires.map((q) => q.tipo))], id).to.deep.equal(tipos);
      expect(r.estructurales.length, `${id}: requires por estructura`).to.be.greaterThan(0);
      expect(r.declaraciones.filter((d) => d.via !== 'ESTRATEGIAS'), `${id}: sin declaración manual`).to.deep.equal([]);
    }
  });

  it('lo que la estructura no puede probar se declara una sola vez en el Page Object (ESTRATEGIAS), no por test', function () {
    const r = resueltos.find((x) => `${x.ws}/${x.caso}` === 'reclutamiento/crear-solicitud-empleo');
    expect(r.requires).to.deep.equal([{ tipo: 'requisicion', clave: 'Requisición', campo: 'nombre' }]);
    expect(r.declaraciones.map((d) => d.via)).to.deep.equal(['ESTRATEGIAS']);
  });

  it('los tests reales de la cadena publican lo esperado (detección estática, sin ejecutarlos)', function () {
    const esperado = {
      'reclutamiento/crear-req-creacion': ['requisicion'],
      'reclutamiento/crear-solicitud-empleo': ['solicitud'],
      'reclutamiento/editar-paquete-beneficios-solicitud-empleo': ['solicitud'],
      'reclutamiento/cambiar-solicitud-primera-entrevista': ['solicitud'],
      'reclutamiento/cambiar-solicitud-segunda-entrevista': ['solicitud'],
      'reclutamiento/cambiar-solicitud-tercera-entrevista': ['solicitud'],
      'reclutamiento/cambiar-solicitud-oferta-empleo': ['solicitud'],
      'reclutamiento/cambiar-solicitud-crear-empleado': ['empleado'],
      'nomina/asignar-empleado-nomina': [],
    };
    for (const [id, tipos] of Object.entries(esperado)) {
      const [ws, caso] = id.split('/');
      expect(escaneo(ws, caso).produces, id).to.deep.equal(tipos);
    }
  });
});
