'use strict';

/**
 * Extracción de TEXTO de un PDF, sin dependencias nuevas (solo `zlib` de Node). El texto del caso de uso es la
 * fuente principal para el agente; el PDF original solo se adjunta como referencia visual cuando trae imágenes
 * relevantes o cuando el texto no se pudo extraer bien (PDF escaneado, fuentes sin mapa Unicode…).
 *
 * Cubre lo habitual de documentos exportados (Word, Chrome, LibreOffice): streams Flate, object streams, fuentes
 * con ToUnicode (Identity-H) o codificación simple. Lo que no entienda no revienta: devuelve poco texto y el
 * llamador cae al PDF completo (`suficiente: false`).
 */
const zlib = require('zlib');

const MIN_CARACTERES = 80;
const MIN_PROPORCION_LEGIBLE = 0.85;

// ---------------------------------------------------------------------------
// Objetos del PDF
// ---------------------------------------------------------------------------
function inflar(buf) {
  try {
    return zlib.inflateSync(buf);
  } catch (e) {
    try {
      return zlib.inflateSync(buf, { finishFlush: zlib.constants.Z_SYNC_FLUSH });
    } catch (e2) {
      return null;
    }
  }
}

function esFlate(dict) {
  return /\/Filter\s*(\[[^\]]*\/FlateDecode|\/FlateDecode)/.test(dict);
}

function sinFiltroNoSoportado(dict) {
  return !/\/Filter/.test(dict) || esFlate(dict);
}

/** Lee todos los objetos `N G obj … endobj` (y expande los object streams). Map num -> { dict, stream }. */
function leerObjetos(buf) {
  const txt = buf.toString('latin1');
  const objetos = new Map();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(txt))) {
    const num = Number(m[1]);
    const ini = m.index + m[0].length;
    const fin = txt.indexOf('endobj', ini);
    if (fin < 0) break;
    const cuerpo = txt.slice(ini, fin);
    const s = cuerpo.indexOf('stream');
    let dict = cuerpo;
    let stream = null;
    if (s >= 0 && /^\s*<</.test(cuerpo)) {
      dict = cuerpo.slice(0, s);
      let a = ini + s + 6;
      if (txt[a] === '\r') a++;
      if (txt[a] === '\n') a++;
      let b = txt.indexOf('endstream', a);
      if (b < 0) b = fin;
      let datos = buf.subarray(a, b);
      if (esFlate(dict)) datos = inflar(datos);
      else if (!sinFiltroNoSoportado(dict)) datos = null;
      stream = datos;
    }
    objetos.set(num, { dict, stream });
    re.lastIndex = fin + 6;
  }
  // Object streams: los objetos viven dentro de un stream.
  for (const [, o] of [...objetos]) {
    if (!o.stream || !/\/Type\s*\/ObjStm/.test(o.dict)) continue;
    const n = Number((/\/N\s+(\d+)/.exec(o.dict) || [])[1]);
    const first = Number((/\/First\s+(\d+)/.exec(o.dict) || [])[1]);
    if (!n || !first) continue;
    const s = o.stream.toString('latin1');
    const cab = s.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < n; i++) {
      const num = cab[i * 2];
      const off = cab[i * 2 + 1];
      const fin = i + 1 < n ? cab[(i + 1) * 2 + 1] : s.length - first;
      if (Number.isFinite(num) && !objetos.has(num)) objetos.set(num, { dict: s.slice(first + off, first + fin), stream: null });
    }
  }
  return objetos;
}

/** Subcadena balanceada `<< … >>` que sigue a `/Clave` (o null). */
function bloque(dict, clave) {
  const i = dict.indexOf(clave);
  if (i < 0) return null;
  const a = dict.indexOf('<<', i + clave.length);
  const sig = dict.slice(i + clave.length).search(/\S/);
  if (a < 0 || (sig >= 0 && i + clave.length + sig !== a)) return null;
  let nivel = 0;
  for (let k = a; k < dict.length - 1; k++) {
    if (dict[k] === '<' && dict[k + 1] === '<') {
      nivel++;
      k++;
    } else if (dict[k] === '>' && dict[k + 1] === '>') {
      nivel--;
      k++;
      if (nivel === 0) return dict.slice(a, k + 1);
    }
  }
  return null;
}

const ref = (dict, clave) => {
  const m = new RegExp(`${clave}\\s+(\\d+)\\s+\\d+\\s+R`).exec(dict);
  return m ? Number(m[1]) : null;
};

