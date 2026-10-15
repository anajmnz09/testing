const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');
const { detectarCamposSeleccionables, catalogoDeEntidades, entidadDeLabel, leerControles, ESTRATEGIAS_DE_SELECCION } = require('../../utils/flowCampos');
const { escanearArchivo } = require('../../utils/flowScanner');
const { resolverMetadata } = require('../../utils/flowMetadata');
const { planificar } = require('../../utils/flowPlanner');
const strategies = require('../../strategies');

/**
 * Requires por CAMPOS SELECCIONABLES (ver `core/utils/flowCampos.js`): label + entidad conocida + dropdown seleccionable.
 * Las entidades salen de los contratos ENTIDAD_FLUJO de los Page Objects (aquí, de un repo temporal con varios módulos);
 * al final se comprueba la integración con el escáner real sobre tests reales del proyecto.
 */
describe('utils/flowCampos — requires por campos seleccionables (unitario)', function () {
  let dir;

  before(function () {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'triple-campos-'));
    const po = (clase, contrato) =>
      `class ${clase} {\n  static get ENTIDAD_FLUJO() { return ${contrato}; }\n  async abrirDetalle(x) {}\n}\nmodule.exports = ${clase};\n`;
    const escribir = (rel, contenido) => {
      const f = path.join(dir, rel);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, contenido);
      return f;
    };
    // módulo A (catálogo) y módulo B (otro módulo): las entidades vienen de los contratos, no de una lista
    escribir('modA/pages/PuestoPage.js', po('PuestoPage', "{ tipo: 'puesto', referencia: 'nombre', alias: ['cargo'] }"));
    escribir('modA/pages/SucursalPage.js', po('SucursalPage', "{ tipo: 'sucursal', referencia: 'nombre' }"));
    escribir('modA/pages/SolicitudPage.js', po('SolicitudPage', "{ tipo: 'solicitud', referencia: 'codigo' }"));
    escribir('modB/pages/PlanPage.js', po('PlanPage', "{ tipo: 'plan-de-seguro', referencia: 'nombre' }"));
    escribir('modB/pages/RazonPage.js', po('RazonPage', "{ tipo: 'razon-salida', referencia: 'nombre' }"));
    escribir('modB/pages/TipoNominaPage.js', po('TipoNominaPage', "{ tipo: 'tipo-nomina', referencia: 'nombre' }"));
    escribir('modB/pages/NominaPage.js', po('NominaPage', "{ tipo: 'nomina', referencia: 'codigo' }"));
    // dos entidades que comparten el alias "ubicacion" (ambigüedad real)
    escribir('modB/pages/AlmacenPage.js', po('AlmacenPage', "{ tipo: 'almacen', referencia: 'nombre', alias: ['ubicacion'] }"));
    escribir('modB/pages/OficinaPage.js', po('OficinaPage', "{ tipo: 'oficina', referencia: 'nombre', alias: ['ubicacion'] }"));
    // formularios (módulo C) y sus tests
    escribir(
      'modC/pages/FormPage.js',
      `const ESTRATEGIAS = {
  'Puesto de trabajo': 'searchAndSelect',
  Cargo: { estrategia: 'directSelect', multiple: false },
  Sucursal: 'searchAndSelect',
  Modalidad: 'searchAndSelect',
  'Nombre del puesto': 'text',
  'Puesto sustituto': 'text',
  'PLAN  DE-SEGURO:': 'directSelect',
  'Razón de salida': 'firstOption',
  'Razón de solicitud': 'directSelect',
  Compuesto: 'searchAndSelect',
  Oficina: { estrategia: 'searchAndSelect', sinRequires: true },
  'Tipo de nómina': 'searchAndSelect',
  'Fecha de puesto': 'datePicker',
  'Aprobado por sucursal': 'switch',
};
class FormPage { static get ESTRATEGIAS() { return ESTRATEGIAS; } }
module.exports = FormPage;
`
    );
    escribir('modC/pages/AmbiguoPage.js', "const ESTRATEGIAS = { Ubicación: 'searchAndSelect' };\nclass AmbiguoPage { static get ESTRATEGIAS() { return ESTRATEGIAS; } }\nmodule.exports = AmbiguoPage;\n");
    const test = (pagina) =>
      `const { testContext } = require('@triple/core');\nconst P = require('../pages/${pagina}');\nconst CASO = 'caso';\ntestContext.registrarCasoDesdeFormulario(CASO, P.ESTRATEGIAS);\n`;
    escribir('modC/tests/formulario.test.js', test('FormPage'));
    escribir('modC/tests/ambiguo.test.js', test('AmbiguoPage'));
    escribir('modC/tests/sin-formulario.test.js', "const P = require('../pages/FormPage');\nconst x = P.ESTRATEGIAS;\n");
    // un test que crea una entidad y cuyo formulario tiene un selector de esa misma entidad
    escribir(
      'modA/pages/SucursalFormPage.js',
      `const ESTRATEGIAS = { 'Sucursal padre': 'searchAndSelect', Puesto: 'searchAndSelect' };
class SucursalFormPage {
  static get ESTRATEGIAS() { return ESTRATEGIAS; }
  static get ENTIDAD_FLUJO() { return { tipo: 'sucursal', referencia: 'nombre', creadores: ['crear'] }; }
  async crear() {}
}
module.exports = SucursalFormPage;
`
    );
    escribir(
      'modA/tests/crear-sucursal.test.js',
      "const { testContext } = require('@triple/core');\nconst P = require('../pages/SucursalFormPage');\nconst CASO = 'c';\ntestContext.registrarCasoDesdeFormulario(CASO, P.ESTRATEGIAS);\nit('x', async () => { const p = new P(); await p.crear(); });\n"
    );
  });
  after(function () {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const ruta = (rel) => path.join(dir, rel);
  const detectar = (rel) => detectarCamposSeleccionables(ruta(rel), { raiz: dir });
  const tiposDe = (r) => r.campos.map((c) => `${c.label}→${c.tipo}`);

  describe('regla: label + entidad conocida + dropdown seleccionable', function () {
    it('1. un dropdown cuyo label coincide con una entidad conocida genera el campo/requires', function () {
      const r = detectar('modC/tests/formulario.test.js');
      expect(tiposDe(r)).to.include('Puesto de trabajo→puesto');
      expect(tiposDe(r)).to.include('Sucursal→sucursal');
      const c = r.campos.find((x) => x.tipo === 'sucursal');
      expect(c).to.include({ estrategia: 'searchAndSelect', via: 'FormPage.ESTRATEGIAS["Sucursal"]' });
    });

    it('3b. un control con `sinRequires: true` no genera requires aunque su label coincida con una entidad conocida', function () {
      const r = detectar('modC/tests/formulario.test.js');
      expect(tiposDe(r).filter((t) => t.startsWith('Oficina'))).to.deep.equal([]);
      const controles = leerControles("const ESTRATEGIAS = { Oficina: { estrategia: 'searchAndSelect', sinRequires: true }, Sucursal: 'searchAndSelect' };");
      expect(controles.map((c) => [c.label, c.sinRequires])).to.deep.equal([
        ['Oficina', true],
        ['Sucursal', false],
      ]);
    });

    it('2. un dropdown cuyo label no coincide con ninguna entidad no genera nada', function () {
      const r = detectar('modC/tests/formulario.test.js');
      expect(r.campos.map((c) => c.label)).to.not.include('Modalidad');
    });

    it('3. un input de texto / fecha / switch con label de entidad no genera nada por esta regla', function () {
      const r = detectar('modC/tests/formulario.test.js');
      const labels = r.campos.map((c) => c.label);
      for (const l of ['Nombre del puesto', 'Puesto sustituto', 'Fecha de puesto', 'Aprobado por sucursal']) expect(labels, l).to.not.include(l);
    });

    it('4. reconoce alias del contrato y variantes de mayúsculas, tildes, espacios y puntuación', function () {
      const r = detectar('modC/tests/formulario.test.js');
      expect(tiposDe(r)).to.include('Cargo→puesto'); // alias declarado en ENTIDAD_FLUJO, estrategia como objeto
      expect(tiposDe(r)).to.include('PLAN  DE-SEGURO:→plan-de-seguro');
      expect(tiposDe(r)).to.include('Razón de salida→razon-salida');
      const cat = catalogoDeEntidades(dir);
      expect(entidadDeLabel('PUESTO', cat)).to.deep.equal({ tipo: 'puesto' });
      expect(entidadDeLabel('  puésto: ', cat)).to.deep.equal({ tipo: 'puesto' });
      expect(entidadDeLabel('RAZON DE SALIDA', cat)).to.deep.equal({ tipo: 'razon-salida' });
    });

    it('5. no coincide por subcadenas accidentales ni por un complemento introducido por "de"', function () {
      const r = detectar('modC/tests/formulario.test.js');
      const labels = r.campos.map((c) => c.label);
      expect(labels).to.not.include('Compuesto'); // "puesto" dentro de otra palabra
      expect(labels).to.not.include('Razón de solicitud'); // la solicitud es complemento de la razón
      const cat = catalogoDeEntidades(dir);
      expect(entidadDeLabel('Subsucursal', cat)).to.equal(null);
      expect(entidadDeLabel('Puestos', cat)).to.equal(null);
    });

    it('el término más largo gana: "Tipo de nómina" es tipo-nomina y no nomina', function () {
      const r = detectar('modC/tests/formulario.test.js');
      expect(tiposDe(r)).to.include('Tipo de nómina→tipo-nomina');
      expect(tiposDe(r)).to.not.include('Tipo de nómina→nomina');
    });

    it('6. funciona con entidades de distintos módulos (el catálogo sale de los contratos de todos)', function () {
      const tipos = catalogoDeEntidades(dir).map((e) => e.tipo);
      expect(tipos).to.include.members(['puesto', 'plan-de-seguro', 'sucursal']);
      const r = detectar('modC/tests/formulario.test.js');
      expect([...new Set(r.campos.map((c) => c.tipo))]).to.include.members(['puesto', 'plan-de-seguro', 'razon-salida', 'tipo-nomina']);
    });

    it('7. una ambigüedad real no asigna ninguna entidad y se reporta como inválida', function () {
      const r = detectar('modC/tests/ambiguo.test.js');
      expect(r.campos).to.deep.equal([]);
      expect(r.invalidas).to.have.length(1);
      expect(r.invalidas[0].motivo).to.match(/AmbiguoPage\.ESTRATEGIAS\["Ubicación"\].*\[almacen, oficina\]/);
    });

    it('un test sin registrarCasoDesdeFormulario no tiene formulario conocido: nada', function () {
      expect(detectar('modC/tests/sin-formulario.test.js')).to.deep.equal({ campos: [], invalidas: [] });
    });

    it('las estrategias consideradas dropdown existen registradas en el Core', function () {
      for (const e of ESTRATEGIAS_DE_SELECCION) expect(strategies.existe(e), e).to.equal(true);
      for (const e of ['text', 'datePicker', 'switch', 'checkbox', 'tagsLibres', 'custom']) expect(ESTRATEGIAS_DE_SELECCION).to.not.include(e);
    });

    it('leerControles entiende string y objeto, y la estrategia no literal queda null', function () {
      const r = leerControles("const ESTRATEGIAS = { A: 'text', 'B c': { estrategia: 'directSelect', x: 1 }, D: ESTRAT };");
      expect(r.map((c) => [c.label, c.estrategia])).to.deep.equal([['A', 'text'], ['B c', 'directSelect'], ['D', null]]);
    });
  });

  describe('integración con resolverMetadata (mismo escáner del proyecto)', function () {
    it('el requires aparece como { tipo } (ordena, no enlaza) y no pisa nada más', function () {
      const f = ruta('modC/tests/formulario.test.js');
      const r = resolverMetadata([{ caso: 'f', archivo: f }], {}, { escanear: (a) => ({ ...escanearArchivo(a), ...detectarCamposSeleccionables(a, { raiz: dir }) }) });
      expect(r.errores).to.deep.equal([]);
      expect(r.metadata.f.requires.map((x) => x.tipo).sort()).to.deep.equal(['plan-de-seguro', 'puesto', 'razon-salida', 'sucursal', 'tipo-nomina']);
      expect(r.metadata.f.requires.every((x) => !x.clave)).to.equal(true);
    });

    it('8. lo que ya se detectaba sigue igual: una entidad ya consumida por clave/metadata/lectura no se duplica', function () {
      const f = ruta('modC/tests/formulario.test.js');
      const base = (a) => ({ ...escanearArchivo(a), ...detectarCamposSeleccionables(a, { raiz: dir }) });
      const conClave = (a) => ({ ...base(a), estructurales: [{ clave: 'Puesto de trabajo', entidad: 'puesto', campo: 'nombre', via: 'PuestoPage.abrirDetalle', linea: 0 }] });
      const r = resolverMetadata([{ caso: 'f', archivo: f }], {}, { escanear: conClave });
      expect(r.metadata.f.requires.filter((x) => x.tipo === 'puesto')).to.deep.equal([{ tipo: 'puesto', clave: 'Puesto de trabajo', campo: 'nombre' }]);
      const conMeta = resolverMetadata([{ caso: 'f', archivo: f }], { f: { requires: [{ tipo: 'sucursal' }] } }, { escanear: base });
      expect(conMeta.metadata.f.requires.filter((x) => x.tipo === 'sucursal')).to.have.length(1);
      const conLectura = resolverMetadata([{ caso: 'f', archivo: f }], {}, { escanear: (a) => ({ ...base(a), lecturas: ['puesto'] }) });
      expect(conLectura.errores).to.deep.equal([]);
      expect(conLectura.metadata.f.requires.filter((x) => x.tipo === 'puesto')).to.have.length(1);
    });

    it('un selector de la MISMA entidad que el test crea no es una dependencia (y sigue produciéndola)', function () {
      const f = ruta('modA/tests/crear-sucursal.test.js');
      const base = (a) => ({ ...escanearArchivo(a), ...detectarCamposSeleccionables(a, { raiz: dir }) });
      expect(base(f).campos.map((c) => c.tipo)).to.include('sucursal');
      const r = resolverMetadata([{ caso: 'c', archivo: f }], {}, { escanear: base });
      expect(r.metadata.c.requires.map((x) => x.tipo)).to.deep.equal(['puesto']);
      expect(r.metadata.c.produces).to.deep.equal([{ tipo: 'sucursal' }]);
    });

    it('7b. la ambigüedad llega como error de plan, sin dependencia asignada', function () {
      const f = ruta('modC/tests/ambiguo.test.js');
      const r = resolverMetadata([{ caso: 'a', archivo: f }], {}, { escanear: (a) => { const e = escanearArchivo(a); const c = detectarCamposSeleccionables(a, { raiz: dir }); return { ...e, ...c, invalidas: [...e.invalidas, ...c.invalidas] }; } });
      expect(r.errores.join(' ')).to.match(/coincide con varias entidades \[almacen, oficina\]/);
      expect(r.metadata.a.requires).to.equal(undefined);
    });
  });

  describe('escáner real sobre formularios reales de distintos módulos (sin reglas por test)', function () {
    const raiz = path.resolve(__dirname, '..', '..', '..');
    const real = (rel) => path.join(raiz, rel);
    const requiresDe = (rel, caso = 'c') => {
      const r = resolverMetadata([{ caso, archivo: real(rel) }], {});
      return { r, tipos: (r.metadata[caso].requires || []).map((x) => x.tipo), produces: r.metadata[caso].produces.map((p) => p.tipo) };
    };

    it('Reclutamiento: crear-req-creacion exige puesto, sucursal, departamento y horario y sigue produciendo requisicion', function () {
      const { r, tipos, produces } = requiresDe('reclutamiento/tests/crear-req-creacion.test.js');
      expect(r.errores).to.deep.equal([]);
      expect(tipos).to.include.members(['puesto', 'sucursal', 'departamento', 'horario']);
      expect(tipos).to.not.include('solicitud'); // "Razón de solicitud" no es la entidad solicitud
      expect(produces).to.deep.equal(['requisicion']);
    });

    it('Configuración: crear-beneficio y crear-comportamiento-concepto-nomina', function () {
      expect(requiresDe('configuracion/tests/crear-beneficio.test.js').tipos).to.include('concepto-nomina');
      expect(requiresDe('configuracion/tests/crear-comportamiento-concepto-nomina.test.js').tipos).to.include('tipo-nomina');
    });

    it('Empleados: agregar-beneficio solo exige empleado (su selector "Beneficio" declara sinRequires)', function () {
      const { tipos } = requiresDe('empleados/tests/agregar-beneficio.test.js');
      expect(tipos).to.include('empleado');
      expect(tipos).to.not.include('beneficio');
    });

    it('Empleados: crear-dependiente exige plan-de-seguro', function () {
      expect(requiresDe('empleados/tests/crear-dependiente.test.js').tipos).to.include('plan-de-seguro');
    });

    it('lo que ya se detectaba no cambia: crear-solicitud-empleo conserva requisicion por clave', function () {
      const { r } = requiresDe('reclutamiento/tests/crear-solicitud-empleo.test.js');
      expect(r.metadata.c.requires).to.deep.include({ tipo: 'requisicion', clave: 'Requisición', campo: 'nombre' });
      expect(r.metadata.c.requires.map((x) => x.tipo)).to.include('grado-academico');
    });

    it('no introduce ciclos: crear-req-creacion y crear-solicitud-empleo se planifican juntos', function () {
      const sel = [
        { caso: 'crear-req-creacion', archivo: real('reclutamiento/tests/crear-req-creacion.test.js') },
        { caso: 'crear-solicitud-empleo', archivo: real('reclutamiento/tests/crear-solicitud-empleo.test.js') },
      ];
      const m = resolverMetadata(sel, {});
      const plan = planificar(sel, m.metadata);
      expect(plan.errores).to.deep.equal([]);
      expect(plan.orden.map((o) => o.caso)).to.deep.equal(['crear-req-creacion', 'crear-solicitud-empleo']);
    });
  });
});
