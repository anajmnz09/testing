/**
 * Capa COMÚN de publicación de entidades de flujo, dirigida por el contrato `ENTIDAD_FLUJO` del Page
 * Object / componente (la MISMA declaración que lee el escáner estático: una sola fuente).
 *
 *   creadores     abre la creación (`crear()`, `abrirAgregarX()`…): arma una creación pendiente que el
 *                 guardado confirmado de un formulario resuelve → `flowContext.publish(tipo, datos)`.
 *                 Con `persiste: true` el propio método persiste: publica al terminar, con la
 *                 referencia tomada de un argumento (`referenciaArg: '1.nombre'`, sufijo `:basename`).
 *                 Con `argumento` + `valor` solo cuenta cuando ese argumento es ese literal
 *                 (`agregarEducacionOExperiencia('Educación', …)`).
 *   editores      abre la edición de un registro existente: arma una edición pendiente →
 *                 `flowContext.update(tipo, datos)` al guardar.
 *   eliminadores  tras eliminar con éxito, `flowContext.invalidar(tipo)`: la entidad deja de estar
 *                 disponible para pasos posteriores.
 *   confirmadores métodos de un formulario compartido cuyo resultado `{ exito: true }` confirma el
 *                 guardado de ESA entidad (el contrato trae su `tipo`); los datos de referencia los da el método
 *                 `datos` (por defecto `_datosFlujo()`; `datos: null` = solo lo que aportó el creador), leídos
 *                 ANTES del método con `leer: 'antes'` o después. Sin operación pendiente no hacen nada.
 *
 * Es INERTE fuera de un flujo: sin `TRIPLE_FLOW_PLAN` no se envuelve ningún método, así que la
 * ejecución individual no cambia. Se invoca desde el constructor de `UiContext` (Page Objects y
 * componentes). Un test no necesita agregar ninguna línea.
 */
const flowContext = require('../context/flowContext');
const logger = require('./logger');

const MARCA = Symbol.for('triple.flow.instrumentado');
const instrumentadas = new WeakSet();

/** `ENTIDAD_FLUJO` normalizado a una lista de objetos. */
function contratosDe(Clase) {
  let c;
  try {
    c = Clase.ENTIDAD_FLUJO;
  } catch (e) {
    return []; // p. ej. la base de Configuración sin DetallePageClass: sin contrato
  }
  return (Array.isArray(c) ? c : c ? [c] : []).filter((x) => x && typeof x === 'object');
}

const entradas = (lista) => (lista || []).map((x) => (typeof x === 'string' ? { metodo: x } : x));

/** Valor de un argumento: '0', '1.nombre', '0:basename', '0:stem' (basename sin extensión). */
function valorArg(args, ruta) {
  if (ruta === undefined || ruta === null) return undefined;
  const [camino, transformacion] = String(ruta).split(':');
  const [i, ...props] = camino.split('.');
  let v = args[Number(i)];
  for (const p of props) v = v == null ? undefined : v[p];
  if (v === undefined || v === null || v === '') return undefined;
  v = String(v);
  const base = v.split(/[\\/]/).pop();
  // `:stem` = nombre sin extensión: la app puede renombrar el archivo (le agrega un sufijo), así que el nombre completo no sirve de referencia
  if (transformacion === 'stem') return base.replace(/\.[^.]+$/, '');
  return transformacion === 'basename' ? base : v;
}

/**
 * Envuelve `Clase.prototype[metodo]` con una capa. Cada clase concreta tiene SU propio wrapper (con las capas
 * de SU contrato, que puede traer el `tipo` de esa subclase); si el método venía envuelto por una clase
 * ancestra, se parte del método original, no del wrapper heredado.
 */
function envolver(Clase, metodo, hacer) {
  const propio = Object.prototype.hasOwnProperty.call(Clase.prototype, metodo) ? Clase.prototype[metodo] : null;
  if (propio && propio[MARCA]) {
    propio[MARCA].capas.push(hacer);
    return;
  }
  const heredado = Clase.prototype[metodo];
  if (typeof heredado !== 'function') return;
  const base = heredado[MARCA] ? heredado[MARCA].base : heredado;
  const capas = [hacer];
  const wrapper = async function (...args) {
    return capas.reduceRight((siguiente, capa) => (a) => capa(this, a, siguiente), (a) => base.apply(this, a))(args);
  };
  wrapper[MARCA] = { base, capas };
  Object.defineProperty(Clase.prototype, metodo, { value: wrapper, writable: true, configurable: true });
}