// ---------------------------------------------------------------------------
// Fuentes (ToUnicode)
// ---------------------------------------------------------------------------
function hexAUtf16(h) {
  let s = '';
  for (let i = 0; i + 3 < h.length + 1; i += 4) s += String.fromCharCode(parseInt(h.slice(i, i + 4), 16));
  return s;
}

function parsearCMap(texto) {
  const mapa = new Map();
  let ancho = 0;
  const cs = /begincodespacerange\s*<([0-9A-Fa-f]+)>/.exec(texto);
  if (cs) ancho = cs[1].length / 2;
  for (const bloqueBf of texto.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const p of bloqueBf[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) mapa.set(parseInt(p[1], 16), hexAUtf16(p[2]));
  }
  for (const bloqueBf of texto.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const p of bloqueBf[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(\[[^\]]*\]|<[0-9A-Fa-f]+>)/g)) {
      const lo = parseInt(p[1], 16);
      const hi = parseInt(p[2], 16);
      if (p[3].startsWith('[')) {
        [...p[3].matchAll(/<([0-9A-Fa-f]+)>/g)].forEach((d, i) => mapa.set(lo + i, hexAUtf16(d[1])));
      } else {
        const base = hexAUtf16(p[3].slice(1, -1));
        for (let c = lo; c <= hi && c - lo < 65536; c++) {
          mapa.set(c, base.slice(0, -1) + String.fromCharCode(base.charCodeAt(base.length - 1) + (c - lo)));
        }
      }
    }
  }
  return { mapa, ancho };
}

function crearFuente(objetos, num) {
  const o = objetos.get(num);
  if (!o) return null;
  const tu = ref(o.dict, '/ToUnicode');
  if (tu && objetos.get(tu) && objetos.get(tu).stream) {
    const { mapa, ancho } = parsearCMap(objetos.get(tu).stream.toString('latin1'));
    const dosBytes = ancho ? ancho === 2 : /Identity-H/.test(o.dict) || /\/Type0/.test(o.dict);
    return { mapa, ancho: dosBytes ? 2 : 1 };
  }
  return { mapa: null, ancho: /Identity-H/.test(o.dict) ? 2 : 1 };
}

function decodificar(bytes, fuente) {
  let s = '';
  const ancho = fuente ? fuente.ancho : 1;
  for (let i = 0; i < bytes.length; i += ancho) {
    const cod = ancho === 2 ? (bytes[i] << 8) | (bytes[i + 1] || 0) : bytes[i];
    if (fuente && fuente.mapa && fuente.mapa.has(cod)) s += fuente.mapa.get(cod);
    else if (!fuente || !fuente.mapa) s += ancho === 1 ? String.fromCharCode(cod) : '';
    else s += ancho === 1 ? String.fromCharCode(cod) : '';
  }
  return s;
}

