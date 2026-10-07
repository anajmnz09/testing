/**
 * Metadata de FLUJOS del módulo: SOLO lo que el código de los tests no puede demostrar (ver
 * GUIDELINES §12). Solo la lee `core/scripts/run-flow.js`; un test individual no la usa.
 *
 *  - `produces` se deriva del código (`flowContext.publish/update('tipo')`).
 *  - `requires` se detecta (`flowContext.get('tipo')`) o se declara junto a las claves del test
 *    (`registrarCaso(CASO, [{ clave, entidad, campo }])` / `ESTRATEGIAS`). No se repite aquí.
 *  - `orden: { tipo: n }`: posición del test en la secuencia de transformación de una entidad.
 *    Es regla de negocio (Paquete → Primera → Segunda → Tercera entrevista → Oferta): no está en
 *    ningún nombre ni dato del código. El planner encadena por este número aunque el usuario elija
 *    los casos desordenados. Saltos de 10 para poder intercalar pasos.
 */
module.exports = {
  'editar-paquete-beneficios-solicitud-empleo': { orden: { solicitud: 10 } },
  'cambiar-solicitud-primera-entrevista': { orden: { solicitud: 20 } },
  'cambiar-solicitud-segunda-entrevista': { orden: { solicitud: 30 } },
  'cambiar-solicitud-tercera-entrevista': { orden: { solicitud: 40 } },
  'cambiar-solicitud-oferta-empleo': { orden: { solicitud: 50 } },
};