const exitoso = (r) => r !== false && !(r && typeof r === 'object' && r.exito === false);

function instrumentar(instancia) {
  if (!flowContext.activo()) return;
  const Clase = instancia.constructor;
  if (instrumentadas.has(Clase)) return;
  instrumentadas.add(Clase);

  for (const c of contratosDe(Clase)) {
    const tipo = c.tipo;
    if (tipo) {
      for (const e of entradas(c.creadores)) {
        envolver(Clase, e.metodo, async (self, args, siguiente) => {
          const r = await siguiente(args);
          if (e.argumento !== undefined && args[e.argumento] !== e.valor) return r;
          if (e.persiste) {
            const ref = valorArg(args, e.referenciaArg);
            if (ref && exitoso(r)) {
              flowContext.publish(tipo, { [c.referencia || 'nombre']: ref });
              logger.info(`flujo: "${tipo}" publicada por ${Clase.name}.${e.metodo} -> ${JSON.stringify({ [c.referencia || 'nombre']: ref })}`);
            }
          } else {
            const ref = valorArg(args, e.referenciaArg);
            flowContext.armar('crear', tipo, ref ? { [c.referencia || 'nombre']: ref } : undefined);
          }
          return r;
        });
      }
      for (const e of entradas(c.editores)) {
        envolver(Clase, e.metodo, async (self, args, siguiente) => {
          const r = await siguiente(args);
          flowContext.armar('editar', tipo);
          return r;
        });
      }
      for (const e of entradas(c.eliminadores)) {
        envolver(Clase, e.metodo, async (self, args, siguiente) => {
          const r = await siguiente(args);
          if (exitoso(r)) {
            flowContext.invalidar(tipo);
            logger.info(`flujo: "${tipo}" eliminada por ${Clase.name}.${e.metodo}: ya no está disponible para pasos posteriores`);
          }
          return r;
        });
      }
    }
    for (const e of entradas(c.confirmadores)) {
      envolver(Clase, e.metodo, async (self, args, siguiente) => {
        const pend = flowContext.pendiente();
        if (!pend || (c.tipo && pend.tipo !== c.tipo)) return siguiente(args); // no es una operación de ESTA entidad
        const proveedor = e.datos === null ? null : e.datos || '_datosFlujo';
        const leer = async () => {
          if (!proveedor || typeof self[proveedor] !== 'function') return null;
          try {
            return await self[proveedor]();
          } catch (err) {
            logger.warn(`flujo: ${Clase.name}.${proveedor} falló (${String(err.message || err).slice(0, 120)}); se publica solo lo que aportó el creador`);
            return null;
          }
        };
        if (e.capturar) {
          // Solo captura la referencia (p. ej. antes de que el formulario se cierre); la resuelve otro confirmador.
          const capturado = await leer();
          if (capturado) pend.datos = { ...pend.datos, ...capturado };
          pend.guardado = true; // se guardó: si el test nunca pide el resultado, flowHooks lo resuelve al pasar
          return siguiente(args);
        }
        const antes = e.leer === 'antes' ? await leer() : null;
        const r = await siguiente(args);
        if (flowContext.pendiente() === pend && r && r.exito === true) {
          const datos = e.leer === 'antes' ? antes : await leer();
          const publicado = flowContext.confirmar(datos);
          if (publicado) {
            logger.info(`flujo: "${pend.tipo}" ${pend.modo === 'editar' ? 'actualizada' : 'publicada'} al confirmar el guardado (${Clase.name}.${e.metodo}) -> ${JSON.stringify(flowContext.get(pend.tipo))}`);
          } else {
            logger.warn(`flujo: "${pend.tipo}" NO se publicó: ${Clase.name}.${e.metodo} confirmó el guardado pero no hay datos de referencia`);
          }
        }
        return r;
      });
    }
  }
}

module.exports = { instrumentar, valorArg, contratosDe };