// ---------------------------------------------------------------------------
// Contenido de página
// ---------------------------------------------------------------------------
function textoDeContenido(contenido, fuentes) {
  const s = contenido.toString('latin1');
  let salida = '';
  let fuente = null;
  let pila = [];
  let tamano = 10; // Tf × escala de Tm
  let escalaTm = 1;
  let tfTamano = 10;
  // Posición: origen de la línea (Tm/Td) y x estimado donde terminó el último texto mostrado.
  let lx = 0;
  let ly = 0;
  let px = 0;
  let finX = null;
  let finY = null;
  let forzarLinea = false;

  const nuevaLinea = () => {
    if (salida && !salida.endsWith('\n')) salida += '\n';
  };
  const espacio = () => {
    if (salida && !/\s$/.test(salida)) salida += ' ';
  };
  /** Decide salto de línea / espacio según la posición y agrega el texto. */
  const mostrar = (bytes) => {
    const t = decodificar(bytes, fuente);
    if (!t) return;
    if (forzarLinea || (finY !== null && Math.abs(ly - finY) > 0.5 * tamano)) nuevaLinea();
    else if (finX !== null && px - finX > 0.6 * tamano) espacio(); // hueco grande en la misma línea: otra palabra/celda
    forzarLinea = false;
    salida += t;
    finX = px + t.length * 0.5 * tamano; // ancho estimado (los glifos de una palabra avanzan ~0.3-0.8 em)
    finY = ly;
    px = finX;
  };
  const mover = (x, y) => {
    lx = x;
    ly = y;
    px = x;
  };

  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
    } else if (c === '(') {
      let nivel = 1;
      const bytes = [];
      i++;
      while (i < s.length && nivel > 0) {
        const ch = s[i];
        if (ch === '\\') {
          const n = s[i + 1];
          if (/[0-7]/.test(n)) {
            const oct = /^[0-7]{1,3}/.exec(s.slice(i + 1))[0];
            bytes.push(parseInt(oct, 8) & 255);
            i += 1 + oct.length;
            continue;
          }
          const mapa = { n: 10, r: 13, t: 9, b: 8, f: 12 };
          if (n === '\r' || n === '\n') {
            i += 2;
            continue;
          }
          bytes.push(mapa[n] !== undefined ? mapa[n] : n.charCodeAt(0));
          i += 2;
          continue;
        }
        if (ch === '(') nivel++;
        if (ch === ')') {
          nivel--;
          if (nivel === 0) {
            i++;
            break;
          }
        }
        bytes.push(ch.charCodeAt(0) & 255);
        i++;
      }
      pila.push({ t: 'str', v: bytes });
    } else if (c === '<' && s[i + 1] !== '<') {
      const fin = s.indexOf('>', i);
      const h = s.slice(i + 1, fin).replace(/\s+/g, '');
      const bytes = [];
      for (let k = 0; k < h.length; k += 2) bytes.push(parseInt(h.slice(k, k + 2).padEnd(2, '0'), 16));
      pila.push({ t: 'str', v: bytes });
      i = fin + 1;
    } else if (c === '<' || c === '>') {
      i += 2; // << >>
    } else if (c === '[') {
      pila.push({ t: 'arr', v: [] });
      i++;
    } else if (c === ']') {
      // cierra el último arreglo: junta los operandos desde su apertura
      let k = pila.length - 1;
      while (k >= 0 && !(pila[k].t === 'arr' && !pila[k].cerrado)) k--;
      if (k >= 0) {
        const items = pila.splice(k + 1);
        pila[k].v = items;
        pila[k].cerrado = true;
      }
      i++;
    } else if (c === '/') {
      const m = /^\/[^\s/\[\]()<>]*/.exec(s.slice(i));
      pila.push({ t: 'name', v: m[0] });
      i += m[0].length;
    } else if (/[-+.\d]/.test(c)) {
      const m = /^[-+]?\d*\.?\d+/.exec(s.slice(i));
      if (m) {
        pila.push({ t: 'num', v: parseFloat(m[0]) });
        i += m[0].length;
      } else i++;
    } else {
      const m = /^[A-Za-z'"*]+/.exec(s.slice(i));
      if (!m) {
        i++;
        continue;
      }
      const op = m[0];
      i += op.length;
      if (op === 'BI') {
        const ei = s.indexOf('EI', i);
        i = ei < 0 ? s.length : ei + 2;
        pila = [];
        continue;
      }
      const nums = pila.filter((x) => x.t === 'num').map((x) => x.v);
      switch (op) {
        case 'BT':
          mover(0, 0);
          escalaTm = 1;
          tamano = tfTamano;
          break;
        case 'Tf': {
          const n = pila.find((x) => x.t === 'name');
          fuente = n ? fuentes[n.v] || null : null;
          if (nums.length && nums[nums.length - 1] > 0) tfTamano = nums[nums.length - 1];
          tamano = tfTamano * escalaTm;
          break;
        }
        case 'Tj':
          if (pila.length && pila[pila.length - 1].t === 'str') mostrar(pila[pila.length - 1].v);
          break;
        case "'":
        case '"':
          forzarLinea = true;
          if (pila.length && pila[pila.length - 1].t === 'str') mostrar(pila[pila.length - 1].v);
          break;
        case 'TJ': {
          const arr = pila[pila.length - 1];
          if (arr && arr.t === 'arr') {
            for (const it of arr.v) {
              if (it.t === 'str') mostrar(it.v);
              else if (it.t === 'num') {
                px -= (it.v / 1000) * tamano; // ajuste de kerning/espaciado
                if (it.v < -250) espacio();
              }
            }
          }
          break;
        }
        case 'Td':
        case 'TD':
          if (nums.length >= 2) mover(lx + nums[0] * escalaTm, ly + nums[1] * escalaTm);
          break;
        case 'Tm':
          if (nums.length >= 6) {
            escalaTm = Math.abs(nums[0]) || Math.abs(nums[3]) || 1;
            tamano = tfTamano * escalaTm;
            mover(nums[4], nums[5]);
          }
          break;
        case 'T*':
          forzarLinea = true;
          break;
        default:
      }
      pila = [];
    }
  }
  return salida;
}

