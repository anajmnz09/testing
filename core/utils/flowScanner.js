/**
 * Escáner ESTÁTICO de un test: determina, SIN ejecutarlo (sin Selenium, sin Mocha, sin `require`
 * del test), qué entidades de flujo publica leyendo su código.
 *
 *   flowContext.publish('requisicion', …)  /  flowContext.update('solicitud', …)  →  produces
 *
 * Solo se acepta lo que el código DEMUESTRA: la llamada real (no un comentario ni un texto) con el
 * tipo como string literal. Cualquier otra forma (tipo dinámico, alias, desestructuración,
 * `flowContext['publish']`, `flowContext` pasado como valor) se reporta como INDETERMINADA: nunca se
 * adivina ni se ignora en silencio. Solo se inspecciona el archivo del test (no sigue `require`).
 *
 * REQUIRES. Se detectan SOLO dos hechos que el código demuestra:
 *   - lecturas tipadas con literal: `flowContext.get('solicitud')` / `flowContext.entidad('solicitud')`
 *     → el test consume una entidad de ese tipo (`lecturas`; son un requires con certeza).
 *   - claves declaradas con entidad y campo: `registrarCaso(CASO, [{ clave: 'codigo', entidad:
 *     'solicitud', campo: 'codigo' }])` y entradas de un `ESTRATEGIAS` de un Page Object que el test
 *     importa con ruta relativa (un salto) con `{ estrategia, entidad, campo }`
 *     → "la clave K se alimenta del campo C de la entidad E" (`declaraciones`).
 *   - la ESTRUCTURA (`estructurales`): la clave llega a `<listado>.abrirDetalle(…)` de un Page Object que
 *     declara `ENTIDAD_FLUJO` (ver `flowEstructura.js`; lo agrega `escanearArchivo`, no `escanearFuente`).
 * Una clave suelta (`'codigo'`) o un nombre/label NO dicen de qué entidad es: nunca se deduce.
 * Una declaración mal formada (entidad sin campo, valor no literal…) va a `invalidas`.
 *
 * Sin dependencias: un lexer mínimo enmascara comentarios, strings, plantillas y regex para que lo
 * que parece una llamada dentro de ellos no cuente.
 */
const fs = require('fs');
const path = require('path');

const ANTES_DE_REGEX = '(,=:[!&|?{};+-*%<>~^';
const PALABRAS_ANTES_DE_REGEX = /\b(return|typeof|case|in|of|new|delete|void|throw|else|do)\s*$/;

/**
 * Devuelve { sinComentarios, enmascarado }: dos cadenas del MISMO largo que el original.
 *  - sinComentarios: comentarios reemplazados por espacios (strings intactos).
 *  - enmascarado:    además, el contenido de strings/plantillas/regex reemplazado por espacios.
 */
function analizar(src) {
  const n = src.length;
  let sc = '';
  let em = '';
  let i = 0;
  let ultimo = ''; // último carácter significativo del código (para distinguir regex de división)
  const blanco = (ch) => (ch === '\n' ? '\n' : ' ');
  const emitir = (orig, mask) => {
    sc += orig;
    em += mask;
  };

  while (i < n) {
    const c = src[i];
    const d = src[i + 1];

    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') {
        emitir(' ', ' ');
        i += 1;
      }
      continue;
    }
    if (c === '/' && d === '*') {
      emitir('  ', '  ');
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        emitir(blanco(src[i]), blanco(src[i]));
        i += 1;
      }
      if (i < n) {
        emitir('  ', '  ');
        i += 2;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      emitir(c, c);
      i += 1;
      while (i < n && src[i] !== c && src[i] !== '\n') {
        if (src[i] === '\\' && i + 1 < n) {
          emitir(src[i] + src[i + 1], '  ');
          i += 2;
        } else {
          emitir(src[i], ' ');
          i += 1;
        }
      }
      if (i < n && src[i] === c) {
        emitir(c, c);
        i += 1;
      }
      ultimo = c;
      continue;
    }
    if (c === '`') {
      emitir(c, c);
      i += 1;
      while (i < n && src[i] !== '`') {
        if (src[i] === '\\' && i + 1 < n) {
          emitir(src[i] + src[i + 1], '  ');
          i += 2;
        } else if (src[i] === '$' && src[i + 1] === '{') {
          // expresión de la plantilla: se enmascara completa (llaves balanceadas)
          let prof = 0;
          while (i < n) {
            if (src[i] === '{') prof += 1;
            if (src[i] === '}') prof -= 1;
            emitir(src[i], blanco(src[i]));
            i += 1;
            if (prof === 0) break;
          }
        } else {
          emitir(src[i], blanco(src[i]));
          i += 1;
        }
      }
      if (i < n) {
        emitir('`', '`');
        i += 1;
      }
      ultimo = '`';
      continue;
    }
    if (c === '/') {
      const esRegex = ultimo === '' || ANTES_DE_REGEX.includes(ultimo) || PALABRAS_ANTES_DE_REGEX.test(sc);
      if (esRegex) {
        emitir('/', '/');
        i += 1;
        let enClase = false;
        while (i < n && src[i] !== '\n') {
          const ch = src[i];
          if (ch === '\\' && i + 1 < n) {
            emitir(ch + src[i + 1], '  ');
            i += 2;
            continue;
          }
          if (ch === '[') enClase = true;
          else if (ch === ']') enClase = false;
          else if (ch === '/' && !enClase) break;
          emitir(ch, ' ');
          i += 1;
        }
        if (i < n && src[i] === '/') {
          emitir('/', '/');
          i += 1;
        }
        ultimo = '/';
        continue;
      }
    }
    emitir(c, c);
    if (!/\s/.test(c)) ultimo = c;
    i += 1;
  }
  return { sinComentarios: sc, enmascarado: em };
}

