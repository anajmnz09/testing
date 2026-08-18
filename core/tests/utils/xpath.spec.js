const { expect } = require('chai');
const { containsTextoIgnoreCase } = require('../../utils/xpath');

/**
 * containsTextoIgnoreCase — fragmento XPath 1.0 case-insensitive usado para
 * localizar filas/campos por texto renderizado por la app (ver SKILL.md,
 * "Text comparisons must be case-insensitive"). XPath 1.0 no tiene
 * `contains()` case-insensitive nativo: el fragmento debe usar `translate()`
 * con dos strings (mayúsculas/minúsculas) de igual longitud y posición, o el
 * mapeo queda roto silenciosamente — eso es lo que se prueba acá.
 */
describe('utils/xpath — containsTextoIgnoreCase (unitario)', function () {
  it('pliega el valor buscado a minúscula y lo deja como literal XPath', function () {
    expect(containsTextoIgnoreCase('POPULAR')).to.include("'popular'");
  });

  it('recorta espacios al borde del valor buscado', function () {
    expect(containsTextoIgnoreCase('  Popular  ')).to.include("'popular'");
  });

  it('envuelve el lado del DOM en translate(normalize-space(...), MAYUS, MINUS)', function () {
    const condicion = containsTextoIgnoreCase('popular');
    expect(condicion).to.match(/^contains\(translate\(normalize-space\(\.\), '[A-ZÑÁÉÍÓÚÜ]+', '[a-zñáéíóúü]+'\), 'popular'\)$/);
  });

  it('usa "." como expresión de contexto por defecto', function () {
    expect(containsTextoIgnoreCase('popular')).to.include('normalize-space(.)');
  });

  it('acepta una expresión XPath distinta al nodo de contexto (ej. "text()")', function () {
    expect(containsTextoIgnoreCase('popular', 'text()')).to.include('normalize-space(text())');
  });

  it('los strings MAYÚSCULA/minúscula de translate() tienen la misma longitud (mapeo posicional correcto)', function () {
    const condicion = containsTextoIgnoreCase('x');
    const [, mayus, minus] = condicion.match(/translate\([^,]+, '([^']+)', '([^']+)'\)/);
    expect(mayus.length).to.equal(minus.length);
  });
});