// ---------------------------------------------------------------------------
// Páginas
// ---------------------------------------------------------------------------
function paginasEnOrden(objetos) {
  const out = [];
  const visto = new Set();
  const raiz = (() => {
    for (const [, o] of objetos) {
      if (/\/Type\s*\/Catalog/.test(o.dict)) return ref(o.dict, '/Pages');
    }
    return null;
  })();

  const recorrer = (num, heredado) => {
    if (num === null || visto.has(num) || !objetos.get(num)) return;
    visto.add(num);
    const d = objetos.get(num).dict;
    const recursos = bloque(d, '/Resources') || (ref(d, '/Resources') ? objetos.get(ref(d, '/Resources')).dict : null) || heredado;
    if (/\/Type\s*\/Pages/.test(d)) {
      const kids = /\/Kids\s*\[([^\]]*)\]/.exec(d);
      if (kids) for (const k of kids[1].matchAll(/(\d+)\s+\d+\s+R/g)) recorrer(Number(k[1]), recursos);
    } else if (/\/Type\s*\/Page\b/.test(d)) {
      out.push({ num, dict: d, recursos });
    }
  };
  recorrer(raiz, null);
  if (!out.length) {
    [...objetos.entries()]
      .filter(([, o]) => /\/Type\s*\/Page\b/.test(o.dict))
      .sort((a, b) => a[0] - b[0])
      .forEach(([num, o]) => out.push({ num, dict: o.dict, recursos: bloque(o.dict, '/Resources') }));
  }
  return out;
}

function fuentesDePagina(objetos, recursos, cache) {
  const fuentes = {};
  if (!recursos) return fuentes;
  let d = bloque(recursos, '/Font');
  const rf = ref(recursos, '/Font');
  if (!d && rf && objetos.get(rf)) d = objetos.get(rf).dict;
  if (!d) return fuentes;
  for (const m of d.matchAll(/(\/[^\s/\[\]()<>]+)\s+(\d+)\s+\d+\s+R/g)) {
    const n = Number(m[2]);
    if (!cache.has(n)) cache.set(n, crearFuente(objetos, n));
    fuentes[m[1]] = cache.get(n);
  }
  return fuentes;
}

function contenidoDePagina(objetos, dict) {
  const partes = [];
  const arr = /\/Contents\s*\[([^\]]*)\]/.exec(dict);
  const refs = arr ? [...arr[1].matchAll(/(\d+)\s+\d+\s+R/g)].map((x) => Number(x[1])) : [ref(dict, '/Contents')].filter(Boolean);
  for (const n of refs) {
    const o = objetos.get(n);
    if (o && o.stream) partes.push(o.stream);
  }
  return Buffer.concat(partes.flatMap((p) => [p, Buffer.from('\n')]));
}

/** Imágenes "de contenido" (descarta íconos/adornos muy pequeños). */
function contarImagenes(objetos) {
  let n = 0;
  for (const [, o] of objetos) {
    if (!/\/Subtype\s*\/Image/.test(o.dict)) continue;
    const w = Number((/\/Width\s+(\d+)/.exec(o.dict) || [])[1]) || 0;
    const h = Number((/\/Height\s+(\d+)/.exec(o.dict) || [])[1]) || 0;
    if (w >= 120 && h >= 120) n++;
  }
  return n;
}

function limpiar(texto) {
  return texto
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function suficiente(texto) {
  const sinEspacios = texto.replace(/\s/g, '');
  if (sinEspacios.length < MIN_CARACTERES) return false;
  const legibles = [...sinEspacios].filter((ch) => /[\x21-\x7E -ɏ‐-•€]/.test(ch)).length;
  return legibles / sinEspacios.length >= MIN_PROPORCION_LEGIBLE;
}

/**
 * @param {Buffer} buf  contenido del PDF
 * @returns {{texto:string, paginas:number, imagenes:number, suficiente:boolean}}
 */
function extraerTexto(buf) {
  let objetos;
  try {
    objetos = leerObjetos(buf);
  } catch (e) {
    return { texto: '', paginas: 0, imagenes: 0, suficiente: false };
  }
  const cache = new Map();
  const paginas = paginasEnOrden(objetos);
  const partes = [];
  paginas.forEach((p, idx) => {
    try {
      const fuentes = fuentesDePagina(objetos, p.recursos, cache);
      const t = limpiar(textoDeContenido(contenidoDePagina(objetos, p.dict), fuentes));
      if (t) partes.push(paginas.length > 1 ? `[Página ${idx + 1}]\n${t}` : t);
    } catch (e) {
      /* una página ilegible no impide leer las demás */
    }
  });
  const texto = partes.join('\n\n');
  return { texto, paginas: paginas.length, imagenes: contarImagenes(objetos), suficiente: suficiente(texto) };
}

module.exports = { extraerTexto, parsearCMap, suficiente, MIN_CARACTERES };
