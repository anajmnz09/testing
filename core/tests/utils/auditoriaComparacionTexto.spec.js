const { expect } = require('chai');
const { detectarComparacionesCrudas } = require('../../utils/auditoriaComparacionTexto');

/**
 * auditoriaComparacionTexto — detector que respalda
 * `contrato-comparacion-texto-ui.spec.js`. Se prueba en aislamiento con
 * snippets sintéticos (sin tocar archivos reales) para poder afirmar,
 * positivo Y negativo, exactamente qué formas del antipatrón reconoce.
 */
describe('utils/auditoriaComparacionTexto — detectarComparacionesCrudas (unitario)', function () {
  it('detecta un getValor() inline comparado con strictEqual', function () {
    const codigo = `
      assert.strictEqual((await form.getValor('Frecuencia')).trim(), 'Renovación trimestral', 'msg');
    `;
    const v = detectarComparacionesCrudas(codigo, 'x.test.js');
    expect(v).to.have.lengthOf(1);
    expect(v[0].linea).to.equal(2);
  });

  it('detecta una variable cuya última asignación viene de esperarValor()', function () {
    const codigo = `
      const titulo = await banco.getTitulo();
      assert.strictEqual(titulo, 'Banco de candidatos', 'msg');
    `;
    const v = detectarComparacionesCrudas(codigo, 'x.test.js');
    expect(v).to.have.lengthOf(1);
  });

  it('detecta un acceso a fila de grid ("filaFinal[\'Campo\']")', function () {
    const codigo = `
      assert.strictEqual(filaFinal['Descripción'], descripcionNueva, 'msg');
    `;
    const v = detectarComparacionesCrudas(codigo, 'x.test.js');
    expect(v).to.have.lengthOf(1);
  });

  it('detecta assert.equal (no solo strictEqual)', function () {
    const codigo = `
      const nombre = await pagina.getNombre();
      assert.equal(nombre, 'ANALISTA', 'msg');
    `;
    const v = detectarComparacionesCrudas(codigo, 'x.test.js');
    expect(v).to.have.lengthOf(1);
  });

  it('NO detecta una comparación numérica (parseFloat/length/contadores)', function () {
    const codigo = `
      assert.strictEqual(parseFloat(String(valorSalario).replace(/,/g, '')), parseFloat(String(ultimoSalario).replace(/,/g, '')), 'msg');
      assert.strictEqual(resumen.filter((r) => r.exito).length, clasificaciones.length, 'msg2');
      assert.strictEqual(docsDespues, docsAntes + 1, 'msg3');
    `;
    const v = detectarComparacionesCrudas(codigo, 'x.test.js');
    expect(v).to.be.empty;
  });

  it('NO detecta una comparación booleana (isDisplayed/switches/interruptores)', function () {
    const codigo = `
      assert.strictEqual(await loginPage.isDisplayed(), true);
      assert.strictEqual(estadoFinal, true, '"Es administrador" no quedó activado');
      assert.strictEqual(interruptoresFinales[label], true, 'msg');
    `;
    const v = detectarComparacionesCrudas(codigo, 'x.test.js');
    expect(v).to.be.empty;
  });

  it('NO detecta cuando ya se usa assertTextoIgual (no es assert.strictEqual/equal)', function () {
    const codigo = `
      assertTextoIgual(actual, esperado, 'msg');
    `;
    const v = detectarComparacionesCrudas(codigo, 'x.test.js');
    expect(v).to.be.empty;
  });

  it('respeta el escape hatch "contrato-texto-ui:permitir" en la misma línea', function () {
    const codigo = `
      assert.strictEqual((await form.getValor('X')).trim(), 'Y', 'msg'); // contrato-texto-ui:permitir: razón puntual
    `;
    const v = detectarComparacionesCrudas(codigo, 'x.test.js');
    expect(v).to.be.empty;
  });

  it('no confunde una asignación de propiedad ("obj.titulo = x") con la variable "titulo"', function () {
    const codigo = `
      const titulo = 'Configuraciones';
      obj.titulo = await banco.getTitulo();
      assert.strictEqual(titulo, 'Configuraciones', 'msg');
    `;
    const v = detectarComparacionesCrudas(codigo, 'x.test.js');
    expect(v).to.be.empty;
  });

  it('maneja correctamente un valor con comas DENTRO de un string literal (no rompe el split de argumentos)', function () {
    // Caso real: el default de "Beneficios" es un string con comas.
    const codigo = `
      const beneficios = testContext.get(CASO, 'beneficios') || 'Seguro médico, bono navideño, días libres adicionales.';
      const valorBeneficios = await detalle.form.getValor('Beneficios');
      assert.strictEqual(valorBeneficios, beneficios, '"Beneficios" no quedó en "' + beneficios + '"');
    `;
    const v = detectarComparacionesCrudas(codigo, 'x.test.js');
    expect(v).to.have.lengthOf(1);
  });

  it('reporta el archivo y un snippet legible en cada violación', function () {
    const codigo = `assert.strictEqual((await x.getTitulo()).trim(), 'Y', 'msg');`;
    const v = detectarComparacionesCrudas(codigo, 'modulo/tests/algo.test.js');
    expect(v[0]).to.include({ archivo: 'modulo/tests/algo.test.js' });
    expect(v[0].snippet).to.include('getTitulo');
  });
});
