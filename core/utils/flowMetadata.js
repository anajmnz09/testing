/**
 * Metadata EFECTIVA de los casos de un flujo = lo que el CÓDIGO demuestra + la metadata mínima
 * (`<modulo>/data/flujo-tests.js`) con lo que el código no puede saber.
 *
 *  produces  → se DERIVA del código (`flowContext.publish/update('tipo')`, ver `flowScanner.js`).
 *              La metadata ya no necesita repetirlo. Si igual lo declara (forma antigua), debe
 *              COINCIDIR con el código: si no, es un ERROR de plan (nunca se elige uno en silencio).
 *  orden     → posición del test en la secuencia de transformación de una entidad
 *              (`orden: { solicitud: 20 }` o la forma antigua `produces: [{ tipo, orden }]`).
 *              El código no puede saberlo: sigue en la metadata. Debe corresponder a un tipo
 *              que el test realmente produce.
 *  requires  → se une, sin duplicar ni elegir en silencio:
 *                A. lecturas tipadas del código (`flowContext.get('solicitud')`) → `{ tipo }` (ordena)
 *                S. ESTRUCTURA: la clave llega a un localizador de un Page Object con `ENTIDAD_FLUJO`
 *                   (`flowEstructura.js`) → `{ tipo, clave, campo }` sin declarar nada en el test
 *                F. CAMPOS SELECCIONABLES del formulario (`flowCampos.js`): un dropdown cuyo label coincide con una entidad
 *                   conocida (contratos ENTIDAD_FLUJO) → `{ tipo }` (ordena; sin clave, no enlaza valores). Cede ante A/S/B/C
 *                B. claves declaradas en el código con entidad+campo (`registrarCaso` / `ESTRATEGIAS`)
 *                C. `requires` de la metadata (forma antigua, transición)
 *              S, B y C se tratan igual en el planner. Jerarquía: estructura → declaración mínima →
 *              no determinado. Una declaración B/C que la estructura ya demuestra es REDUNDANTE (se informa
 *              en `derivado[caso].redundantes`; el contrato exige quitarla). Una contradicción (misma clave con otra
 *              entidad/campo; entidad declarada distinta de la que el código lee) o una declaración
 *              inválida es un ERROR de plan. Lo que el código no demuestra NO crea dependencia.
 *
 * Si el código usa `flowContext` de una forma que no se puede determinar estáticamente (tipo
 * dinámico, alias…) NO se deriva nada: se usa lo que declare la metadata y se avisa; sin metadata,
 * el test queda sin `produces` y se avisa. Función pura salvo por la lectura del test (inyectable).
 */
const { escanearArchivo } = require('./flowScanner');

const tiposDeclarados = (meta) => (meta.produces || []).map((p) => (typeof p === 'string' ? p : p.tipo));

/** orden declarado por tipo: `orden: { tipo: n }` y/o la forma antigua `produces: [{ tipo, orden }]`. */
function ordenesDeclarados(meta) {
  const out = { ...(meta.orden || {}) };
  for (const p of meta.produces || []) if (typeof p === 'object' && typeof p.orden === 'number') out[p.tipo] = p.orden;
  return out;
}

/**
 * Une los requires de las tres fuentes (A lecturas tipadas, B declaradas en el código, C metadata).
 * @returns {{ requires: Array<{tipo:string, clave?:string, campo?:string, auto?:false}>, errores: string[], redundantes: string[] }}
 */
