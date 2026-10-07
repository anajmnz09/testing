const { expect } = require('chai');
const { definirBanco, _fijarSemilla } = require('../../utils/bancoDatos');

describe('utils/bancoDatos — bancos de texto deterministas (unitario)', function () {
  const nuevo = () =>
    definirBanco('prueba', {
      categorias: { tipo: ['Liceo', 'Escuela', 'Instituto'], nombre: ['Duarte', 'Luperón'] },
      textos: { lugar: '{tipo} {nombre}', solo: '{nombre}' },
    });

  beforeEach(() => _fijarSemilla(0));
  after(() => _fijarSemilla(null));

  it('recorre TODAS las combinaciones (A1×B1, A2×B1, ...) sin escribirlas a mano, y luego se repite', function () {
    const b = nuevo();
    const vistos = Array.from({ length: b.total('lugar') }, () => b.texto('lugar'));
    expect(b.total('lugar')).to.equal(6);
    expect(new Set(vistos).size).to.equal(6);
    expect(vistos[0]).to.equal('Liceo Duarte');
    expect(vistos[1]).to.equal('Escuela Duarte');
    expect(vistos[3]).to.equal('Liceo Luperón');
    expect(b.texto('lugar')).to.equal(vistos[0]);
  });

  it('es determinista: misma semilla y mismo orden de llamadas = mismos datos; otra semilla = otro arranque', function () {
    _fijarSemilla(4);
    const a = [nuevo().texto('lugar'), nuevo().texto('solo')];
    _fijarSemilla(4);
    const b = [nuevo().texto('lugar'), nuevo().texto('solo')];
    _fijarSemilla(5);
    const c = nuevo().texto('lugar');
    expect(a).to.deep.equal(b);
    expect(c).to.not.equal(a[0]);
  });

  it('cada texto lleva su propio cursor (pedir uno no desplaza a los otros)', function () {
    const b = nuevo();
    b.texto('lugar');
    b.texto('lugar');
    expect(b.texto('solo')).to.equal('Duarte');
  });

  it('valor(): lo dirigido manda (también con espacios = vacío) y no consume el banco', function () {
    const b = nuevo();
    expect(b.valor('Mi Colegio', 'lugar')).to.equal('Mi Colegio');
    expect(b.valor('  ', 'lugar')).to.equal('Liceo Duarte');
    expect(b.valor(undefined, 'lugar')).to.equal('Escuela Duarte');
  });

  it('DATOS_SEMILLA fija la semilla (numérica o texto) y queda registrada', function () {
    const previo = process.env.DATOS_SEMILLA;
    try {
      _fijarSemilla(null);
      process.env.DATOS_SEMILLA = '3';
      expect(require('../../utils/bancoDatos').semilla()).to.equal(3);
      _fijarSemilla(null);
      process.env.DATOS_SEMILLA = 'falla-123';
      const s = require('../../utils/bancoDatos').semilla();
      _fijarSemilla(null);
      expect(require('../../utils/bancoDatos').semilla()).to.equal(s); // el mismo texto da la misma semilla
    } finally {
      if (previo === undefined) delete process.env.DATOS_SEMILLA;
      else process.env.DATOS_SEMILLA = previo;
    }
  });

  it('rechaza bancos mal definidos (categoría vacía/repetida, texto con categoría inexistente, clave desconocida)', function () {
    expect(() => definirBanco('x', { categorias: { a: [] } })).to.throw(/lista no vacía/);
    expect(() => definirBanco('x', { categorias: { a: ['1', '1'] } })).to.throw(/repetidas/);
    expect(() => definirBanco('x', { categorias: { a: ['1'] }, textos: { t: '{b}' } })).to.throw(/no es una categoría/);
    expect(() => nuevo().texto('nada')).to.throw(/no existe el texto/);
  });
});
