/**
 * Utilidades para construir fragmentos XPath 1.0 (el motor que usa
 * Selenium/WebDriver) que comparan texto renderizado por la app.
 *
 * XPath 1.0 NO tiene un `contains()` case-insensitive nativo: `translate()`
 * es el mecanismo estándar para plegar el case de un lado antes de comparar.
 * Sin esto, un locator como
 * `contains(normalize-space(.), 'popular')` NO matchea una celda real
 * `"Banco Popular"` (P mayúscula) aunque el buscador del grid (que sí filtra
 * case-insensitive en el cliente) ya la esté mostrando en pantalla — el
 * locator y el filtro visual quedan con criterios distintos y el test
 * revienta con un timeout aunque la fila esté visible.
 *
 * Es el mecanismo OBLIGATORIO para este tipo de locator — ver SKILL.md,
 * "Text comparisons must be case-insensitive".
 */

const MAYUSCULAS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZÁÉÍÓÚÜ';
const MINUSCULAS = 'abcdefghijklmnñopqrstuvwxyzáéíóúü';

/**
 * Condición XPath `contains(...)` case-insensitive: compara el texto
 * normalizado (trim + colapso de espacios) de `expresionXPath` (nodo de
 * contexto `.` por defecto) contra `texto`, ambos plegados a minúscula.
 *
 * Devuelve solo la CONDICIÓN (sin corchetes) para poder combinarla dentro de
 * un predicado más grande, ej.: `` `//tr[${containsTextoIgnoreCase(texto)}]` ``.
 *
 * `texto` se interpola directo (mismo comportamiento previo de estos
 * locators, sin escapar comillas simples) — no pasar un valor que contenga `'`.
 */
function containsTextoIgnoreCase(texto, expresionXPath = '.') {
  const valor = String(texto).trim().toLowerCase();
  return `contains(translate(normalize-space(${expresionXPath}), '${MAYUSCULAS}', '${MINUSCULAS}'), '${valor}')`;
}

module.exports = { containsTextoIgnoreCase };
