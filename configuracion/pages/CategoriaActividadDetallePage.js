const { ConfiguracionEntidadDetallePage } = require('@triple/core');

/**
 * Pantalla de UN registro de "Categoría Actividades" (Configuración >
 * Nómina > Categoría de actividades — el destino real está titulado
 * "Categoría Actividades", mismo patrón que "Proveedores de seguros" →
 * "Proveedor de seguros"). Toda la mecánica genérica vive en
 * `ConfiguracionEntidadDetallePage` (core) — acá solo el mapeo PROPIO.
 *
 * Mapeo verificado con Selenium Headless (metadata real, `screenInspector`):
 *  - "Categorías": texto libre REQUERIDO — pese al plural, es el
 *    identificador de la fila (campo `descripcion` en el DOM).
 *  - "Estado": selectbox REQUERIDO, llega con un valor preseleccionado
 *    (`directSelect`).
 *  - "Precio Hora"/"Hora Jornada": numberbox REQUERIDOS. Llegan con "0" por
 *    defecto, que la app rechaza como si estuvieran vacíos (mismo hallazgo
 *    ya documentado para "Tarifa" de Planes de seguro) — el test SIEMPRE
 *    los completa explícito.
 *  - "Usar Rate": switch OPCIONAL.
 *  - "Rate": numberbox OPCIONAL (probablemente solo relevante si "Usar
 *    Rate" está encendido — no se fuerza ninguna relación entre ambos acá).
 *  - Sin tabs, sin secciones a ignorar.
 */
const ESTRATEGIAS = {
  Categorías: 'text',
  Estado: 'directSelect',
  'Precio Hora': 'text',
  'Usar Rate': 'switch',
  'Hora Jornada': 'text',
  Rate: 'text',
};

class CategoriaActividadDetallePage extends ConfiguracionEntidadDetallePage {
  static get ESTRATEGIAS() {
    return ESTRATEGIAS;
  }

  static get NOMBRE_ENTIDAD() {
    return 'categoria-actividad';
  }
}

module.exports = CategoriaActividadDetallePage;
