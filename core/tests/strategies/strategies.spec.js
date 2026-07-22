const { expect } = require('chai');
const strategies = require('../../strategies');
const SelectionStrategy = require('../../strategies/SelectionStrategy');

/**
 * Selection Strategies.
 *
 * Una estrategia sabe CÓMO se le pone un valor a un tipo de control, componiendo
 * las primitivas del componente Form. Como reciben el `form` por parámetro, se
 * prueban con un Form simulado: sin navegador, sin app.
 *
 * El comportamiento clave es la relación con el Execution Context:
 *   - si el dato viene definido -> se usa ese valor;
 *   - si viene vacío -> se cae al comportamiento automático de siempre
 *     (elegir la primera opción válida), que es lo que mantiene verdes los
 *     casos que no dirigen sus datos.
 */

/** Form simulado: registra qué primitiva se invocó y con qué argumentos. */
function formSimulado({ textoItem = 'Opción Real' } = {}) {
  const llamadas = [];
  const registrar = (nombre) => (...args) => {
    llamadas.push({ nombre, args });
    return undefined;
  };
  const elemento = {
    getText: async () => `  ${textoItem}  `,
    click: async () => llamadas.push({ nombre: 'click', args: [] }),
    sendKeys: async (...args) => llamadas.push({ nombre: 'sendKeys', args }),
  };

  return {
    llamadas,
    nombres: () => llamadas.map((l) => l.nombre),
    seleccionarPrimera: async (label) => {
      llamadas.push({ nombre: 'seleccionarPrimera', args: [label] });
      return 'PRIMERA-OPCION';
    },
    seleccionar: async (...args) => registrar('seleccionar')(...args),
    seleccionarPrimerTag: async (label) => {
      llamadas.push({ nombre: 'seleccionarPrimerTag', args: [label] });
      return 'PRIMER-TAG';
    },
    seleccionarTagPorTexto: async (...args) => registrar('seleccionarTagPorTexto')(...args),
    escribir: async (...args) => registrar('escribir')(...args),
    setSwitch: async (...args) => registrar('setSwitch')(...args),
    _abrirDropdown: async (...args) => registrar('_abrirDropdown')(...args),
    _inputBusqueda: async () => elemento,
    _itemVisiblePorTexto: async (...args) => {
      llamadas.push({ nombre: '_itemVisiblePorTexto', args });
      return elemento;
    },
    _esperarOverlayCerrado: async () => registrar('_esperarOverlayCerrado')(),
    driver: {
      actions: () => ({
        sendKeys: () => ({ perform: async () => llamadas.push({ nombre: 'escape', args: [] }) }),
      }),
    },
  };
}

const SIN_DATO = [undefined, null, ''];

