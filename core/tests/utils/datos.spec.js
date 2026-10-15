const fs = require('fs');
const os = require('os');
const path = require('path');
const { expect } = require('chai');
const datos = require('../../utils/datos');
const bancoDatos = require('../../utils/bancoDatos');
const datosPrueba = require('../../utils/datosPrueba');
const Form = require('../../components/Form');
const { leerControles } = require('../../utils/flowCampos');

/**
 * Punto de acceso común a los datos de prueba (`core/utils/datos.js`): resuelve la fuente de cada campo (banco del módulo,
 * persona, requisición, texto, código), respeta lo dirigido y es reproducible por semilla.
 */
describe('utils/datos — acceso común a datos de prueba (unitario)', function () {
  let raiz;
  const nombreBanco = 'tmpmod';

  before(function () {
    raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'triple-datos-'));
    ctx.raiz = raiz;
    fs.mkdirSync(path.join(raiz, 'modX', 'support'), { recursive: true });
    fs.writeFileSync(
      path.join(raiz, 'modX', 'support', 'bancos.js'),
      `const { definirBanco } = require(${JSON.stringify(path.resolve(__dirname, '../../utils/bancoDatos'))});
module.exports = {
  tmpmod: definirBanco('${nombreBanco}', {
    categorias: { tipo: ['Liceo', 'Instituto', 'Colegio'], nombre: ['Duarte', 'Luperón'] },
    textos: { lugar: '{tipo} {nombre}', solo: '{nombre}' },
  }),
};
`
    );
  });
  after(function () {
    fs.rmSync(raiz, { recursive: true, force: true });
    bancoDatos._fijarSemilla(null);
  });
  beforeEach(function () {
    bancoDatos._fijarSemilla(0);
  });

  const ctx = {}; // { raiz } se completa en before()

  describe('bancos del módulo', function () {
    it('1. resuelve texto libre desde el banco del módulo SIN que el test lo importe (descubrimiento por <modulo>/support/bancos.js)', function () {
      expect(bancoDatos.obtenerBanco(nombreBanco)).to.equal(undefined);
      expect(datos.resolver(`${nombreBanco}.lugar`, ctx)).to.equal('Liceo Duarte');
      expect(bancoDatos.obtenerBanco(nombreBanco)).to.be.an('object');
    });

    it('2. combina categorías y varía: recorre todas las combinaciones del texto', function () {
      const vistos = new Set();
      for (let i = 0; i < 6; i += 1) vistos.add(datos.resolver(`${nombreBanco}.lugar`, ctx));
      expect(vistos.size).to.equal(6); // 3 tipos x 2 nombres
    });

    it('un banco inexistente o una familia reservada fallan con un mensaje claro', function () {
      expect(() => datos.resolver('noexiste.algo', ctx)).to.throw(/no existe el banco "noexiste"/);
      expect(() => bancoDatos.definirBanco('persona', { categorias: { a: ['x'] }, textos: {} })).to.throw(/familia reservada/);
      expect(() => datos.resolver('malformada', ctx)).to.throw(/fuente inválida/);
    });
  });

  describe('datos personales y estructurados (generador especializado)', function () {
    it('3. persona.*: formatos válidos y campos coherentes entre sí', function () {
      datos.nuevaPersona();
      const nombre = datos.resolver('persona.primerNombre');
      const apellido = datos.resolver('persona.primerApellido');
      const correo = datos.resolver('persona.correo');
      expect(correo).to.match(/^[a-z]+\.[a-z]+\.[a-z0-9]+@camsoft\.test$/);
      expect(correo.startsWith(datosPrueba.slug(nombre))).to.equal(true);
      expect(correo.split('.')[1]).to.equal(datosPrueba.slug(apellido));
      expect(datos.resolver('persona.identificacion')).to.match(/^\d{11}$/);
      expect(datos.resolver('persona.celular')).to.match(/^\d{10}$/);
    });

    it('pedir otra vez un campo ya usado empieza otra persona; persona desconocida falla', function () {
      datos.nuevaPersona();
      const identicos = new Set();
      for (let i = 0; i < 5; i += 1) identicos.add([datos.resolver('persona.primerNombre'), datos.resolver('persona.segundoApellido')].join('|'));
      expect(identicos.size).to.be.greaterThan(1);
      expect(() => datos.resolver('persona.altura')).to.throw(/no existe/);
    });

    it('requisicion.nombre incluye el puesto, respeta el largo y texto.* menciona el puesto', function () {
      const n = datos.resolver('requisicion.nombre', { puesto: 'Analista de Nómina' });
      expect(n).to.include('Analista');
      expect(n.length).to.be.at.most(45);
      expect(datos.resolver('texto.requisitos', { puesto: 'Contador' })).to.include('Contador');
      expect(() => datos.resolver('texto.otro')).to.throw(/no existe/);
    });
  });

  describe('unicidad', function () {
    it('4. { unico: true } agrega un sufijo distinto en cada llamada; unicoQA conserva lo dirigido TAL CUAL', function () {
      const a = datos.resolver({ fuente: `${nombreBanco}.solo`, unico: true }, ctx);
      const b = datos.resolver({ fuente: `${nombreBanco}.solo`, unico: true }, ctx);
      expect(a).to.match(/^(Duarte|Luperón) \d{6}$/);
      expect(a.split(' ')[1]).to.not.equal(b.split(' ')[1]);
      expect(datos.unicoQA('Banco Popular', 'Banco QA')).to.equal('Banco Popular');
      expect(datos.unicoQA('', 'Banco QA')).to.match(/^Banco QA \d{6}$/);
      const seguidos = new Set(Array.from({ length: 50 }, () => datos.unico('X')));
      expect(seguidos.size).to.equal(50);
    });

    it('codigo(n): alfanumérico en mayúsculas del largo pedido', function () {
      for (let i = 0; i < 20; i += 1) expect(datos.codigo(3)).to.match(/^[0-9A-Z]{3}$/);
    });
  });

  describe('prioridad de los valores', function () {
    it('5. lo dirigido (Panel / Execution Context) gana, también con espacios = vacío, y no consume el banco', function () {
      expect(datos.valor('Escuela Hostos', `${nombreBanco}.lugar`, ctx)).to.equal('Escuela Hostos');
      const primero = datos.valor('   ', `${nombreBanco}.lugar`, ctx);
      bancoDatos._fijarSemilla(0);
      const fresco = bancoDatos.definirBanco('tmpmod2', { categorias: { t: ['a', 'b'] }, textos: { x: '{t}' } });
      datos.valor('dirigido', 'tmpmod2.x');
      expect(fresco.texto('x')).to.equal('a'); // el dirigido no avanzó el cursor
      expect(primero).to.be.a('string');
    });

    it('6. deFormulario: solo genera lo que declara `dato`; lo dirigido y los controles sin `dato` (valores del escenario) se conservan', function () {
      const ESTRATEGIAS = {
        Nombre: 'text',
        Lugar: { estrategia: 'text', dato: `${nombreBanco}.lugar` },
        Detalle: { estrategia: 'text', dato: `${nombreBanco}.solo` },
        Estado: 'directSelect',
      };
      const dirigidos = { Detalle: 'Detalle del Panel' };
      const r = datos.deFormulario('caso', ESTRATEGIAS, { contexto: ctx, obtener: (c, l) => dirigidos[l] });
      expect(Object.keys(r)).to.deep.equal(['Lugar', 'Detalle']); // Nombre (escenario) y Estado no se tocan
      expect(r.Detalle).to.equal('Detalle del Panel');
      expect(r.Lugar).to.match(/^(Liceo|Instituto|Colegio) (Duarte|Luperón)$/);
    });

    it('7. un valor producido por un paso anterior del flujo llega por el mismo contexto y se conserva', function () {
      const r = datos.deFormulario('caso', { Nombre: { estrategia: 'text', dato: { fuente: `${nombreBanco}.solo`, unico: true } } }, {
        contexto: ctx,
        obtener: () => 'Requisición creada por el paso anterior',
      });
      expect(r.Nombre).to.equal('Requisición creada por el paso anterior'); // sin sufijo
    });

    it('`dato` solo aplica a controles de texto', function () {
      expect(() => datos.deFormulario('c', { Sel: { estrategia: 'searchAndSelect', dato: 'x.y' } }, { obtener: () => undefined })).to.throw(/solo aplica a campos de texto/);
    });

    it('Form.completarDesde con autofill resuelve `dato`; sin autofill no toca el campo; el valor dirigido manda', async function () {
      const llamadas = [];
      const falso = { setValor: async (label, valor) => { llamadas.push([label, valor]); return valor; } };
      const controles = { Lugar: { estrategia: 'text', dato: `${nombreBanco}.lugar` }, Otro: 'text' };
      await Form.prototype.completarDesde.call(falso, controles, {}, { autofill: false });
      expect(llamadas).to.deep.equal([]);
      await Form.prototype.completarDesde.call(falso, controles, {}, { autofill: true });
      expect(llamadas[0][0]).to.equal('Lugar');
      expect(llamadas[0][1]).to.match(/^(Liceo|Instituto|Colegio) (Duarte|Luperón)$/);
      expect(llamadas[1]).to.deep.equal(['Otro', undefined]); // sin `dato`: comportamiento anterior
      llamadas.length = 0;
      await Form.prototype.completarDesde.call(falso, controles, { Lugar: 'Dirigido' }, { autofill: true });
      expect(llamadas[0]).to.deep.equal(['Lugar', 'Dirigido']);
    });
  });

  describe('reproducibilidad', function () {
    it('8. misma semilla + mismo orden = mismos datos; otra semilla = otros', function () {
      const generar = (semilla) => {
        bancoDatos._fijarSemilla(semilla);
        const g = datosPrueba.crear();
        const p = g.personaUnica();
        return [p.primerNombre, p.segundoNombre, p.primerApellido, p.segundoApellido, g.texto('descripcion', { puesto: 'Contador' })].join('|');
      };
      expect(generar(11)).to.equal(generar(11));
      expect(generar(11)).to.not.equal(generar(12));
      bancoDatos._fijarSemilla(5);
      const f1 = bancoDatos.prng('x');
      const a = [f1(), f1(), f1()];
      bancoDatos._fijarSemilla(5);
      const f2 = bancoDatos.prng('x');
      expect([f2(), f2(), f2()]).to.deep.equal(a);
      expect(a.every((n) => n >= 0 && n < 1)).to.equal(true);
    });

    it('un banco con la misma semilla repite sus valores', function () {
      const def = () => bancoDatos.definirBanco('tmprepro', { categorias: { t: ['a', 'b', 'c', 'd'] }, textos: { x: '{t}' } });
      bancoDatos._fijarSemilla(3);
      const uno = [def().texto('x'), 0].slice(0, 1);
      bancoDatos._fijarSemilla(3);
      expect(def().texto('x')).to.equal(uno[0]);
    });

    it('9. ningún generador del mecanismo común usa Math.random (se prueba con Math.random bloqueado)', function () {
      const original = Math.random;
      Math.random = () => {
        throw new Error('Math.random no debe usarse en la generación de datos de prueba');
      };
      try {
        bancoDatos._fijarSemilla(21);
        datos.nuevaPersona();
        datos.resolver('persona.primerNombre');
        datos.resolver('persona.correo');
        datos.resolver('persona.identificacion');
        datos.resolver('requisicion.nombre', { puesto: 'Contador' });
        datos.resolver('texto.comentario', { puesto: 'Contador' });
        datos.resolver(`${nombreBanco}.lugar`, ctx);
        datos.codigo(3);
        datos.unico('X');
        datosPrueba.crear().personaUnica();
      } finally {
        Math.random = original;
      }
      for (const f of ['datos.js', 'datosPrueba.js', 'bancoDatos.js']) {
        const codigo = fs.readFileSync(path.join(__dirname, '../../utils', f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        expect(codigo, f).to.not.match(/Math\.random/);
      }
    });
  });

  describe('compatibilidad con consumidores existentes', function () {
    it('10. nombreUnicoQA de Configuración y de Empleados delegan en el mecanismo común con el mismo contrato', function () {
      for (const modulo of ['configuracion', 'empleados']) {
        const { nombreUnicoQA } = require(`../../../${modulo}/support/nombresQA`);
        expect(nombreUnicoQA('Dirigido', 'Base')).to.equal('Dirigido');
        expect(nombreUnicoQA('', 'Base')).to.match(/^Base \d{6}$/);
        expect(nombreUnicoQA(undefined, 'Base')).to.match(/^Base \d{6}$/);
      }
    });

    it('los bancos de los módulos siguen funcionando con su API directa (valor / texto)', function () {
      const bancos = require('../../../configuracion/support/bancos');
      expect(bancos.puesto.valor('Dirigido', 'descripcion')).to.equal('Dirigido');
      expect(bancos.puesto.valor('', 'descripcion')).to.be.a('string').and.not.equal('');
    });

    it('ESTRATEGIAS reales declaran `dato` y se resuelven (Configuración, Empleados, Reclutamiento) con los bancos de cada módulo', function () {
      const sinDirigir = () => undefined;
      const casos = [
        ['configuracion/pages/PuestoDetallePage', ['Descripción', 'Requisitos', 'Responsabilidades']],
        ['configuracion/pages/SucursalDetallePage', ['Dirección']],
        ['configuracion/pages/CuentaContableDetallePage', ['Descripción']],
        ['empleados/pages/CapacitacionFormPage', ['Nombre', 'Descripción', 'Centro', 'Facilitador']],
        ['reclutamiento/pages/SolicitudEmpleoFormPage', ['Comentario']],
      ];
      for (const [rel, labels] of casos) {
        const Page = require(`../../../${rel}`);
        const r = datos.deFormulario('c', Page.ESTRATEGIAS, { obtener: sinDirigir });
        expect(Object.keys(r), rel).to.deep.equal(labels);
        for (const l of labels) expect(r[l], `${rel}.${l}`).to.be.a('string').and.not.equal('');
      }
    });

    it('el escáner de flujos (flowCampos) sigue leyendo ESTRATEGIAS con `dato` (objeto con fuente anidada)', function () {
      const c = leerControles("const ESTRATEGIAS = { Nombre: { estrategia: 'text', dato: { fuente: 'a.b', unico: true } }, Puesto: 'searchAndSelect' };");
      expect(c.map((x) => [x.label, x.estrategia])).to.deep.equal([['Nombre', 'text'], ['Puesto', 'searchAndSelect']]);
    });
  });
});
