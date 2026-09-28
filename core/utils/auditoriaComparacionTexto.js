/**
 * Detector de comparaciones CRUDAS (`assert.strictEqual`/`assert.equal`)
 * contra texto renderizado por la app, en vez de `assertTextoIgual`
 * (case-insensitive) — ver SKILL.md "Text comparisons must be
 * case-insensitive" y su incidente 2026-09-09: el helper y la regla ya
 * existían, pero nada impedía que un test nuevo (o uno viejo, en 6 archivos
 * distintos de 3 módulos) volviera a compararlo con `assert.strictEqual` a
 * mano. Este módulo es el detector que respalda el contrato permanente
 * `core/tests/contrato-comparacion-texto-ui.spec.js`, que corre en cada
 * `npm run test:unit` y falla el build si el patrón reaparece.
 *
 * Heurística deliberada, NO un parser AST completo (sin agregar una
 * dependencia nueva al proyecto solo para esto — ver el spec del contrato
 * para la decisión completa): un call `assert.strictEqual(A, B, ...)` /
 * `assert.equal(A, B, ...)` se marca cuando A o B:
 *   - invocan inline a un método de `METODOS_TEXTO_UI` (conocidos por leer
 *     texto de la UI: `getValor`, `getTitulo`, `getNombre`, ...), o
 *   - acceden a una propiedad de un objeto "fila*" (fila de un DataGrid,
 *     ej. `filaFinal['Descripción']`), o
 *   - son un identificador simple cuya ÚLTIMA asignación previa en el mismo
 *     archivo cumple cualquiera de los dos puntos anteriores.
 *
 * Una línea que contenga el comentario `contrato-texto-ui:permitir` se
 * ignora — escape hatch explícito y auditable para un caso futuro
 * legítimo (ej. un método que hoy no existe y que, aun devolviendo texto de
 * pantalla, tiene una razón real para compararse estricto). Preferir
 * SIEMPRE `assertTextoIgual`/`Form.assertValor`; usar el escape hatch solo
 * cuando de verdad no aplica, y decir por qué en un comentario al lado.
 *
 * Límites conocidos (aceptados a propósito, es una heurística barata, no un
 * parser): no seguye asignaciones que crucen un `;` dentro de un template
 * literal con `${...}` anidado; no rastrea reasignaciones condicionales
 * (si el archivo asigna la misma variable en dos ramas, usa la ÚLTIMA
 * asignación textual antes del call, no la que realmente ejecutó en
 * runtime). Cualquier falso negativo real encontrado en revisión de código
 * humana sigue siendo un bug de test normal — este detector es una red de
 * seguridad adicional, no un reemplazo del criterio humano.
 */

const METODOS_TEXTO_UI = [
  'getValor',
  'esperarValor',
  'getValorEditar',
  'esperarValorEditar',
  'getTitulo',
  'getNombre',
  'esperarNombre',
  'getTexto',
  'getDescripcion',
  'getRequisitos',
  'getResponsabilidades',
  'getCompania',
  'getUsuario',
  'getErrorMessage',
];

const MARCADOR_ESCAPE = 'contrato-texto-ui:permitir';

