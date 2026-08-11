'use strict';

const fs = require('fs');
const path = require('path');
const reportes = require('./reportes');

const RAIZ = path.resolve(__dirname, '..', '..');

/**
 * Descubrimiento automático. Ninguna lista manual de tests: se escanea el
 * filesystem siguiendo la convención del framework:
 *   - módulo = workspace del package.json raíz que tenga tests/ con *.test.js
 *   - caso   = cada archivo *.test.js (su nombre = nombre descriptivo del caso)
 * Si mañana aparece un archivo nuevo en tests/, aparece solo (se re-escanea en
 * cada pedido del árbol).
 */
function workspaces() {
  try {
    return JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8')).workspaces || [];
  } catch (e) {
    return [];
  }
}

function archivosTest(modulo) {
  const base = path.join(RAIZ, modulo, 'tests');
  const out = [];
  const walk = (d) => {
    for (const e of listar(d)) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.test.js')) {
        out.push(path.relative(path.join(RAIZ, modulo), p).split(path.sep).join('/'));
      }
    }
  };
  walk(base);
  return out.sort();
}

function listar(d) {
  try {
    return fs.readdirSync(d, { withFileTypes: true });
  } catch (e) {
    return [];
  }
}

function modulos() {
  return workspaces()
    .map((w) => w.replace(/\/+$/, ''))
    .filter((w) => fs.existsSync(path.join(RAIZ, w, 'tests')) && archivosTest(w).length > 0);
}

/**
 * Metadata de organización del módulo (Sección/Categoría/Descripción por
 * caso) — `<modulo>/data/organizacion-tests.js`. Opcional: un módulo sin este
 * archivo simplemente no agrupa nada (mismo criterio tolerante que el resto
 * del descubridor).
 *
 * Se invalida el cache de `require` ANTES de cada carga: el anfitrión es un
 * proceso long-lived (no se reinicia por request), así que sin esto Node
 * serviría para siempre la primera versión leída del archivo, contradiciendo
 * el descubrimiento "en vivo" del resto de este módulo (ver comentario de
 * `archivosTest`) — un test/sección/descripción nueva no aparecería en el
 * Panel hasta reiniciar el servidor.
 */
function cargarOrganizacion(modulo) {
  const ruta = path.join(RAIZ, modulo, 'data', 'organizacion-tests.js');
  try {
    const resuelta = require.resolve(ruta);
    delete require.cache[resuelta];
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(resuelta);
  } catch (e) {
    return {};
  }
}

/** Árbol Módulo → Sección → Categoría → Caso, con el descriptor `run` de cada nodo. */
function arbol() {
  return { modulos: modulos().map(nodoModulo) };
}

function nodoModulo(modulo) {
  const estados = reportes.estadosPorCaso(modulo);
  const organizacion = cargarOrganizacion(modulo);
  const casos = archivosTest(modulo).map((rel) => {
    const nombre = path.basename(rel).replace(/\.test\.js$/, '');
    const meta = organizacion[nombre];
    return {
      id: nombre,
      nombre,
      tipo: 'caso',
      modulo,
      ruta: `${modulo}/${rel}`,
      run: { tipo: 'caso', modulo, target: rel },
      estado: (estados[nombre] || {}).estado || 'sin-ejecutar',
      seccion: meta ? meta.seccion : null,
      categoria: meta ? meta.categoria : null,
      descripcion: meta ? meta.descripcion : null,
    };
  });

  // Agrupación por SECCIÓN de la app (Requisiciones, Solicitudes, …) y luego
  // por CATEGORÍA (Agregar, Crear, Compartir, Consultar, Editar, Otros) —
  // declarada en `organizacion-tests.js`, no derivada del nombre. Un caso SIN
  // esa metadata es un test de FLUJO (login, navegación, etc.): queda fuera
  // del árbol del Panel a propósito, sigue existiendo y siendo ejecutable.
  const conSeccion = casos.filter((c) => c.seccion && c.categoria);

  const secciones = {};
  for (const c of conSeccion) {
    secciones[c.seccion] = secciones[c.seccion] || {};
    secciones[c.seccion][c.categoria] = secciones[c.seccion][c.categoria] || [];
    secciones[c.seccion][c.categoria].push(c);
  }

  const hijos = Object.keys(secciones)
    .sort()
    .map((nombreSeccion) => {
      const categorias = secciones[nombreSeccion];
      const hijosCategoria = Object.keys(categorias)
        .sort()
        .map((nombreCategoria) => {
          const casosCategoria = categorias[nombreCategoria];
          const runCategoria = {
            tipo: 'carpeta',
            modulo,
            target: `tests/{${casosCategoria.map((c) => c.nombre).join(',')}}.test.js`,
          };
          // Cada caso conoce el `run` de SU categoría (para el botón
          // "Ejecutar carpeta" del detalle: ya no se puede recomputar por
          // prefijo del nombre, la agrupación es explícita).
          for (const c of casosCategoria) {
            c.grupoRun = runCategoria;
            c.grupoNombre = nombreCategoria;
          }
          return {
            id: `${modulo}/${nombreSeccion}/${nombreCategoria}`,
            nombre: nombreCategoria,
            tipo: 'categoria',
            modulo,
            run: runCategoria,
            hijos: casosCategoria,
          };
        });
      const casosSeccion = Object.values(categorias).flat();
      return {
        id: `${modulo}/${nombreSeccion}`,
        nombre: nombreSeccion,
        tipo: 'seccion',
        modulo,
        run: {
          tipo: 'carpeta',
          modulo,
          target: `tests/{${casosSeccion.map((c) => c.nombre).join(',')}}.test.js`,
        },
        hijos: hijosCategoria,
      };
    });

  return {
    id: modulo,
    nombre: modulo.charAt(0).toUpperCase() + modulo.slice(1),
    tipo: 'modulo',
    modulo,
    run: { tipo: 'modulo', modulo },
    hijos,
  };
}

module.exports = { arbol, modulos, archivosTest, RAIZ };
