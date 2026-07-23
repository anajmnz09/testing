/**
 * Datos del módulo Reclutamiento para la carga de documentos de una requisición.
 *
 * Las clasificaciones son las opciones REALES del dropdown "Seleccione una
 * clasificacion" del popup "Importar Documentos", verificadas contra la app
 * (ver metadata/screens). Se listan acá —no en el test— para que:
 *   - el caso importe "todas" sin hardcodear la lista en el spec;
 *   - el usuario pueda dirigir la prueba a un subconjunto desde el Execution
 *     Context sin tocar código.
 */

const CLASIFICACIONES = ['CV|Currículum Vitae', 'Identificación', 'Cuestionario', 'Otro'];

module.exports = {
  CLASIFICACIONES,
  // Selectores propios de esta pantalla (los genéricos viven en los componentes
  // del core). Se centralizan acá para que un cambio del DOM se arregle una vez.
  SELECTORES: {
    panel: '.documentoList',
    filaDocumento: '.documentoList .documentoContent',
    nombreEnFila: 'b',
    botonImportarArchivos: 'importar archivos',
    // el popup "Importar Documentos" se identifica por su dropdown de clasificación
    popupContiene: '.clasificacionSelecBox',
    dropdownClasificacion: '.clasificacionSelecBox',
    // input de archivo oculto dentro del overlay del popup
    inputArchivo: '.dx-overlay-wrapper input[type="file"], .dx-popup-wrapper input[type="file"]',
  },
};
