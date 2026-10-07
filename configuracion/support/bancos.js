/**
 * Bancos de texto del módulo Configuración (campos `textarea` / `input` de texto libre de los formularios
 * de catálogos). Solo los DATOS; el mecanismo es `@triple/core/utils/bancoDatos` (ver su cabecera y
 * `empleados/support/bancos.js` para el uso: `bancos.puesto.valor(testContext.get(CASO, 'Descripción'), 'descripcion')`).
 * Los NOMBRES de entidad que la app exige únicos siguen armándose con `nombreUnicoQA`.
 */
const { definirBanco } = require('@triple/core/utils/bancoDatos');

const AREAS = ['ventas', 'contabilidad', 'recursos humanos', 'logística', 'servicio al cliente'];

const puesto = definirBanco('puesto', {
  categorias: {
    funcion: ['Dar seguimiento a las operaciones', 'Coordinar las actividades', 'Preparar los informes', 'Atender las solicitudes internas'],
    area: AREAS,
    requisito: ['Experiencia previa de dos años', 'Conocimientos de Excel', 'Buena comunicación oral y escrita', 'Disponibilidad de horario'],
    nivel: ['técnico', 'universitario', 'profesional'],
    responsabilidad: ['Cumplir con las metas asignadas', 'Mantener los registros al día', 'Reportar los resultados semanalmente', 'Apoyar al equipo en los cierres'],
  },
  textos: {
    descripcion: '{funcion} del área de {area}.',
    requisitos: '{requisito}; nivel {nivel} completado.',
    responsabilidades: '{responsabilidad} en el área de {area}.',
  },
});

const sucursal = definirBanco('sucursal', {
  categorias: {
    via: ['Calle', 'Avenida'],
    nombre: ['Winston Churchill', 'Abraham Lincoln', 'Independencia', 'Las Carreras', '27 de Febrero'],
    numero: ['15', '42', '120', '305'],
    sector: ['Piantini', 'Naco', 'Los Jardines', 'Gazcue', 'Bella Vista'],
    ciudad: ['Santo Domingo', 'Santiago', 'La Vega'],
  },
  textos: { direccion: '{via} {nombre} No. {numero}, {sector}, {ciudad}.' },
});

const cuentaContable = definirBanco('cuentaContable', {
  categorias: {
    tipo: ['Cuenta de gastos', 'Cuenta de ingresos', 'Cuenta por pagar', 'Cuenta por cobrar'],
    concepto: ['de nómina', 'de beneficios al personal', 'de prestaciones laborales', 'de servicios profesionales'],
  },
  textos: { descripcion: '{tipo} {concepto}.' },
});

module.exports = { puesto, sucursal, cuentaContable };
