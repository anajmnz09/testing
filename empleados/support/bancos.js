/**
 * Bancos de texto del módulo Empleados (campos `input` de texto / `textarea`). Solo los DATOS: el
 * mecanismo (selección determinista por semilla, combinación de categorías, log) es del Core
 * (`@triple/core/utils/bancoDatos`). Un test nuevo de este dominio los reutiliza así:
 *
 *   const bancos = require('../support/bancos');
 *   const lugar = bancos.educacion.valor(testContext.get(CASO, 'Lugar'), 'lugar');
 *
 * `valor(dirigido, clave)`: lo dirigido desde el Panel manda; si no hay, sale del banco. Para ampliar,
 * basta agregar opciones a una categoría (cada opción nueva multiplica las combinaciones) o un texto nuevo.
 */
const { definirBanco } = require('@triple/core/utils/bancoDatos');
const catalogos = require('@triple/core/data/datosPrueba.json');

// Nombres de institución que combinan con cualquiera de los tipos ("Liceo Gregorio Luperón", "Universidad Salomé Ureña").
const PROCERES = ['Juan Pablo Duarte', 'Gregorio Luperón', 'Salomé Ureña', 'María Trinidad Sánchez', 'Ulises Francisco Espaillat'];

const educacion = definirBanco('educacion', {
  categorias: {
    grado: ['Licenciatura', 'Técnico Superior', 'Maestría', 'Diplomado'],
    carrera: ['Administración de Empresas', 'Contabilidad', 'Ingeniería Industrial', 'Mercadeo', 'Derecho', 'Informática'],
    institucion: ['Universidad', 'Instituto', 'Liceo', 'Colegio'],
    nombre: PROCERES,
  },
  textos: {
    programa: '{grado} en {carrera}',
    lugar: '{institucion} {nombre}',
  },
});

const experiencia = definirBanco('experiencia', {
  categorias: {
    cargo: ['Analista', 'Asistente', 'Supervisor', 'Coordinador', 'Encargado'],
    area: ['Ventas', 'Contabilidad', 'Recursos Humanos', 'Logística', 'Servicio al Cliente'],
    tipo: ['Grupo', 'Inversiones', 'Comercial', 'Corporación'],
    nombre: ['Cibao', 'Ozama', 'del Caribe', 'Quisqueyana', 'Yaque'],
  },
  textos: {
    puesto: '{cargo} de {area}',
    lugar: '{tipo} {nombre}',
  },
});

const capacitacion = definirBanco('capacitacion', {
  categorias: {
    formato: ['Taller', 'Curso', 'Seminario', 'Diplomado'],
    tema: ['Liderazgo', 'Excel Avanzado', 'Servicio al Cliente', 'Seguridad Industrial', 'Gestión del Tiempo'],
    objetivo: ['Fortalecer las competencias', 'Actualizar los conocimientos', 'Mejorar el desempeño'],
    area: ['ventas', 'administración', 'operaciones'],
    centro: ['INFOTEP', 'Centro de Capacitación Empresarial', 'Instituto de Formación Gerencial', 'Academia de Negocios del Caribe'],
    titulo: ['Lic.', 'Ing.', 'Dra.', 'Licda.'],
    persona: catalogos.nombres,
    apellido: catalogos.apellidos,
  },
  textos: {
    nombre: '{formato} de {tema}',
    descripcion: '{objetivo} del personal de {area}.',
    centro: '{centro}',
    facilitador: '{titulo} {persona} {apellido}',
  },
});

const habilidad = definirBanco('habilidad', {
  categorias: {
    habilidad: ['Comunicación efectiva', 'Trabajo en equipo', 'Manejo de Excel', 'Negociación', 'Resolución de problemas', 'Atención al detalle'],
    nivel: ['básica', 'aplicada', 'avanzada'],
  },
  textos: { nombre: '{habilidad}', conNivel: '{habilidad} {nivel}' },
});

// Formulario "Crear Empleado" (texto libre de Datos básicos / Datos personales).
const datosEmpleado = definirBanco('datosEmpleado', {
  categorias: {
    dimension: ['Administrativa', 'Operativa', 'Comercial', 'Técnica'],
    canal: ['Recomendación interna', 'Portal de empleo', 'Feria laboral', 'Referido por un colaborador'],
    via: ['Calle', 'Avenida'],
    calle: ['Duarte', 'Mella', 'Las Palmas', 'Los Girasoles', 'Sánchez'],
    numero: ['12', '45', '108', '230'],
    persona: catalogos.nombres,
    apellido: catalogos.apellidos,
  },
  textos: {
    dimension: '{dimension}',
    referencia: '{canal}',
    calle: '{via} {calle} {numero}',
    contacto: '{persona} {apellido}',
  },
});

