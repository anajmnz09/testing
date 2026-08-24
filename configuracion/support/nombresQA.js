const PREFIJO = 'QA';

/**
 * Próximo nombre de una serie QA acotada para los defaults automáticos de
 * "editar-*" que renombran el propio campo identificador (Beneficio,
 * Departamento, Habilidad, Nombre Plan de seguro, Proveedor, Razón — entidades
 * sin otro campo de texto libre "seguro" para usar de default).
 *
 * Si `actual` ya es "QA-N" (una edición anterior de este mismo helper), suma
 * uno: "QA-N+1". Si no (nombre real del registro, o primera vez), arranca en
 * "QA-1". A diferencia del criterio anterior (`"${nombreUsado} EDITADO
 * ${timestamp}"`), NUNCA concatena sobre el nombre actual: ese patrón crecía
 * sin límite cada vez que el fallback automático (`abrirPrimero()`) editaba
 * el MISMO registro sin un valor dirigido desde el Panel, hasta superar el
 * `maxlength` real del campo y truncarse en la app — confirmado con evidencia
 * real en "Nombre Plan de seguro" (máx. 50 caracteres): tras varias corridas
 * sin dirigir, el nombre acumulado quedó cortado a mitad de un sufijo y el
 * assert final falló contra el valor truncado. "QA-N" se mantiene corto
 * siempre (nunca más de un dígito adicional por corrida), así que hacen
 * falta miles de corridas sin dirigir sobre el MISMO registro para acercarse
 * a cualquier `maxlength` realista.
 */
function siguienteNombreQA(actual) {
  const match = /^QA-(\d+)$/.exec(String(actual || '').trim());
  const siguiente = match ? parseInt(match[1], 10) + 1 : 1;
  return `${PREFIJO}-${siguiente}`;
}

/**
 * Nombre para el default automático de "crear-*" (la app rechaza nombres
 * duplicados, así que el default SIEMPRE tiene que ser nuevo).
 *
 * Si `dirigido` tiene valor (el Panel dirigió ese campo), se devuelve TAL
 * CUAL — sin agregarle ningún sufijo — para que el nombre guardado sea
 * exactamente el que se pidió desde el Panel. Solo cuando NO se dirigió nada
 * (`dirigido` vacío/undefined) se arma un nombre desde `base` + un sufijo
 * corto y siempre distinto (últimos 6 dígitos del timestamp), para que
 * corridas automáticas sucesivas no choquen por nombre duplicado.
 *
 * Antes, el sufijo se agregaba SIEMPRE (incluso sobre un nombre dirigido
 * desde el Panel), así que un valor como "Banco Popular" enviado desde el
 * Panel terminaba guardándose como "Banco Popular 293688" — un dato distinto
 * al pedido. Este helper reemplaza ese criterio en todos los `crear-*` de
 * Configuración.
 */
function nombreUnicoQA(dirigido, base) {
  if (dirigido) return dirigido;
  return `${base} ${Date.now().toString().slice(-6)}`;
}

/**
 * Deriva un "código" (username-like) a partir de un nombre: sin acentos, sin
 * espacios, en minúsculas (ej. "QA Usuario 293688" -> "qausuario293688").
 * Pensado para "Código de usuario" de Usuarios — a pedido explícito del
 * usuario, el código debe estar relacionado al nombre y no llevar espacios,
 * en vez de ser un valor arbitrario sin relación. Como el nombre QA ya trae
 * un sufijo único (`nombreUnicoQA`), el código derivado hereda esa unicidad
 * sin necesidad de otro sufijo aparte.
 */
function codigoDesdeNombre(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

module.exports = { siguienteNombreQA, nombreUnicoQA, codigoDesdeNombre };
