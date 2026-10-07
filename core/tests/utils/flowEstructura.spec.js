const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');
const { detectarEstructurales } = require('../../utils/flowEstructura');
const { resolverMetadata } = require('../../utils/flowMetadata');
const { planificar } = require('../../utils/flowPlanner');

/**
 * Detección ESTRUCTURAL de requires (ver `core/utils/flowEstructura.js`): la clave del test llega a un
 * localizador de un Page Object que declara `ENTIDAD_FLUJO`. Los archivos de cada caso se crean en un
 * directorio temporal; no se ejecuta nada.
 */
describe('utils/flowEstructura — requires demostrados por la estructura (unitario)', function () {
  let dir;

  beforeEach(function () {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'triple-estructura-'));
  });
  afterEach(function () {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const escribir = (rel, contenido) => {
    const f = path.join(dir, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, contenido);
    return f;
  };
  const PO = (clase, contrato, extra = '') =>
    `class ${clase} {\n  static get ENTIDAD_FLUJO() { return ${contrato}; }\n  async abrirDetalle(x) {}\n${extra}\n}\nmodule.exports = ${clase};\n`;
  const detectar = (test) => detectarEstructurales(escribir('tests/caso.test.js', test));

  it('Page Object instanciado en el test: la clave que llega a abrirDetalle se enlaza a la entidad', function () {
    escribir('pages/Pagina.js', PO('Pagina', "{ tipo: 'solicitud', referencia: 'codigo' }"));
    const r = detectar(
      "const Pagina = require('../pages/Pagina');\nconst CASO = 'c';\nit('x', async () => {\n  const p = await new Pagina(driver).listo();\n  await p.abrirDetalle(testContext.get(CASO, 'cod'));\n});\n"
    );
    expect(r.estructurales).to.deep.equal([{ clave: 'cod', entidad: 'solicitud', campo: 'codigo', via: 'Pagina.abrirDetalle', linea: 0 }]);
  });

  it('fixture: ctx.lista = <PO> en el cuerpo del fixture; alias con reasignación (fallback automático)', function () {
    escribir('pages/Pagina.js', PO('Pagina', "{ tipo: 'solicitud', referencia: 'codigo' }"));
    escribir('support/fx.js', "const Pagina = require('../pages/Pagina');\nfunction usarLista() {\n  const ctx = {};\n  beforeEach(async () => { ctx.driver = await createDriver(); ctx.lista = await new Pagina(ctx.driver).listo(); });\n  return ctx;\n}\nmodule.exports = { usarLista };\n");
    const r = detectar(
      "const fx = require('../support/fx');\nit('x', async () => {\n  const ctx = fx.usarLista();\n  const codigo = testContext.get(CASO, 'codigo');\n  let usado = codigo;\n  if (!usado) { usado = fila['Código']; }\n  await ctx.lista.abrirDetalle(usado);\n});\n"
    );
    expect(r.estructurales.map((e) => [e.clave, e.entidad, e.campo])).to.deep.equal([['codigo', 'solicitud', 'codigo']]);
  });

  it('la clave puede estar en una constante de módulo con string literal', function () {
    escribir('pages/Pagina.js', PO('Pagina', "{ tipo: 'empleado', referencia: 'codigo' }"));
    const r = detectar(
      "const Pagina = require('../pages/Pagina');\nconst CLAVE = 'nombre';\nit('x', async () => {\n  const p = new Pagina(d);\n  const n = testContext.get(CASO, CLAVE);\n  await p.abrirDetalle(n);\n});\n"
    );
    expect(r.estructurales.map((e) => e.clave)).to.deep.equal(['nombre']);
  });

  it('helper del módulo de fixtures (un salto): analiza su cuerpo con el ctx recibido', function () {
    escribir('pages/Pagina.js', PO('Pagina', "{ tipo: 'requisicion', referencia: 'nombre' }"));
    escribir(
      'support/fx.js',
      "const Pagina = require('../pages/Pagina');\nfunction usarLista() { const ctx = {}; beforeEach(async () => { ctx.lista = new Pagina(ctx.driver); }); return ctx; }\n" +
        "async function abrirExistente(ctx, caso) {\n  const codigo = testContext.get(caso, 'codigo');\n  const nombre = testContext.get(caso, 'nombre');\n  const id = codigo || nombre;\n  return ctx.lista.abrirDetalle(id);\n}\nmodule.exports = { usarLista, abrirExistente };\n"
    );
    const r = detectar("const fx = require('../support/fx');\nit('x', async () => {\n  const ctx = fx.usarLista();\n  await fx.abrirExistente(ctx, CASO);\n});\n");
    expect(r.estructurales.map((e) => [e.clave, e.entidad, e.campo]).sort()).to.deep.equal([
      ['codigo', 'requisicion', 'nombre'],
      ['nombre', 'requisicion', 'nombre'],
    ]);
  });

  it('método propio declarado en `metodos`, con parsearValoresMultiples y for-of', function () {
    escribir('pages/Nomina.js', PO('Nomina', "{ tipo: 'empleado', referencia: 'codigo', metodos: ['seleccionarPorCodigo'] }", '  async seleccionarPorCodigo(c) {}'));
    const r = detectar(
      "const Nomina = require('../pages/Nomina');\nit('x', async () => {\n  const n = await new Nomina(d).estaCargado();\n  const lista = parsearValoresMultiples(testContext.get(CASO, 'codigos'));\n  for (const c of lista) { await n.seleccionarPorCodigo(c); }\n});\n"
    );
    expect(r.estructurales.map((e) => [e.clave, e.entidad, e.campo, e.via])).to.deep.equal([['codigos', 'empleado', 'codigo', 'Nomina.seleccionarPorCodigo']]);
  });

  it('contrato como array: una clase que localiza varias entidades', function () {
    escribir('pages/Mixta.js', PO('Mixta', "[{ tipo: 'a', referencia: 'x' }, { tipo: 'b', referencia: 'y', metodos: ['otro'] }]", '  async otro(v) {}'));
    const r = detectar("const Mixta = require('../pages/Mixta');\nit('x', async () => {\n  const p = new Mixta(d);\n  await p.abrirDetalle(testContext.get(CASO, 'k1'));\n  await p.otro(testContext.get(CASO, 'k2'));\n});\n");
    expect(r.estructurales.map((e) => [e.clave, e.entidad, e.campo])).to.deep.equal([['k1', 'a', 'x'], ['k2', 'b', 'y']]);
  });

  describe('lo que NO se deduce', function () {
    it('un Page Object SIN ENTIDAD_FLUJO no crea nada (ni por nombre de clase, de clave o de test)', function () {
      escribir('pages/SolicitudEmpleoPage.js', 'class SolicitudEmpleoPage { async abrirDetalle(x) {} }\nmodule.exports = SolicitudEmpleoPage;\n');
      const r = detectar("const P = require('../pages/SolicitudEmpleoPage');\nit('x', async () => {\n  const p = new P(d);\n  await p.abrirDetalle(testContext.get(CASO, 'codigo'));\n});\n");
      expect(r.estructurales).to.deep.equal([]);
    });

    it('una clave que no llega al localizador no se enlaza', function () {
      escribir('pages/Pagina.js', PO('Pagina', "{ tipo: 'solicitud', referencia: 'codigo' }"));
      const r = detectar("const Pagina = require('../pages/Pagina');\nit('x', async () => {\n  const p = new Pagina(d);\n  const c = testContext.get(CASO, 'comentario');\n  await p.abrirDetalle('fijo');\n  await p.escribir(c);\n});\n");
      expect(r.estructurales).to.deep.equal([]);
    });

    it('una transformación desconocida (función arbitraria, concatenación) rompe la cadena', function () {
      escribir('pages/Pagina.js', PO('Pagina', "{ tipo: 'solicitud', referencia: 'codigo' }"));
      const r = detectar("const Pagina = require('../pages/Pagina');\nit('x', async () => {\n  const p = new Pagina(d);\n  const a = transformar(testContext.get(CASO, 'k'));\n  const b = testContext.get(CASO, 'k') + '-x';\n  await p.abrirDetalle(a);\n  await p.abrirDetalle(b);\n});\n");
      expect(r.estructurales).to.deep.equal([]);
    });

    it('clave dinámica (variable que no es constante literal) no se enlaza', function () {
      escribir('pages/Pagina.js', PO('Pagina', "{ tipo: 'solicitud', referencia: 'codigo' }"));
      const r = detectar("const Pagina = require('../pages/Pagina');\nit('x', async () => {\n  const p = new Pagina(d);\n  await p.abrirDetalle(testContext.get(CASO, clave()));\n});\n");
      expect(r.estructurales).to.deep.equal([]);
    });

    it('ENTIDAD_FLUJO mal formada (sin referencia o no literal) se reporta como inválida', function () {
      escribir('pages/Pagina.js', PO('Pagina', "{ tipo: 'solicitud' }"));
      const r = detectar("const Pagina = require('../pages/Pagina');\nit('x', async () => {\n  const p = new Pagina(d);\n  await p.abrirDetalle(testContext.get(CASO, 'c'));\n});\n");
      expect(r.estructurales).to.deep.equal([]);
      expect(r.invalidas[0].motivo).to.contain('ENTIDAD_FLUJO exige tipo y referencia');
    });
  });

  describe('integración con el resolver y el planner', function () {
    const sel = (...casos) => casos.map((caso) => ({ caso, archivo: `/x/${caso}.test.js` }));
    const ESTR = (extra) => ({ produces: [], lecturas: [], claves: [], declaraciones: [], invalidas: [], indeterminado: [], estructurales: [], ...extra });
    const codigo = (mapa) => (archivo) => ESTR(mapa[archivo.split('/').pop().replace('.test.js', '')] || {});
    const CONSUME = { estructurales: [{ clave: 'codigo', entidad: 'solicitud', campo: 'codigo', via: 'P.abrirDetalle', linea: 0 }] };

    it('A produce X; B y C la consumen por estructura: C, A, B → A, B, C y con binding (sin metadata)', function () {
      const esc = codigo({ A: ESTR({ produces: ['solicitud'] }), B: CONSUME, C: CONSUME });
      const { metadata, errores } = resolverMetadata(sel('C', 'A', 'B'), {}, { escanear: esc });
      expect(errores).to.deep.equal([]);
      const plan = planificar(sel('C', 'A', 'B'), metadata);
      expect(plan.errores).to.deep.equal([]);
      expect(plan.orden.map((x) => x.caso)).to.deep.equal(['A', 'C', 'B']); // A primero; B y C conservan el orden de selección
      expect(plan.bindings.map((b) => b.caso).sort()).to.deep.equal(['B', 'C']);
    });

    it('otro test que usa la misma entidad sin evidencia estructural no se conecta por fuerza', function () {
      const esc = codigo({ A: ESTR({ produces: ['solicitud'] }), D: ESTR({ claves: ['codigo'] }) });
      const { metadata } = resolverMetadata(sel('D', 'A'), {}, { escanear: esc });
      expect(metadata.D.requires).to.equal(undefined);
      expect(planificar(sel('D', 'A'), metadata).orden.map((x) => x.caso)).to.deep.equal(['D', 'A']);
    });

    it('una declaración manual igual a la estructural es REDUNDANTE (se informa); distinta es contradicción', function () {
      const manual = { clave: 'codigo', entidad: 'solicitud', campo: 'codigo' };
      let r = resolverMetadata(sel('B'), {}, { escanear: codigo({ B: ESTR({ ...CONSUME, declaraciones: [manual] }) }) });
      expect(r.errores).to.deep.equal([]);
      expect(r.derivado.B.redundantes).to.have.length(1);
      expect(r.metadata.B.requires).to.deep.equal([{ tipo: 'solicitud', clave: 'codigo', campo: 'codigo' }]);
      r = resolverMetadata(sel('B'), {}, { escanear: codigo({ B: ESTR({ ...CONSUME, declaraciones: [{ ...manual, entidad: 'empleado' }] }) }) });
      expect(r.errores[0]).to.contain('Contradicción de requires').and.contain('empleado.codigo').and.contain('solicitud.codigo');
    });

    it('la estructura contradice una lectura tipada de otra entidad → error de plan', function () {
      const r = resolverMetadata(sel('B'), {}, { escanear: codigo({ B: ESTR({ ...CONSUME, lecturas: ['empleado'] }) }) });
      expect(r.errores[0]).to.contain('Contradicción de requires');
    });
  });
});
