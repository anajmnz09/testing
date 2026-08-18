const { expect } = require('chai');
const assert = require('assert');
const { assertTextoIgual } = require('../../utils/assert');

/**
 * assertTextoIgual — comparación de texto renderizado por la app, siempre
 * case-insensitive (ver SKILL.md, "Text comparisons must be case-insensitive").
 */
describe('utils/assert — assertTextoIgual (unitario)', function () {
  describe('coincidencias case-insensitive', function () {
    it('acepta distinto case ("Inactivo" vs "inactivo")', function () {
      expect(() => assertTextoIgual('Inactivo', 'inactivo')).to.not.throw();
    });

    it('acepta TODO mayúsculas contra minúsculas', function () {
      expect(() => assertTextoIgual('INACTIVO', 'inactivo')).to.not.throw();
    });

    it('acepta case mixto', function () {
      expect(() => assertTextoIgual('InAcTiVo', 'inactivo')).to.not.throw();
    });

    it('ignora espacios al borde (trim) en ambos lados', function () {
      expect(() => assertTextoIgual('  Activo ', 'activo')).to.not.throw();
      expect(() => assertTextoIgual('Activo', '  activo  ')).to.not.throw();
    });

    it('acepta el mismo valor exacto', function () {
      expect(() => assertTextoIgual('Activo', 'Activo')).to.not.throw();
    });
  });

  describe('mantiene el comportamiento de una aserción real', function () {
    it('lanza AssertionError cuando el texto realmente difiere', function () {
      expect(() => assertTextoIgual('Activo', 'Inactivo')).to.throw(assert.AssertionError);
    });

    it('usa el mensaje provisto en el error', function () {
      expect(() => assertTextoIgual('Activo', 'Inactivo', 'mensaje de prueba')).to.throw('mensaje de prueba');
    });

    it('provee un mensaje por defecto si no se pasa uno', function () {
      expect(() => assertTextoIgual('Activo', 'Inactivo')).to.throw(/Inactivo/);
    });
  });

  describe('no convierte otros tipos a texto', function () {
    it('lanza TypeError si "actual" no es string (ej. number)', function () {
      expect(() => assertTextoIgual(45000, '45000')).to.throw(TypeError);
    });

    it('lanza TypeError si "esperado" no es string (ej. boolean)', function () {
      expect(() => assertTextoIgual('true', true)).to.throw(TypeError);
    });

    it('lanza TypeError con null/undefined en vez de compararlos como texto', function () {
      expect(() => assertTextoIgual(null, 'algo')).to.throw(TypeError);
      expect(() => assertTextoIgual('algo', undefined)).to.throw(TypeError);
    });
  });
});