const RE_FILA_PROP = /\b\w*[Ff]ila\w*\s*(\[\s*['"`]|\.\s*[A-ZÁÉÍÓÚÑ])/;

function _contieneTaint(texto) {
  if (METODOS_TEXTO_UI.some((metodo) => new RegExp(`\\b${metodo}\\s*\\(`).test(texto))) return true;
  return RE_FILA_PROP.test(texto);
}

/** Escanea desde `desde` (un '(') y devuelve el índice del ')' que lo balancea, saltando strings/templates. -1 si no cierra. */
function _finDeParentesis(codigo, desde) {
  let profundidad = 0;
  let enString = null;
  for (let i = desde; i < codigo.length; i++) {
    const c = codigo[i];
    if (enString) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === enString) enString = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      enString = c;
      continue;
    }
    if (c === '(') profundidad++;
    else if (c === ')') {
      profundidad--;
      if (profundidad === 0) return i;
    }
  }
  return -1;
}

/** Primer argumento "top-level" de un texto de argumentos (antes de la primera coma fuera de strings/brackets). */
function _primerArgumento(argsTexto) {
  let profundidad = 0;
  let enString = null;
  for (let i = 0; i < argsTexto.length; i++) {
    const c = argsTexto[i];
    if (enString) {
      if (c === '\\') {
        i++;
        continue;
      }
      if (c === enString) enString = null;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      enString = c;
      continue;
    }
    if ('([{'.includes(c)) profundidad++;
    else if (')]}'.includes(c)) profundidad--;
    else if (c === ',' && profundidad === 0) return argsTexto.slice(0, i);
  }
  return argsTexto;
}

function _lineaDe(codigo, indice) {
  return codigo.slice(0, indice).split('\n').length;
}

function _lineaCompleta(codigo, indice) {
  const inicio = codigo.lastIndexOf('\n', indice) + 1;
  let fin = codigo.indexOf('\n', indice);
  if (fin === -1) fin = codigo.length;
  return codigo.slice(inicio, fin);
}

/** Última asignación a `nombre` (const/let/var o reasignación simple) antes de `hastaIndice`. Devuelve el lado derecho, o null. */
function _ultimaAsignacion(codigo, nombre, hastaIndice) {
  const re = new RegExp(`(?<!\\.)\\b${nombre}\\b\\s*=\\s*(?!=)`, 'g');
  const antes = codigo.slice(0, hastaIndice);
  let match;
  let ultimo = null;
  while ((match = re.exec(antes))) {
    ultimo = match;
  }
  if (!ultimo) return null;
  const inicioValor = ultimo.index + ultimo[0].length;
  const finLinea = codigo.indexOf(';', inicioValor);
  return codigo.slice(inicioValor, finLinea === -1 ? inicioValor + 200 : finLinea);
}

/**
 * Devuelve las violaciones encontradas en `codigo` (contenido de un archivo
 * ya leído): `[{ archivo, linea, snippet }]`. `archivo` es solo lo que se
 * pasa acá (para el mensaje), no se lee del disco.
 */
function detectarComparacionesCrudas(codigo, archivo) {
  const violaciones = [];
  const reCall = /assert\.(strictEqual|equal)\s*\(/g;
  let m;
  while ((m = reCall.exec(codigo))) {
    const inicioParen = m.index + m[0].length - 1;
    const finParen = _finDeParentesis(codigo, inicioParen);
    if (finParen === -1) continue;
    const argsTexto = codigo.slice(inicioParen + 1, finParen);
    const lineaTexto = _lineaCompleta(codigo, m.index);
    if (lineaTexto.includes(MARCADOR_ESCAPE)) continue;

    const args = [];
    let resto = argsTexto;
    for (let i = 0; i < 2 && resto.length; i++) {
      const arg = _primerArgumento(resto);
      args.push(arg);
      resto = resto.slice(arg.length + 1); // +1 salta la coma
    }

    let sospechoso = args.some((a) => _contieneTaint(a));
    if (!sospechoso) {
      for (const a of args) {
        const ident = a.trim();
        if (/^[A-Za-z_$][\w$]*$/.test(ident)) {
          const rhs = _ultimaAsignacion(codigo, ident, m.index);
          if (rhs && _contieneTaint(rhs)) {
            sospechoso = true;
            break;
          }
        }
      }
    }

    if (sospechoso) {
      violaciones.push({ archivo, linea: _lineaDe(codigo, m.index), snippet: lineaTexto.trim() });
    }
  }
  return violaciones;
}

module.exports = { detectarComparacionesCrudas, METODOS_TEXTO_UI, MARCADOR_ESCAPE };