const lineaDe = (src, idx) => src.slice(0, idx).split('\n').length;

/** Primer argumento como string literal simple ('tipo', "tipo" o `tipo` sin ${}) o null. */
function tipoLiteral(sinComentarios, desde) {
  const m = /^\s*(['"`])([A-Za-z0-9_-]+)\1\s*[,)]/.exec(sinComentarios.slice(desde, desde + 200));
  return m ? m[2] : null;
}

/** Divide `texto` por comas de primer nivel (respeta strings y (), [], {}). */
function partesDeNivel(texto) {
  const partes = [];
  let prof = 0;
  let comilla = '';
  let ini = 0;
  for (let i = 0; i < texto.length; i += 1) {
    const ch = texto[i];
    if (comilla) {
      if (ch === '\\') i += 1;
      else if (ch === comilla) comilla = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') comilla = ch;
    else if ('([{'.includes(ch)) prof += 1;
    else if (')]}'.includes(ch)) prof -= 1;
    else if (ch === ',' && prof === 0) {
      partes.push(texto.slice(ini, i));
      ini = i + 1;
    }
  }
  if (texto.slice(ini).trim()) partes.push(texto.slice(ini));
  return partes.map((p) => p.trim()).filter(Boolean);
}

/** Texto entre el delimitador de apertura en `desde` y su cierre balanceado (o null). */
function bloqueBalanceado(sc, desde) {
  const abre = sc[desde];
  const cierra = { '[': ']', '{': '}', '(': ')' }[abre];
  let prof = 0;
  let comilla = '';
  for (let i = desde; i < sc.length; i += 1) {
    const ch = sc[i];
    if (comilla) {
      if (ch === '\\') i += 1;
      else if (ch === comilla) comilla = '';
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') comilla = ch;
    else if (ch === abre) prof += 1;
    else if (ch === cierra) {
      prof -= 1;
      if (prof === 0) return sc.slice(desde + 1, i);
    }
  }
  return null;
}

const literal = (cuerpo, prop) => {
  const m = new RegExp(`(?:^|[\\s,{])${prop}\\s*:\\s*(['"])([^'"\\\\]*)\\1`).exec(cuerpo);
  return m ? m[2] : undefined;
};
const tienePropiedad = (cuerpo, prop) => new RegExp(`(?:^|[\\s,{])${prop}\\s*:`).test(cuerpo);

/**
 * Lee una entrada `{ ..., entidad, campo, auto }` (cuerpo del objeto). `clave` es la propia clave del
 * contexto (`clave:` en registrarCaso, el label en ESTRATEGIAS). Devuelve null si no declara entidad
 * ni campo (una entrada sin esas propiedades no dice nada del flujo).
 */
function leerDeclaracion(clave, cuerpo, linea) {
  const conEntidad = tienePropiedad(cuerpo, 'entidad');
  const conCampo = tienePropiedad(cuerpo, 'campo');
  if (!conEntidad && !conCampo) return null;
  const entidad = literal(cuerpo, 'entidad');
  const campo = literal(cuerpo, 'campo');
  const auto = /(?:^|[\s,{])auto\s*:\s*false\b/.test(cuerpo) ? false : undefined;
  if (!clave || !entidad || !campo) {
    return { invalida: { linea, motivo: `declaración de flujo incompleta o no literal en "${clave || '?'}" (se exige entidad y campo como strings literales)` } };
  }
  return { declaracion: { clave, entidad, campo, ...(auto === false ? { auto } : {}), linea } };
}

/** `registrarCaso(CASO, [ ... ])` con array literal: claves de entrada y declaraciones de flujo. */
function leerRegistrarCaso(src, sc, em) {
  const claves = [];
  const declaraciones = [];
  const invalidas = [];
  const re = /\bregistrarCaso\s*\(\s*[\w.]+\s*,\s*\[/g;
  let m;
  while ((m = re.exec(em))) {
    const inicio = m.index + m[0].length - 1;
    const cuerpo = bloqueBalanceado(sc, inicio);
    if (cuerpo === null) continue;
    const linea = lineaDe(src, m.index);
    for (const parte of partesDeNivel(cuerpo)) {
      const str = /^(['"`])([^'"`]*)\1$/.exec(parte);
      if (str) {
        claves.push(str[2]);
        continue;
      }
      if (!parte.startsWith('{')) continue;
      const clave = literal(parte, 'clave');
      if (clave) claves.push(clave);
      const r = leerDeclaracion(clave, parte, linea);
      if (r && r.declaracion) declaraciones.push(r.declaracion);
      else if (r && r.invalida) invalidas.push(r.invalida);
    }
  }
  return { claves, declaraciones, invalidas };
}

/** `ESTRATEGIAS = { Label: {estrategia, entidad, campo}, ... }` de un Page Object (texto sin comentarios). */
function leerEstrategias(src) {
  const { sinComentarios: sc, enmascarado: em } = analizar(src);
  const declaraciones = [];
  const invalidas = [];
  const re = /\bESTRATEGIAS\s*=\s*\{/g;
  let m;
  while ((m = re.exec(em))) {
    const cuerpo = bloqueBalanceado(sc, m.index + m[0].length - 1);
    if (cuerpo === null) continue;
    for (const parte of partesDeNivel(cuerpo)) {
      const e = /^(?:(['"])([^'"]+)\1|([^\s:'"]+))\s*:\s*(\{[\s\S]*\})$/.exec(parte);
      if (!e) continue;
      const r = leerDeclaracion(e[2] || e[3], e[4], lineaDe(src, m.index));
      if (r && r.declaracion) declaraciones.push(r.declaracion);
      else if (r && r.invalida) invalidas.push(r.invalida);
    }
  }
  return { declaraciones, invalidas, claves: [] };
}

/**
 * Campos que publica `flowContext.publish/update('tipo', { campo: …, … })` cuando el segundo argumento
 * es un objeto literal sin spread. Devuelve null si no se puede saber (variable, spread…): en ese caso
 * no se valida el `campo` de un requires contra esta publicación (se reporta como no determinado).
 */
function camposDelObjeto(sc, desdeDespuesDelTipo) {
  const resto = sc.slice(desdeDespuesDelTipo);
  const coma = /^\s*(['"`])[A-Za-z0-9_-]+\1\s*,\s*\{/.exec(resto);
  if (!coma) return null;
  const cuerpo = bloqueBalanceado(sc, desdeDespuesDelTipo + coma[0].length - 1);
  if (cuerpo === null) return null;
  const campos = [];
  for (const parte of partesDeNivel(cuerpo)) {
    if (parte.startsWith('...')) return null;
    const k = /^(?:(['"])([^'"]+)\1|([A-Za-z_$][\w$]*))\s*(?::|$)/.exec(parte);
    if (!k) return null;
    campos.push(k[2] || k[3]);
  }
  return campos;
}

/**
 * @returns {{ produces: string[], lecturas: string[], claves: string[],
 *             camposPublicados: Object<string, string[]|null>,
 *             declaraciones: Array<{clave:string, entidad:string, campo:string, auto?:false, linea:number, via?:string}>,
 *             estructurales: Array<{clave:string, entidad:string, campo:string, via:string, linea:number}>,
 *             invalidas: Array<{linea:number, motivo:string}>,
 *             indeterminado: Array<{linea:number, motivo:string}> }}
 */
function escanearFuente(src) {
  const { sinComentarios: sc, enmascarado: em } = analizar(src);
  const produces = [];
  const lecturas = [];
  const indeterminado = [];
  const agregar = (lista, t) => {
    if (!lista.includes(t)) lista.push(t);
  };

  // 1) llamadas reales publish/update (el match se hace sobre el código enmascarado)
  const reLlamada = /\bflowContext\s*\.\s*(publish|update)\s*\(/g;
  const camposPublicados = {};
  let m;
  while ((m = reLlamada.exec(em))) {
    const tipo = tipoLiteral(sc, m.index + m[0].length);
    if (tipo) {
      agregar(produces, tipo);
      const campos = camposDelObjeto(sc, m.index + m[0].length);
      if (campos === null || camposPublicados[tipo] === null) camposPublicados[tipo] = null;
      else camposPublicados[tipo] = [...new Set([...(camposPublicados[tipo] || []), ...campos])];
    } else indeterminado.push({ linea: lineaDe(src, m.index), motivo: `flowContext.${m[1]}(...) con un tipo que no es un string literal` });
  }

  // 2) lecturas explícitas (evidencia informativa)
  const reLectura = /\bflowContext\s*\.\s*(get|entidad)\s*\(/g;
  while ((m = reLectura.exec(em))) {
    const tipo = tipoLiteral(sc, m.index + m[0].length);
    if (tipo) agregar(lecturas, tipo);
  }

  // 3) formas que impiden demostrar lo que publica el test
  const reBracket = /\bflowContext\s*\[/g;
  while ((m = reBracket.exec(em))) {
    indeterminado.push({ linea: lineaDe(src, m.index), motivo: 'flowContext[...] (acceso por corchetes)' });
  }
  const reValor = /\bflowContext\b(?!\s*\.)(?!\s*\[)/g;
  while ((m = reValor.exec(em))) {
    const antes = em.slice(Math.max(0, m.index - 12), m.index);
    const esDeclaracion = /(const|let|var)\s+$/.test(antes) && /^\s*=\s*require\s*\(/.test(em.slice(m.index + m[0].length, m.index + m[0].length + 40));
    if (!esDeclaracion) indeterminado.push({ linea: lineaDe(src, m.index), motivo: 'flowContext usado como valor (alias o parámetro)' });
  }
  const reRequire = /(?:const|let|var)\s+(\w+)\s*=\s*require\(\s*['"][^'"]*flowContext['"]\s*\)/g;
  while ((m = reRequire.exec(sc))) {
    if (m[1] !== 'flowContext') indeterminado.push({ linea: lineaDe(src, m.index), motivo: `flowContext importado con otro nombre ("${m[1]}")` });
  }
  const reDestructurado = /\{[^}]*\b(?:publish|update)\b[^}]*\}\s*=\s*(?:require\(\s*['"][^'"]*flowContext['"]\s*\)|flowContext\b)/g;
  while ((m = reDestructurado.exec(sc))) {
    indeterminado.push({ linea: lineaDe(src, m.index), motivo: 'publish/update desestructurados de flowContext' });
  }
  const reInline = /require\(\s*['"][^'"]*flowContext['"]\s*\)\s*\.\s*(?:publish|update)\b/g;
  while ((m = reInline.exec(sc))) {
    indeterminado.push({ linea: lineaDe(src, m.index), motivo: 'publish/update llamados sobre require(...) en línea' });
  }

  const reg = leerRegistrarCaso(src, sc, em);
  return { produces, lecturas, camposPublicados, claves: reg.claves, declaraciones: reg.declaraciones, estructurales: [], creaciones: [], ediciones: [], eliminaciones: [], confirmaciones: [], confirmables: [], exclusiones: [], invalidas: reg.invalidas, indeterminado };
}

/** Rutas relativas que el test importa con `require('./...')` (un salto, sin seguir más). */
function importacionesRelativas(src, archivo) {
  const out = [];
  const re = /require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;
  let m;
  while ((m = re.exec(src))) {
    const base = path.resolve(path.dirname(archivo), m[1]);
    const cand = [base, `${base}.js`, path.join(base, 'index.js')].find((c) => fs.existsSync(c) && fs.statSync(c).isFile());
    if (cand) out.push(cand);
  }
  return out;
}

/**
 * Escanea el test y, si llama a `registrarCasoDesdeFormulario(CASO, <algo>.ESTRATEGIAS …)`, suma las
 * declaraciones `ESTRATEGIAS` de los Page Objects que importa con ruta relativa (un salto).
 */
function escanearArchivo(ruta) {
  const src = fs.readFileSync(ruta, 'utf8');
  const r = escanearFuente(src);
  if (/\bregistrarCasoDesdeFormulario\s*\(/.test(analizar(src).enmascarado)) {
    for (const imp of importacionesRelativas(src, ruta)) {
      if (!/\bESTRATEGIAS\s*=\s*\{/.test(fs.readFileSync(imp, 'utf8'))) continue;
      const e = leerEstrategias(fs.readFileSync(imp, 'utf8'));
      r.declaraciones.push(...e.declaraciones.map((d) => ({ ...d, via: 'ESTRATEGIAS' })));
      r.invalidas.push(...e.invalidas);
    }
  }
  // requires que demuestra la ESTRUCTURA (Page Object con ENTIDAD_FLUJO), ver flowEstructura.js
  const est = require('./flowEstructura').detectarEstructurales(ruta);
  r.estructurales = est.estructurales;
  r.creaciones = est.creaciones;
  r.ediciones = est.ediciones;
  r.eliminaciones = est.eliminaciones;
  r.confirmaciones = est.confirmaciones;
  r.confirmables = est.confirmables;
  r.exclusiones = est.exclusiones;
  r.invalidas.push(...est.invalidas);
  return r;
}

module.exports = { escanearFuente, escanearArchivo, analizar, leerEstrategias, bloqueBalanceado, partesDeNivel, literal };
