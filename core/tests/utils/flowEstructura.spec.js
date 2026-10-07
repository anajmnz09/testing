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
      expect(r.invalidas[0].motivo).to.contain('exige referencia');
    });
  });

  describe('creadores, editores, eliminadores y subentidades (estructura)', function () {
    const FORM = `class Form { static get ENTIDAD_FLUJO() { return { tipo: 'cap', referencia: 'nombre', metodos: [], confirmadores: [{ metodo: 'guardar' }] }; } async guardar() {} }
module.exports = Form;
`;
    const PADRE = `const Form = require('./Form');
class Detalle {
  static get ENTIDAD_FLUJO() {
    return [
      { tipo: 'cap', referencia: 'nombre', metodos: ['adjuntar'], creadores: ['abrirAgregar'], editores: ['abrirEditar'], eliminadores: ['eliminar'] },
      { tipo: 'edu', referencia: 'nombre', metodos: [], creadores: [{ metodo: 'agregarMixto', argumento: 0, valor: 'Educación', persiste: true, referenciaArg: '1.t' }] },
      { tipo: 'exp', referencia: 'nombre', metodos: [], creadores: [{ metodo: 'agregarMixto', argumento: 0, valor: 'Experiencia', persiste: true, referenciaArg: '1.t' }] },
    ];
  }
  static get ACCIONES_FLUJO() { return [{ metodo: 'subirFoto', clase: 'atributo' }]; }
  async abrirAgregar() { return new Form(); }
  async abrirEditar(o) { return new Form(); }
  async eliminar(n) {}
  async adjuntar(n) {}
  async agregarMixto(t, d) {}
  async subirFoto() {}
}
module.exports = Detalle;
`;
    const LISTADO = `const Detalle = require('./Detalle');
class Lista {
  static get ENTIDAD_FLUJO() { return { tipo: 'emp', referencia: 'nombre', creadores: ['crear'] }; }
  async abrirDetalle(x) { return new Detalle(); }
  async abrirPrimero() { return new Detalle(); }
  async crear() { return new Detalle(); }
}
module.exports = Lista;
`;
    const armar = (test) => {
      escribir('pages/Detalle.js', PADRE);
      escribir('pages/Form.js', FORM);
      escribir('pages/Lista.js', LISTADO);
      return detectarEstructurales(escribir('tests/caso.test.js', `const Lista = require('../pages/Lista');\nconst CASO = 'c';\n${test}`));
    };

    it('subentidad: el detalle se resuelve por lo que devuelve abrirDetalle (alternativa con ternario) y su creador se detecta', function () {
      const r = armar("it('x', async () => {\n  const lista = new Lista(d);\n  const n = testContext.get(CASO, 'emp');\n  const detalle = n ? await lista.abrirDetalle(n) : await lista.abrirPrimero();\n  await detalle.abrirAgregar();\n});\n");
      expect(r.estructurales.map((e) => [e.clave, e.entidad])).to.deep.equal([['emp', 'emp']]);
      expect(r.creaciones.map((e) => e.entidad)).to.deep.equal(['cap']);
    });

    it('editar y eliminar localizan por referencia (consumen) y se detectan como edición / eliminación', function () {
      const r = armar("it('x', async () => {\n  const lista = new Lista(d);\n  const detalle = await lista.abrirDetalle('x');\n  const c = testContext.get(CASO, 'cap');\n  await detalle.abrirEditar(c);\n  await detalle.eliminar(c);\n});\n");
      expect(r.estructurales.map((e) => [e.clave, e.entidad]).sort()).to.deep.equal([['cap', 'cap']]);
      expect(r.ediciones.map((e) => e.entidad)).to.deep.equal(['cap']);
      expect(r.eliminaciones.map((e) => e.entidad)).to.deep.equal(['cap']);
    });

    it('un método compartido por dos entidades se distingue por el argumento LITERAL (o constante); si no es literal, no se adivina', function () {
      const r = armar("const TIPO = 'Experiencia';\nit('x', async () => {\n  const lista = new Lista(d);\n  const detalle = await lista.abrirDetalle('x');\n  await detalle.agregarMixto(TIPO, { t: 'a' });\n  await detalle.agregarMixto(tipoDinamico(), { t: 'b' });\n});\n");
      expect(r.creaciones.map((e) => e.entidad)).to.deep.equal(['exp']);
    });

    it('la creación desde el listado (crear) y el guardado confirmado se detectan; sin confirmar, el resolver no la cuenta', function () {
      const r = armar("it('x', async () => {\n  const lista = new Lista(d);\n  const detalle = await lista.crear();\n});\n");
      expect(r.creaciones.map((e) => e.entidad)).to.deep.equal(['emp']);
      expect(r.confirmaciones).to.deep.equal([]);
    });

    it('un guardado del formulario hijo se detecta como confirmación de SU entidad', function () {
      const r = armar("it('x', async () => {\n  const lista = new Lista(d);\n  const detalle = await lista.abrirDetalle('x');\n  const form = await detalle.abrirAgregar();\n  await form.guardar();\n});\n");
      expect(r.confirmaciones.map((e) => e.entidad)).to.deep.equal(['cap']);
      expect(r.confirmables).to.include('cap');
    });

    it('una acción declarada en ACCIONES_FLUJO (atributo) se detecta como exclusión, no como entidad', function () {
      const r = armar("it('x', async () => {\n  const lista = new Lista(d);\n  const detalle = await lista.abrirDetalle('x');\n  await detalle.subirFoto();\n});\n");
      expect(r.exclusiones.map((e) => e.clase)).to.deep.equal(['atributo']);
      expect(r.creaciones).to.deep.equal([]);
    });

    it('un helper del módulo de fixtures que devuelve { detalle } tipa la variable del test (desestructuración)', function () {
      escribir('pages/Detalle.js', PADRE);
      escribir('pages/Form.js', FORM);
      escribir('pages/Lista.js', LISTADO);
      escribir('support/fx.js', "const Lista = require('../pages/Lista');\nfunction usar() { const ctx = {}; beforeEach(async () => { ctx.lista = new Lista(ctx.driver); }); return ctx; }\nasync function abrir(ctx, caso) {\n  const detalle = await ctx.lista.abrirDetalle(testContext.get(caso, 'emp'));\n  return { detalle, id: 1 };\n}\nmodule.exports = { usar, abrir };\n");
      const r = detectarEstructurales(escribir('tests/caso.test.js', "const fx = require('../support/fx');\nit('x', async () => {\n  const ctx = fx.usar();\n  const { detalle } = await fx.abrir(ctx, CASO);\n  await detalle.abrirAgregar();\n});\n"));
      expect(r.estructurales.map((e) => e.clave)).to.deep.equal(['emp']);
      expect(r.creaciones.map((e) => e.entidad)).to.deep.equal(['cap']);
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
