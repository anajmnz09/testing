'use strict';

/**
 * Reglas PURAS (sin Selenium, sin red) del runner de Casos de Uso IA: qué puede hacer el modelo, cómo se
 * consolida el resultado y cómo se acota el historial enviado al modelo. Se prueban en `ia/tests/`.
 */

const TECLAS = new Map([
  ['Enter', 'ENTER'],
  ['Tab', 'TAB'],
  ['Escape', 'ESCAPE'],
  ['ArrowDown', 'ARROW_DOWN'],
  ['ArrowUp', 'ARROW_UP'],
  ['ArrowLeft', 'ARROW_LEFT'],
  ['ArrowRight', 'ARROW_RIGHT'],
  ['Backspace', 'BACK_SPACE'],
  ['Delete', 'DELETE'],
  ['PageDown', 'PAGE_DOWN'],
  ['PageUp', 'PAGE_UP'],
]);

const ESTADOS = ['PASS', 'FAIL', 'BLOCKED'];
const ESTADOS_VERIFICACION = ['cumplida', 'incumplida', 'no_verificada'];

/**
 * El modelo solo navega DENTRO de la app bajo prueba: ruta relativa o URL del mismo origen que `baseUrl`.
 * Devuelve la URL absoluta o lanza un Error (nunca otro origen, nunca otro protocolo).
 */
function urlPermitida(destino, baseUrl) {
  const base = new URL(baseUrl);
  let u;
  try {
    u = new URL(String(destino || ''), base);
  } catch (e) {
    throw new Error('URL inválida');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocolo no permitido');
  if (u.origin !== base.origin) throw new Error(`solo se permite navegar dentro de ${base.origin}`);
  return u.toString();
}

/** Nombre de tecla permitido -> nombre de `Key` de selenium-webdriver (o lanza). */
function teclaPermitida(nombre) {
  if (!TECLAS.has(nombre)) throw new Error(`tecla no permitida: "${nombre}" (permitidas: ${[...TECLAS.keys()].join(', ')})`);
  return TECLAS.get(nombre);
}

function entero(v, nombre) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new Error(`"${nombre}" debe ser un entero >= 0`);
  return n;
}

/**
 * Valida y normaliza el input de una acción del modelo (el modelo NO es de confianza: todo se revisa).
 * Devuelve el input normalizado o lanza un Error con el motivo.
 */
function validarAccion(nombre, input = {}) {
  switch (nombre) {
    case 'inspeccionar':
      return { captura: input.captura === true };
    case 'buscar_texto': {
      if (typeof input.texto !== 'string' || !input.texto.trim()) throw new Error('"texto" es obligatorio');
      return { texto: input.texto.trim().slice(0, 300) };
    }
    case 'leer_elemento':
      return { id: entero(input.id, 'id') };
    case 'hacer_click':
      return { id: entero(input.id, 'id'), doble: input.doble === true };
    case 'escribir': {
      if (typeof input.texto !== 'string') throw new Error('"texto" es obligatorio (string)');
      if (input.texto.length > 2000) throw new Error('"texto" demasiado largo (máx. 2000)');
      return { id: entero(input.id, 'id'), texto: input.texto, borrar: input.borrar !== false, enter: input.enter === true };
    }
    case 'tecla':
      teclaPermitida(input.tecla);
      return { tecla: input.tecla };
    case 'seleccionar_opcion': {
      if (typeof input.texto !== 'string' || !input.texto) throw new Error('"texto" es obligatorio');
      return { id: entero(input.id, 'id'), texto: input.texto };
    }
    case 'navegar':
      if (typeof input.destino !== 'string' || !input.destino) throw new Error('"destino" es obligatorio');
      return { destino: input.destino };
    case 'esperar': {
      const s = Number(input.segundos);
      if (!Number.isFinite(s) || s <= 0) throw new Error('"segundos" debe ser > 0');
      return { segundos: Math.min(s, 10) };
    }
    case 'desplazar': {
      if (!['arriba', 'abajo'].includes(input.direccion)) throw new Error('"direccion" debe ser arriba o abajo');
      return { direccion: input.direccion, id: input.id === undefined || input.id === null ? null : entero(input.id, 'id') };
    }
    default:
      throw new Error(`herramienta desconocida: "${nombre}"`);
  }
}

const METODOS = ['texto_visible', 'valor_campo', 'estado_control', 'navegacion', 'presencia_ausencia', 'mensaje_app', 'captura', 'otro'];