function unirRequires(caso, esc, deMetadata) {
  const errores = [];
  const redundantes = [];
  const porClave = new Map(); // clave -> { tipo, clave, campo, auto?, origen }
  const declarar = (d, origen) => {
    const previo = porClave.get(d.clave);
    if (previo && previo.origen === 'estructura' && origen !== 'estructura' && previo.tipo === d.tipo && previo.campo === d.campo && d.auto !== false) {
      redundantes.push(`"${caso}": la clave "${d.clave}" ← ${d.tipo}.${d.campo} declarada en ${origen} ya la demuestra la estructura (${previo.via}).`);
      return;
    }
    if (previo && (previo.tipo !== d.tipo || previo.campo !== d.campo)) {
      errores.push(
        `Contradicción de requires en "${caso}": la clave "${d.clave}" se declara como ${previo.tipo}.${previo.campo} (${previo.origen}) y como ${d.tipo}.${d.campo} (${origen}).`
      );
      return;
    }
    if (!previo) porClave.set(d.clave, { tipo: d.tipo, clave: d.clave, campo: d.campo, ...(d.auto === false ? { auto: false } : {}), origen, via: d.via });
    else if (d.auto === false) previo.auto = false;
  };
  for (const i of esc.invalidas) errores.push(`"${caso}": ${i.motivo} (línea ${i.linea}).`);
  for (const d of esc.estructurales || []) declarar({ tipo: d.entidad, clave: d.clave, campo: d.campo, via: d.via }, 'estructura');
  for (const d of esc.declaraciones) declarar({ tipo: d.entidad, clave: d.clave, campo: d.campo, auto: d.auto }, 'código');
  for (const r of deMetadata) {
    if (r.clave) declarar(r, 'flujo-tests.js');
  }
  const requires = [...porClave.values()].map(({ origen, via, ...r }) => r);
  const tiposDeclarados = new Set(requires.map((r) => r.tipo));
  for (const r of deMetadata) if (!r.clave) tiposDeclarados.add(r.tipo);

  const probados = esc.lecturas;
  if (probados.length) {
    for (const t of tiposDeclarados) {
      if (!probados.includes(t)) {
        errores.push(
          `Contradicción de requires en "${caso}": el código lee [${probados.join(', ')}] con flowContext pero se declara que consume "${t}". Corrija la declaración o el código.`
        );
      }
    }
  }
  for (const t of probados) {
    if (!tiposDeclarados.has(t)) requires.push({ tipo: t });
  }
  // F: un campo seleccionable de una entidad que el test ya consume (por lectura, clave o metadata) no suma nada
  for (const c of esc.campos || []) {
    if (!tiposDeclarados.has(c.tipo) && !probados.includes(c.tipo) && !requires.some((x) => x.tipo === c.tipo)) requires.push({ tipo: c.tipo });
  }
  for (const r of deMetadata) if (!r.clave && !requires.some((x) => x.tipo === r.tipo && !x.clave)) requires.push({ ...r });
  return { requires, errores, redundantes };
}

/**
 * @param {Array<{caso:string, modulo?:string, archivo?:string}>} seleccion
 * @param {Object} metadata  declarada, por caso (`flujo-tests.js` fusionado)
 * @param {{escanear?: (archivo:string)=>object}} [opts]
 * @returns {{ metadata:Object, derivado:Object, errores:string[], avisos:string[] }}
 */
