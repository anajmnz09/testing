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

module.exports = { educacion, experiencia, capacitacion, habilidad, datosEmpleado };
