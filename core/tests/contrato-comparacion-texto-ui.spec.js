const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const { detectarComparacionesCrudas } = require('../utils/auditoriaComparacionTexto');

/**
 * CONTRATO: ningún test E2E compara texto de la UI con `assert.strictEqual`
 * / `assert.equal` crudo.
 *
 * Por qué existe este archivo (y no solo la regla en SKILL.md + el helper
 * `assertTextoIgual`): la regla y el helper YA EXISTÍAN — usados en 29
 * archivos — cuando este mismo antipatrón reapareció en
 * `editar-capacitacion.test.js` ("Frecuencia": "Renovación Trimestral" vs
 * "Renovación trimestral") y, al auditar el resto del repo, en otros 6
 * archivos más de los 3 módulos. La causa raíz no era que faltara el
 * helper: es que nada impedía mecánicamente que un desarrollador (humano o
 * agente) escribiera `assert.strictEqual(actual, esperado)` en vez de
 * `assertTextoIgual(actual, esperado)` — la documentación por sí sola ya
 * demostró ser insuficiente para evitar la recurrencia.
 *
 * Este spec corre en cada `npm run test:unit` (mismo mecanismo que
 * `contrato-suite-unitaria.spec.js`, que ya protege otros invariantes del
 * framework) y hace mecánicamente imposible mergear un test nuevo con este
 * antipatrón sin que la suite unitaria falle, señalando archivo y línea.
 *
 * Decisión: heurística de texto (`utils/auditoriaComparacionTexto.js`), NO
 * un parser AST con una librería nueva. El proyecto no tiene ESLint ni
 * ninguna dependencia de parsing como dependencia declarada (`esprima`
 * aparece en node_modules solo transitivamente, vía otro paquete — no es
 * seguro depender de eso para un contrato permanente). Agregar una
 * dependencia de parsing real es una opción válida a futuro si esta
 * heurística demuestra ser insuficiente, pero hoy sería una herramienta
 * nueva para un problema que la heurística ya cubre con evidencia (11 casos
 * unitarios, incluyendo el caso real con comas dentro de un string) sin
 * agregar nada al árbol de dependencias.
 *
 * Alcance: solo `*.test.js` (E2E, donde vive el antipatrón real) en los 3
 * módulos + `core` — NO `*.spec.js` (unitarios): esos SÍ comparan strings
 * técnicos/internos legítimamente estrictos (nombres de estrategia, keys,
 * mensajes de error exactos) que NUNCA deben pasar por
 * `assertTextoIgual` — mezclar ambos scopes generaría falsos positivos
 * exactamente del tipo que el pedido original prohibió tocar.
 */
describe('contrato: comparaciones de texto de UI en tests E2E', function () {
  const repo = path.resolve(__dirname, '..', '..');
  const MODULOS = ['core', 'configuracion', 'empleados', 'reclutamiento'];

  function listarTestsE2E() {
    const archivos = [];
    for (const modulo of MODULOS) {
      const testsDir = path.join(repo, modulo, 'tests');
      if (!fs.existsSync(testsDir)) continue;
      (function recorrer(dir) {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) recorrer(full);
          else if (entry.isFile() && entry.name.endsWith('.test.js')) archivos.push(full);
        }
      })(testsDir);
    }
    return archivos;
  }

  it('ningún *.test.js usa assert.strictEqual/equal contra texto leído de la UI', function () {
    const archivos = listarTestsE2E();
    expect(archivos.length, 'no se encontró ningún *.test.js — ¿corrió desde el directorio equivocado?').to.be.greaterThan(0);

    const violaciones = [];
    for (const archivo of archivos) {
      const codigo = fs.readFileSync(archivo, 'utf8');
      const relativo = path.relative(repo, archivo).replace(/\\/g, '/');
      violaciones.push(...detectarComparacionesCrudas(codigo, relativo));
    }

    const detalle = violaciones.map((v) => `  ${v.archivo}:${v.linea} -> ${v.snippet}`).join('\n');
    expect(
      violaciones,
      `Se encontraron ${violaciones.length} comparación(es) cruda(s) de texto de UI ` +
        `(assert.strictEqual/equal en vez de assertTextoIgual/Form.assertValor):\n${detalle}\n\n` +
        'Ver SKILL.md "Text comparisons must be case-insensitive". Si de verdad no es texto de UI, ' +
        'agregar el comentario "// contrato-texto-ui:permitir: <por qué>" en esa línea.'
    ).to.be.empty;
  });
});