function resolverMetadata(seleccion, metadata, { escanear = escanearArchivo } = {}) {
  const errores = [];
  const avisos = [];
  const efectiva = {};
  const derivado = {}; // caso -> { produces, indeterminado }

  for (const s of seleccion) {
    const meta = metadata[s.caso] || {};
    const declarados = tiposDeclarados(meta);
    const ordenes = ordenesDeclarados(meta);

    let esc = { produces: [], lecturas: [], claves: [], declaraciones: [], invalidas: [], indeterminado: [] };
    if (s.archivo) {
      try {
        esc = escanear(s.archivo);
      } catch (e) {
        esc = { produces: [], lecturas: [], claves: [], declaraciones: [], invalidas: [], indeterminado: [{ linea: 0, motivo: `no se pudo leer el test: ${e.message}` }] };
      }
    }
    esc = { lecturas: [], declaraciones: [], estructurales: [], campos: [], creaciones: [], ediciones: [], eliminaciones: [], confirmaciones: [], confirmables: [], exclusiones: [], invalidas: [], ...esc };
    // Un campo seleccionable de la MISMA entidad que el test crea/edita no es una dependencia (p. ej. "Departamento padre")
    const propias = new Set([...esc.creaciones, ...esc.ediciones].map((o) => o.entidad));
    esc = { ...esc, campos: (esc.campos || []).filter((c) => !propias.has(c.tipo)) };
    const req = unirRequires(s.caso, esc, meta.requires || []);
    errores.push(...req.errores);
    // Operaciones que demuestra la estructura. Una CREACIÓN de un tipo que el propio test también consume (por clave) es
    // un respaldo (p. ej. "si no hay documento, adjunta uno"): no convierte al test en productor, se publica si ocurre.
    const consume = new Set(req.requires.map((r) => r.tipo));
    // Abrir una creación/edición solo persiste si el test confirma el guardado de ESA entidad, cuando una capa común lo
    // confirma (`confirmables`); un creador `persiste` (el propio método guarda) no lo necesita.
    const confirmadas = new Set(esc.confirmaciones.map((c) => c.entidad));
    const cuenta = (o) => o.persiste || !esc.confirmables.includes(o.entidad) || confirmadas.has(o.entidad);
    const creaciones = [...new Set(esc.creaciones.filter(cuenta).map((c) => c.entidad))];
    const creadas = creaciones.filter((t) => !consume.has(t));
    const respaldo = creaciones.filter((t) => consume.has(t));
    const editadas = [...new Set(esc.ediciones.filter(cuenta).map((c) => c.entidad))];
    const eliminadas = [...new Set(esc.eliminaciones.map((c) => c.entidad))];
    derivado[s.caso] = {
      produces: esc.produces, indeterminado: esc.indeterminado, requires: req.requires, detectados: esc.lecturas,
      estructurales: esc.estructurales || [], campos: esc.campos, redundantes: req.redundantes, creadas, respaldo, editadas, eliminadas,
    };

    let produces;
    if (!s.archivo) {
      produces = declarados; // sin archivo no hay nada que escanear: solo lo declarado
    } else if (esc.indeterminado.length) {
      const donde = esc.indeterminado.map((x) => `línea ${x.linea}: ${x.motivo}`).join('; ');
      if (declarados.length) {
        produces = declarados;
        avisos.push(`"${s.caso}": su uso de flowContext no se puede determinar estáticamente (${donde}); se usa el produces declarado en flujo-tests.js.`);
      } else {
        produces = [];
        avisos.push(`"${s.caso}": su uso de flowContext no se puede determinar estáticamente (${donde}) y flujo-tests.js no declara produces: se trata como un test que no produce nada.`);
      }
    } else {
      produces = esc.produces;
      if (declarados.length || (meta.produces && meta.produces.length === 0 && esc.produces.length)) {
        const a = [...declarados].sort().join(', ');
        const b = [...new Set([...esc.produces, ...creadas, ...editadas])].sort().join(', ');
        if (a !== b) {
          errores.push(
            `Discrepancia de produces en "${s.caso}": el código publica [${b || 'nada'}] pero flujo-tests.js declara [${a || 'nada'}]. ` +
              'Corrija uno de los dos (el código es la fuente: la metadata ya no necesita declarar produces).'
          );
        }
      }
    }

    // Producción estructural: crear → produces; editar → transformación (requires + produces la misma entidad).
    // Una publicación explícita que no corresponde a ninguna operación estructural del test (ni a una entidad que
    // consume) contradice la estructura: error de plan. Sin operación estructural, la publicación explícita es la
    // fuente (p. ej. un cambio de etapa que crea un empleado: la estructura no lo demuestra).
    const estructurales = [...new Set([...creadas, ...editadas])];
    if (estructurales.length) {
      const permitidos = new Set([...estructurales, ...consume]);
      for (const t of esc.produces) {
        if (!permitidos.has(t)) {
          errores.push(
            `Contradicción de produces en "${s.caso}": su estructura crea/edita [${estructurales.join(', ')}] pero publica "${t}" con flowContext. ` +
              'Corrija la publicación o el contrato ENTIDAD_FLUJO.'
          );
        }
      }
    }
    produces = [...new Set([...produces, ...estructurales])];

    for (const tipo of Object.keys(ordenes)) {
      if (!produces.includes(tipo)) {
        errores.push(`"${s.caso}": flujo-tests.js declara un orden para "${tipo}" pero el test no lo produce (produce: [${produces.join(', ') || 'nada'}]).`);
      }
    }

    efectiva[s.caso] = {
      ...(req.requires.length ? { requires: req.requires } : {}),
      produces: produces.map((tipo) => (typeof ordenes[tipo] === 'number' ? { tipo, orden: ordenes[tipo] } : { tipo })),
      ...(eliminadas.length ? { elimina: eliminadas } : {}),
    };
  }
  return { metadata: efectiva, derivado, errores, avisos };
}

module.exports = { resolverMetadata, tiposDeclarados, ordenesDeclarados };