/** Minúsculas, sin acentos y con espacios colapsados (comparación de texto observado). */
function normalizar(t) {
  return String(t || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Consolida lo que declara el modelo en `finalizar` con lo que realmente está respaldado. Una condición se
 * verifica con una OBSERVACIÓN DIRECTA del navegador (texto visible, valor de un campo, estado de un control,
 * navegación, presencia/ausencia, mensaje de la app): la captura es evidencia adicional, no un requisito.
 * "cumplida" exige una evidencia escrita; si el modelo cita el texto observado (`texto_observado`) y se dispone
 * del corpus de observaciones de la corrida, ese texto debe aparecer realmente en alguna (no se puede inventar).
 */
function consolidarResultado({ resultado, resumen = '', motivo = '', verificaciones = [] } = {}, { corpus = null } = {}) {
  const declarado = ESTADOS.includes(resultado) ? resultado : 'BLOCKED';
  const base = corpus ? normalizar(corpus) : null;
  const vs = (Array.isArray(verificaciones) ? verificaciones : []).map((v) => {
    let estado = ESTADOS_VERIFICACION.includes(v && v.estado) ? v.estado : 'no_verificada';
    let evidencia = String((v && v.evidencia) || '').trim();
    const citado = String((v && v.texto_observado) || '').trim();
    if (estado === 'cumplida' && !evidencia && !citado) estado = 'no_verificada'; // "cumplida" sin evidencia no cuenta
    if (estado === 'cumplida' && citado && base !== null && !base.includes(normalizar(citado))) {
      estado = 'no_verificada';
      evidencia = `${evidencia} [el texto citado "${citado.slice(0, 80)}" no aparece en ninguna observación del navegador]`.trim();
    }
    return {
      condicion: String((v && v.condicion) || '').trim(),
      estado,
      metodo: METODOS.includes(v && v.metodo) ? v.metodo : 'otro',
      evidencia: evidencia || citado,
      ...(citado ? { texto_observado: citado } : {}),
    };
  });
  const incumplidas = vs.filter((v) => v.estado === 'incumplida');
  const noVerificadas = vs.filter((v) => v.estado === 'no_verificada');
  const out = (estado, extra) => ({ estado, resumen: String(resumen), motivo: extra, declarado, verificaciones: vs });

  if (declarado === 'BLOCKED') return out('BLOCKED', String(motivo) || 'El modelo no pudo continuar.');
  if (!vs.length) return out('BLOCKED', 'El modelo no registró ninguna verificación: el resultado no se puede respaldar.');
  if (incumplidas.length) {
    return out('FAIL', String(motivo) || `Condiciones incumplidas: ${incumplidas.map((v) => v.condicion).join('; ')}`);
  }
  if (noVerificadas.length) {
    return out('BLOCKED', `Condiciones no verificadas: ${noVerificadas.map((v) => v.condicion).join('; ')}`);
  }
  if (declarado === 'FAIL') return out('FAIL', String(motivo) || 'El modelo reportó un comportamiento incorrecto.');
  return out('PASS', String(motivo));
}

/**
 * Historial acotado: deja las imágenes de los últimos `conservar` resultados de herramienta y reemplaza las
 * anteriores por un texto (evita crecer sin límite en tokens). No muta la entrada; el PDF (document) no se toca.
 */
function recortarImagenes(messages, conservar = 2) {
  const posiciones = [];
  messages.forEach((m, i) => {
    if (m.role !== 'user' || !Array.isArray(m.content)) return;
    m.content.forEach((b, j) => {
      if (b.type === 'tool_result' && Array.isArray(b.content) && b.content.some((c) => c.type === 'image')) posiciones.push([i, j]);
    });
  });
  const viejas = new Set(posiciones.slice(0, Math.max(0, posiciones.length - conservar)).map(([i, j]) => `${i}:${j}`));
  return messages.map((m, i) => {
    if (m.role !== 'user' || !Array.isArray(m.content)) return m;
    if (!m.content.some((_, j) => viejas.has(`${i}:${j}`))) return m;
    return {
      ...m,
      content: m.content.map((b, j) => {
        if (!viejas.has(`${i}:${j}`)) return b;
        return { ...b, content: b.content.map((c) => (c.type === 'image' ? { type: 'text', text: '[captura anterior omitida]' } : c)) };
      }),
    };
  });
}

module.exports = { normalizar, METODOS, urlPermitida, teclaPermitida, validarAccion, consolidarResultado, recortarImagenes, TECLAS, ESTADOS };
