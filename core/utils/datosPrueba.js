/**
 * Fuente ÚNICA de datos de prueba dinámicos para el "modo automático" (cuando el
 * Panel / Execution Context NO dirigió un valor). Combina catálogos
 * (`core/data/datosPrueba.json`) con aleatoriedad, de modo que cada corrida
 * produce datos distintos pero verosímiles y relacionados con lo que prueba el
 * test (ej. el nombre de una requisición sale del Puesto elegido).
 *
 * Reglas de uso:
 *  - NUNCA se invoca para pisar un valor dirigido: el llamador aplica
 *    `testContext.get(caso, label) || generador(...)` (prioridad del Panel intacta).
 *  - Unicidad SOLO donde la app la exige (persona, correo, identificación,
 *    nombre de requisición/entidad): usan `tokenUnico()`/`personaUnica()`.
 *    Es "muy improbable que se repita" (tiempo + secuencia con arranque
 *    aleatorio por proceso), NO una garantía estricta entre corridas.
 *    Los textos libres (descripciones, comentarios) pueden repetirse entre corridas.
 *
 * REPRODUCIBLE: el azar sale de la semilla de la corrida (`bancoDatos.prng`, `DATOS_SEMILLA`), nunca de `Math.random`: misma semilla +
 * mismo orden de llamadas = misma persona, mismos textos. Lo único que NO se reproduce a propósito es el sufijo de UNICIDAD
 * (tiempo + secuencia): reproducir una corrida no debe chocar con los registros que la anterior dejó en la app.
 *
 * Los tests no lo importan directo: se accede por `utils/datos.js` (fuentes `persona.*`, `requisicion.nombre`, `texto.*`).
 * `crear({ random })` permite inyectar el azar (tests unitarios deterministas).
 */
const catalogos = require('../data/datosPrueba.json');
const bancoDatos = require('./bancoDatos');

const SIN_ACENTOS = new RegExp('[\u0300-\u036f]', 'g');

function sinAcentos(texto) {
  return String(texto).normalize('NFD').replace(SIN_ACENTOS, '');
}

function slug(texto) {
  return sinAcentos(texto).toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function crear({ random: inyectado, ahora = Date.now } = {}) {
  // Azar por defecto: flujo derivado de la semilla de la corrida (se crea al primer uso, no al cargar el módulo).
  let flujo = null;
  const random = inyectado || (() => (flujo || (flujo = bancoDatos.prng('datosPrueba')))());
  // Arranca en un valor derivado de la semilla: dos procesos con semillas distintas que empiecen en el
  // mismo instante no generan la misma secuencia.
  let secuencia = null;
  const siguiente = () => {
    if (secuencia === null) secuencia = Math.floor(random() * 1e6);
    secuencia += 1;
    return secuencia;
  };
  const usadas = new Set(); // personas ya emitidas en ESTE proceso

  const elegir = (lista) => lista[Math.floor(random() * lista.length)];
  const segundos = () => Math.floor(ahora() / 1000);

  /**
   * Token alfanumérico (por defecto 7 chars): tiempo en SEGUNDOS (base 36, ~1,9
   * años sin repetirse) + 2 chars de secuencia por llamada (1296 llamadas/seg
   * distintas en el proceso). "Muy improbable" que se repita entre corridas o
   * procesos; no es una garantía estricta.
   */
  function tokenUnico(largo = 7) {
    const fijo = segundos().toString(36).toUpperCase().slice(-(largo - 2));
    const seq = (siguiente() % 1296).toString(36).toUpperCase().padStart(2, '0');
    return `${fijo}${seq}`;
  }

  /**
   * Dígitos por llamada: (largo-2) del tiempo en segundos + 2 de secuencia
   * (100 llamadas/seg distintas en el proceso). Misma garantía "muy improbable".
   */
  function digitosUnicos(largo = 8) {
    const fijo = String(segundos() % 10 ** (largo - 2)).padStart(largo - 2, '0');
    return `${fijo}${String(siguiente() % 100).padStart(2, '0')}`;
  }

  /** Cédula RD de 11 dígitos, única por llamada. */
  function identificacion() {
    return `001${digitosUnicos(8)}`;
  }

  /**
   * Persona con nombre completo que no se repite dentro del proceso. Combinaciones
   * posibles: nombres × nombres × apellidos × apellidos (~1.6M), así que dos
   * corridas distintas colisionan con probabilidad despreciable; el correo y la
   * identificación llevan además un token temporal (únicos por construcción).
   */
  function personaUnica() {
    let p;
    for (let i = 0; i < 50; i++) {
      p = {
        primerNombre: elegir(catalogos.nombres),
        segundoNombre: elegir(catalogos.nombres),
        primerApellido: elegir(catalogos.apellidos),
        segundoApellido: elegir(catalogos.apellidos),
      };
      const clave = Object.values(p).join('|');
      if (!usadas.has(clave)) {
        usadas.add(clave);
        break;
      }
    }
    return p;
  }

  /** Correo único derivado de la persona (relacionado con su nombre). */
  function correo(persona, dominio = 'camsoft.test') {
    return `${slug(persona.primerNombre)}.${slug(persona.primerApellido)}.${tokenUnico(7).toLowerCase()}@${dominio}`;
  }

  /** Celular de 10 dígitos (solo dígitos: los editores enmascarados los formatean). */
  function celular() {
    return `809${digitosUnicos(7)}`;
  }

  function rellenar(plantilla, { puesto, tema }) {
    return plantilla.replace('{puesto}', puesto).replace('{tema}', tema.toLowerCase());
  }

  /**
   * Nombre de requisición: "<Puesto> - <Tema> <TOKEN>" (único; Puesto = el del
   * test). Acotado a `maxLargo` (confirmado en vivo: un nombre de 61 caracteres
   * hace fallar el Guardar con "Error en el sistema"; el viejo medía ~36). Si no
   * cabe con el tema, se omite el tema; si aún no cabe, se recorta el puesto —
   * el token único nunca se recorta.
   */
  function nombreRequisicion(puesto, maxLargo = 45) {
    const base = String(puesto || '').trim() || catalogos.puestoGenerico;
    const token = tokenUnico(7);
    const conTema = ` - ${elegir(catalogos.temasProyecto)} ${token}`;
    const sinTema = ` - ${token}`;
    const sufijo = base.length + conTema.length <= maxLargo ? conTema : sinTema;
    return `${base.slice(0, Math.max(1, maxLargo - sufijo.length)).trim()}${sufijo}`;
  }

  /**
   * Texto libre coherente con el contexto del test (NO único).
   * @param {'requisitos'|'responsabilidades'|'descripcion'|'comentario'} tipo
   * @param {{puesto?: string}} [contexto]
   */
  function texto(tipo, { puesto } = {}) {
    const tema = elegir(catalogos.temasProyecto);
    if (!puesto) {
      const lista = catalogos.plantillas[tipo === 'comentario' ? 'comentarioGenerico' : tipo];
      return rellenar(elegir(lista), { puesto: catalogos.puestoGenerico, tema });
    }
    return rellenar(elegir(catalogos.plantillas[tipo]), { puesto, tema });
  }

  return { elegir, tokenUnico, digitosUnicos, identificacion, personaUnica, correo, celular, nombreRequisicion, texto };
}

module.exports = { crear, ...crear(), sinAcentos, slug };
