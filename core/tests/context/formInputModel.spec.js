const { expect } = require('chai');
const formInputModel = require('../../context/formInputModel');

/**
 * INPUT MODEL de formularios.
 *
 * Deriva los parámetros de un formulario desde el mapa `control -> estrategia`
 * del Page Object (la única fuente de verdad). La promesa que se prueba: los
 * parámetros usan los LABELS REALES, en el orden declarado, sin inventar ni
 * omitir controles; y el criterio de "vacío" coincide con el del Execution
 * Context (para que la prioridad valor-provisto sea consistente en todo el flujo).
 */
describe('formInputModel / Input Model de formularios (unitario)', function () {
  // Mapa representativo: strings y objetos con opciones, como el real del módulo.
  const CONTROLES = {
    'Razón de solicitud': 'directSelect',
    'Persona(s) a sustituir': { estrategia: 'searchAndSelect', multiple: true },
    Puesto: 'searchAndSelect',
    'Nombre de requisición': 'text',
    Rotativo: 'switch',
  };

  describe('labels', function () {
    it('devuelve los labels REALES de los controles, en el orden declarado', function () {
      expect(formInputModel.labels(CONTROLES)).to.deep.equal([
        'Razón de solicitud',
        'Persona(s) a sustituir',
        'Puesto',
        'Nombre de requisición',
        'Rotativo',
      ]);
    });

    it('no inventa, traduce ni omite controles (una clave por control)', function () {
      expect(formInputModel.labels(CONTROLES)).to.have.lengthOf(Object.keys(CONTROLES).length);
    });

    it('tolera un mapa vacío o ausente', function () {
      expect(formInputModel.labels({})).to.deep.equal([]);
      expect(formInputModel.labels()).to.deep.equal([]);
    });
  });

  describe('desdeControles', function () {
    it('normaliza tanto el string como el objeto a { label, estrategia, opciones }', function () {
      const modelo = formInputModel.desdeControles(CONTROLES);

      expect(modelo[0]).to.deep.equal({ label: 'Razón de solicitud', estrategia: 'directSelect', opciones: {} });
      expect(modelo[1]).to.deep.equal({
        label: 'Persona(s) a sustituir',
        estrategia: 'searchAndSelect',
        opciones: { multiple: true },
      });
      expect(modelo[4]).to.deep.equal({ label: 'Rotativo', estrategia: 'switch', opciones: {} });
    });

    it('preserva el orden declarado (importa para dependencias entre campos)', function () {
      expect(formInputModel.desdeControles(CONTROLES).map((c) => c.label)).to.deep.equal(
        formInputModel.labels(CONTROLES)
      );
    });
  });

  describe('comparar (sincronización mapa ↔ UI)', function () {
    it('marca como sincronizado cuando la UI no tiene controles fuera del mapa', function () {
      const diag = formInputModel.comparar(['Puesto', 'Sucursal'], ['Puesto', 'Sucursal']);

      expect(diag.sincronizado).to.equal(true);
      expect(diag.faltantesEnEstrategias).to.deep.equal([]);
      expect(diag.declaradosNoVistos).to.deep.equal([]);
    });

    it('detecta controles VISIBLES que el mapa no declara', function () {
      const diag = formInputModel.comparar(['Puesto'], ['Puesto', 'Compañía', 'Moneda']);

      expect(diag.faltantesEnEstrategias).to.deep.equal(['Compañía', 'Moneda']);
      expect(diag.sincronizado).to.equal(false);
    });

    it('reporta declarados no visibles sin considerarlo desincronización', function () {
      const diag = formInputModel.comparar(['Puesto', 'Persona(s) a sustituir'], ['Puesto']);

      expect(diag.declaradosNoVistos).to.deep.equal(['Persona(s) a sustituir']);
      expect(diag.faltantesEnEstrategias).to.deep.equal([]);
      expect(diag.sincronizado).to.equal(true); // no hay controles en pantalla fuera del mapa
    });

    it('normaliza el asterisco de requerido y el ":" final antes de comparar', function () {
      const diag = formInputModel.comparar(['Puesto', 'Nombre de requisición'], ['Puesto:', 'Nombre de requisición*']);

      expect(diag.sincronizado).to.equal(true);
      expect(diag.faltantesEnEstrategias).to.deep.equal([]);
    });

    it('tolera listas vacías o ausentes', function () {
      expect(formInputModel.comparar().sincronizado).to.equal(true);
      expect(formInputModel.comparar([], []).enPantalla).to.deep.equal([]);
    });
  });

  describe('esVacio (mismo criterio que el Execution Context)', function () {
    it('considera vacío el string vacío/espacios, null, undefined y el array vacío', function () {
      ['', '   ', null, undefined, []].forEach((v) => expect(formInputModel.esVacio(v), JSON.stringify(v)).to.equal(true));
    });

    it('considera NO vacío un texto, un cero y un false', function () {
      ['ADMIN', 0, false, ['x']].forEach((v) => expect(formInputModel.esVacio(v), JSON.stringify(v)).to.equal(false));
    });
  });
});