describe('Selection Strategies (unitario)', function () {
  describe('registro (Open/Closed)', function () {
    it('trae registradas las estrategias de fábrica que usan los Page Objects', function () {
      expect(strategies.listar()).to.include.members([
        'firstOption', 'directSelect', 'searchAndSelect', 'tagSelect',
        'text', 'switch', 'datePicker', 'treeView', 'custom',
      ]);
    });

    it('la estrategia por defecto es la del comportamiento histórico', function () {
      expect(strategies.POR_DEFECTO).to.equal('firstOption');
      expect(strategies.existe(strategies.POR_DEFECTO)).to.equal(true);
    });

    it('permite registrar una estrategia nueva sin tocar las existentes', function () {
      class MiEstrategia extends SelectionStrategy {
        async aplicar() {
          return 'aplicada';
        }
      }
      const cantidadPrevia = strategies.listar().length;
      strategies.registrar('unitTestStrategy', new MiEstrategia());

      expect(strategies.existe('unitTestStrategy')).to.equal(true);
      expect(strategies.listar()).to.have.lengthOf(cantidadPrevia + 1);
      expect(strategies.obtener('firstOption')).to.be.instanceOf(strategies.FirstOptionStrategy);
    });

    it('rechaza registrar algo que no cumple el contrato', function () {
      expect(() => strategies.registrar('rota', { aplicar: () => {} })).to.throw(/debe extender SelectionStrategy/);
    });

    it('al pedir una estrategia inexistente, informa cuáles hay', function () {
      expect(() => strategies.obtener('noExiste')).to.throw(/Estrategia de selección desconocida: "noExiste"/);
      expect(() => strategies.obtener('noExiste')).to.throw(/firstOption/);
    });

    it('acepta una instancia ya construida y la devuelve tal cual', function () {
      const instancia = new strategies.TextInputStrategy();

      expect(strategies.obtener(instancia)).to.equal(instancia);
    });

    it('el contrato base obliga a implementar aplicar()', async function () {
      let error = null;
      try {
        await new SelectionStrategy().aplicar({}, 'Campo', 'valor');
      } catch (err) {
        error = err;
      }

      expect(error).to.not.equal(null);
      expect(error.message).to.contain('no implementa aplicar()');
    });
  });

  describe('valor del Execution Context vs. descubrimiento automático', function () {
    it('directSelect usa el valor cuando el contexto lo define', async function () {
      const form = formSimulado();
      const aplicado = await strategies.obtener('directSelect').aplicar(form, 'Razón de solicitud', 'Sustitución');

      expect(form.nombres()).to.deep.equal(['seleccionar']);
      expect(form.llamadas[0].args).to.deep.equal(['Razón de solicitud', 'Sustitución']);
      expect(aplicado).to.equal('Sustitución');
    });

    SIN_DATO.forEach((vacio) => {
      it(`directSelect cae en la primera opción cuando el dato es ${JSON.stringify(vacio)}`, async function () {
        const form = formSimulado();
        const aplicado = await strategies.obtener('directSelect').aplicar(form, 'Razón de solicitud', vacio);

        expect(form.nombres()).to.deep.equal(['seleccionarPrimera']);
        expect(aplicado).to.equal('PRIMERA-OPCION');
      });
    });

    it('searchAndSelect hace los 4 pasos y devuelve el texto REAL del item elegido', async function () {
      const form = formSimulado({ textoItem: 'ADMINISTRADOR' });
      const aplicado = await strategies.obtener('searchAndSelect').aplicar(form, 'Puesto', 'ADMIN');

      expect(form.nombres()).to.deep.equal([
        '_abrirDropdown', 'sendKeys', '_itemVisiblePorTexto', 'click', '_esperarOverlayCerrado',
      ]);
      // el valor efectivo es el de la app, no el que se tipeó
      expect(aplicado).to.equal('ADMINISTRADOR');
    });

    it('searchAndSelect cierra el overlay con Escape en los controles múltiples (tagbox)', async function () {
      const form = formSimulado();
      await strategies.obtener('searchAndSelect').aplicar(form, 'Persona(s) a sustituir', 'Hugo', { multiple: true });

      expect(form.nombres()).to.include('escape');
    });

    it('searchAndSelect sin dato no abre nada: descubre la primera opción', async function () {
      const form = formSimulado();
      const aplicado = await strategies.obtener('searchAndSelect').aplicar(form, 'Puesto', '');

      expect(form.nombres()).to.deep.equal(['seleccionarPrimera']);
      expect(aplicado).to.equal('PRIMERA-OPCION');
    });

    it('tagSelect elige por texto con dato, y el primer tag sin dato', async function () {
      const conDato = formSimulado();
      const sinDato = formSimulado();

      await strategies.obtener('tagSelect').aplicar(conDato, 'Etiquetas', 'Urgente');
      const auto = await strategies.obtener('tagSelect').aplicar(sinDato, 'Etiquetas', '');

      expect(conDato.nombres()).to.deep.equal(['seleccionarTagPorTexto']);
      expect(sinDato.nombres()).to.deep.equal(['seleccionarPrimerTag']);
      expect(auto).to.equal('PRIMER-TAG');
    });

    it('treeView busca el nodo por texto y devuelve el texto real del nodo', async function () {
      const form = formSimulado({ textoItem: 'Recursos Humanos' });
      const aplicado = await strategies.obtener('treeView').aplicar(form, 'Departamento', 'Recursos');

      expect(form.nombres()).to.include('_abrirDropdown');
      expect(form.llamadas.find((l) => l.nombre === '_itemVisiblePorTexto').args[1]).to.contain('treeview');
      expect(aplicado).to.equal('Recursos Humanos');
    });
  });

  describe('controles de entrada directa', function () {
    it('text escribe el valor convertido a string', async function () {
      const form = formSimulado();
      await strategies.obtener('text').aplicar(form, 'Descripción', 12345);

      expect(form.llamadas[0]).to.deep.include({ nombre: 'escribir' });
      expect(form.llamadas[0].args).to.deep.equal(['Descripción', '12345']);
    });

    it('text no toca el campo si no hay valor (no borra lo que ya estaba)', async function () {
      const form = formSimulado();
      const aplicado = await strategies.obtener('text').aplicar(form, 'Descripción', undefined);

      expect(form.llamadas).to.be.empty;
      expect(aplicado).to.equal(undefined);
    });

    it('text SÍ escribe una cadena vacía si eso es lo que se pide explícitamente', async function () {
      const form = formSimulado();
      await strategies.obtener('text').aplicar(form, 'Descripción', '');

      expect(form.llamadas[0].args).to.deep.equal(['Descripción', '']);
    });

    it('datePicker escribe la fecha y la ignora si viene vacía', async function () {
      const conFecha = formSimulado();
      const sinFecha = formSimulado();

      await strategies.obtener('datePicker').aplicar(conFecha, 'Fecha', '01/01/2026');
      await strategies.obtener('datePicker').aplicar(sinFecha, 'Fecha', '');

      expect(conFecha.llamadas[0].args).to.deep.equal(['Fecha', '01/01/2026']);
      expect(sinFecha.llamadas).to.be.empty;
    });
  });

  describe('switch', function () {
    const enciende = [true, 'true', 'si', 'sí', '1', 'on', 'ON', 'Sí'];
    const apaga = [false, 'false', 'no', '0', 'off', '', undefined, null];

    enciende.forEach((valor) => {
      it(`enciende con ${JSON.stringify(valor)}`, async function () {
        const form = formSimulado();
        const aplicado = await strategies.obtener('switch').aplicar(form, 'Rotativo', valor);

        expect(form.llamadas[0].args).to.deep.equal(['Rotativo', true]);
        expect(aplicado).to.equal(true);
      });
    });

    apaga.forEach((valor) => {
      it(`apaga con ${JSON.stringify(valor)}`, async function () {
        const form = formSimulado();
        const aplicado = await strategies.obtener('switch').aplicar(form, 'Rotativo', valor);

        expect(form.llamadas[0].args).to.deep.equal(['Rotativo', false]);
        expect(aplicado).to.equal(false);
      });
    });
  });

  describe('custom (escape hatch)', function () {
    it('delega en la función provista por el Page Object', async function () {
      const form = formSimulado();
      const recibido = [];
      const aplicado = await strategies.obtener('custom').aplicar(form, 'Campo raro', 'valor', {
        fn: async (f, label, valor) => {
          recibido.push({ label, valor });
          return 'hecho a medida';
        },
      });

      expect(recibido).to.deep.equal([{ label: 'Campo raro', valor: 'valor' }]);
      expect(aplicado).to.equal('hecho a medida');
    });

    it('exige la función y lo dice claro si falta', async function () {
      let error = null;
      try {
        await strategies.obtener('custom').aplicar(formSimulado(), 'Campo raro', 'valor', {});
      } catch (err) {
        error = err;
      }

      expect(error).to.not.equal(null);
      expect(error.message).to.contain('requiere opciones.fn');
      expect(error.message).to.contain('Campo raro');
    });
  });
});