// Sección "Dependientes" del detalle de Empleado (campo "Discapacidad", texto libre). Nombres/apellidos/identificación salen de `persona.*`.
const dependiente = definirBanco('dependiente', {
  categorias: {
    tipo: ['Discapacidad visual', 'Discapacidad auditiva', 'Discapacidad motriz', 'Discapacidad del habla'],
    grado: ['leve', 'moderada', 'parcial'],
  },
  textos: { discapacidad: '{tipo} {grado}' },
});

// Sección "Herramientas" del detalle de Empleado (asignación de equipos / activos): "Descripción" y "Referencia".
const herramienta = definirBanco('herramienta', {
  categorias: {
    equipo: ['Laptop', 'Teléfono celular', 'Monitor', 'Carné de identificación', 'Llaves de oficina', 'Uniforme', 'Casco de seguridad'],
    detalle: ['de trabajo', 'corporativo', 'de reemplazo', 'asignado'],
    prefijo: ['ACT', 'EQP', 'HRR'],
    serie: ['0451', '1023', '2207', '3318', '4096'],
  },
  textos: { descripcion: '{equipo} {detalle}', referencia: '{prefijo}-{serie}' },
});

// Sección "Beneficios" (Recursos humanos) del detalle de Empleado. `tipo`: nombres de beneficio de ~10 clases (transporte, comida…)
// para elegir al azar (determinista por semilla); el catálogo real vive en Configuración > Beneficios, así que al asignar solo se
// usan los que existen allí (ver `BeneficioFormPage.elegirBeneficioDelCatalogo`). Ampliar = agregar un nombre a `tipo`.
const beneficio = definirBanco('beneficio', {
  categorias: {
    tipo: [
      'TRANSPORTE',
      'COMIDA',
      'COMBUSTIBLE',
      'VIATICO',
      'PARQUEO',
      'COMPENSACIÓN DE VEHÍCULO',
      'BONO POR DESEMPEÑO ANUAL',
      'INCENTIVO TRIMESTRAL',
      'INCENTIVO SEMESTRAL',
      'BONO DESEMPENO SEMESTRAL',
    ],
    motivo: [
      'Beneficio asignado según la política de la empresa',
      'Ajuste aprobado por Recursos Humanos',
      'Asignación por reclasificación del puesto',
      'Beneficio acordado en la oferta de contratación',
      'Reconocimiento al desempeño del período',
    ],
  },
  textos: { tipo: '{tipo}', comentario: '{motivo}' },
});

// Sección "Seguros" (Recursos humanos) del detalle de Empleado. `proveedor` y `plan`: nombres REALES de aseguradoras (ARS) de República
// Dominicana y de los planes de salud, para elegir al azar (determinista por semilla). Ambos son catálogos de Configuración: al
// asignar solo se usan los que EXISTEN allí (`SeguroFormPage.elegirProveedorYPlan`); los demás se omiten y quedan en el log.
const seguro = definirBanco('seguro', {
  categorias: {
    proveedor: [
      'ARS Universal',
      'ARS Senasa',
      'ARS Humano',
      'ARS Palic',
      'ARS Futuro',
      'ARS Reservas',
      'ARS Monumental',
      'ARS Mapfre Salud',
      'ARS Yunen',
      'ARS Simag',
    ],
    plan: [
      'Plan Alpha',
      'Plan Absoluto',
      'Plan Absoluto Voluntariado',
      'Plan Exclusivo',
      'Plan Alpha Voluntariado',
      'Plan Máximo',
      'Plan Platinum Suplementario',
      'Plan Privado de Salud',
      'Plan Básico',
      'Plan Familiar',
    ],
    motivo: [
      'Cobertura médica asignada según la política de la empresa',
      'Afiliación al seguro de salud en el ingreso del colaborador',
      'Cambio de plan aprobado por Recursos Humanos',
      'Seguro complementario acordado en la contratación',
      'Renovación anual de la cobertura de salud',
    ],
  },
  textos: { proveedor: '{proveedor}', plan: '{plan}', comentario: '{motivo}' },
});

module.exports = { educacion, experiencia, capacitacion, habilidad, datosEmpleado, dependiente, herramienta, beneficio, seguro };
