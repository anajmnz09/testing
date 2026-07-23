'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const descubridor = require('./descubridor');
const reportes = require('./reportes');
const codigo = require('./codigo');
const contexto = require('./contexto');
const lanzador = require('./lanzador');

const WEB = path.join(__dirname, '..', 'web');
const PUERTO = Number(process.env.PANEL_PORT) || 4599;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.log': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.mp4': 'video/mp4',
  '.pdf': 'application/pdf',
};

function json(res, obj, cod = 200) {
  res.writeHead(cod, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function servirArchivo(res, p) {
  const ext = path.extname(p).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}

function cuerpo(req) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(b || '{}'));
      } catch (e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  const q = Object.fromEntries(u.searchParams);
  const ruta = decodeURIComponent(u.pathname);
  try {
    // --- API (solo lectura, salvo ejecutar / guardar contexto) ---
    if (ruta === '/api/arbol') return json(res, descubridor.arbol());
    if (ruta === '/api/caso')
      return json(res, {
        ultima: reportes.ultimaDeCaso(q.modulo, q.caso),
        contexto: contexto.seccion(q.modulo, q.caso),
      });
    if (ruta === '/api/codigo') {
      const c = codigo.leer(q.ruta);
      return c === null ? json(res, { error: 'no-encontrado' }, 404) : json(res, { ruta: q.ruta, codigo: c });
    }
    if (ruta === '/api/historial') return json(res, reportes.historial(q.modulo));
    if (ruta === '/api/corrida') return json(res, reportes.detalleCorrida(q.modulo, q.runId));
    if (ruta === '/api/contexto' && req.method === 'GET') return json(res, contexto.seccion(q.modulo, q.caso));
    if (ruta === '/api/contexto' && req.method === 'POST') {
      const b = await cuerpo(req);
      return json(res, contexto.guardar(b.modulo, b.caso, b.valores || {}));
    }
    if (ruta === '/api/ejecutar' && req.method === 'POST') {
      const b = await cuerpo(req);
      return json(res, lanzador.ejecutar(b.run));
    }
    if (ruta === '/api/cancelar' && req.method === 'POST') return json(res, lanzador.cancelar());
    if (ruta === '/api/vivo') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write('\n');
      return lanzador.suscribir(res);
    }

    // --- Artefactos ya generados por el framework (solo lectura, con guardia) ---
    if (ruta.startsWith('/artefacto/')) {
      const parts = ruta.split('/').slice(2).map(decodeURIComponent);
      const modulo = parts.shift();
      const runId = parts.shift();
      const rel = parts.join('/');
      const p = reportes.rutaArtefacto(modulo, runId, rel);
      if (p) return servirArchivo(res, p);
      res.writeHead(404);
      return res.end('artefacto no encontrado');
    }

    // --- Estáticos del panel ---
    if (ruta === '/' || ruta === '') return servirArchivo(res, path.join(WEB, 'index.html'));
    if (ruta.startsWith('/estilos/') || ruta.startsWith('/js/') || ruta.startsWith('/web/')) {
      const rel = ruta.replace(/^\/web\//, '').replace(/^\//, '');
      const p = path.resolve(WEB, rel);
      if ((p === WEB || p.startsWith(WEB + path.sep)) && fs.existsSync(p) && fs.statSync(p).isFile()) {
        return servirArchivo(res, p);
      }
    }

    res.writeHead(404);
    res.end('no encontrado');
  } catch (err) {
    json(res, { error: String((err && err.message) || err) }, 500);
  }
});

// Solo localhost: el anfitrión puede lanzar procesos; nunca se expone en red.
server.listen(PUERTO, '127.0.0.1', () => {
  console.log(`Panel de control en http://127.0.0.1:${PUERTO}`);
});
