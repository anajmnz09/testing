/**
 * Valores QA por defecto (modo automático) para los campos de texto/fecha del
 * formulario "Crear Empleado" que NO tienen un "primer valor" razonable (a
 * diferencia de un selectbox, un campo de texto libre no tiene "primera opción"
 * — sin un valor explícito, `TextInputStrategy`/`DatePickerStrategy` no tocan el
 * control, ver `builtinStrategies.js`).
 *
 * Los valores salen del punto de acceso común del Core (`@triple/core/utils/datos`):
 * persona de catálogo (cambia en cada corrida, reproducible con `DATOS_SEMILLA`) e
 * Identificación/correo únicos por construcción, y los bancos del módulo. El llamador (`valoresSeccion` en `crear-empleado`)
 * sigue dando prioridad a lo dirigido desde el Panel.
 */
const datos = require('@triple/core/utils/datos');

// La persona vigente vive en el punto común: `datosBasicosQA()` empieza una nueva y los correos de
// `datosPersonalesQA()` se derivan de ella (coherencia dentro del test).
function datosBasicosQA() {
  datos.nuevaPersona();
  return {
    'Primer Nombre': datos.resolver('persona.primerNombre'),
    'Segundo Nombre': datos.resolver('persona.segundoNombre'),
    'Primer Apellido': datos.resolver('persona.primerApellido'),
    'Segundo Apellido': datos.resolver('persona.segundoApellido'),
    'Dimensión empleado': datos.resolver('datosEmpleado.dimension'),
    Referencia: datos.resolver('datosEmpleado.referencia'),
    // Cascade Tipo ID -> Identificación: 11 dígitos (formato cédula RD más común).
    Identificación: datos.resolver('persona.identificacion'),
  };
}

function datosPersonalesQA() {
  return {
    'Fecha de nacimiento': '01/01/1990',
    'Número de hijos': '0',
    // "Pies" (0-8) y "Pulgadas" (0-11): la app corrige silenciosamente
    // cualquier valor fuera de rango al límite más cercano.
    Pies: '5',
    Pulgadas: '7',
    'Condición médica': 'Ninguna',
    Discapacidad: 'Ninguna',
    'Email corporativo': datos.resolver('persona.correo'),
    'Email personal': datos.resolver('persona.correoPersonal'),
    // Solo dígitos: el editor enmascarado ("(XXX) XXX-XXXX") los formatea
    // solo — con guiones en el valor, la máscara los interpreta mal y
    // termina desalineada (confirmado con Selenium real).
    'Teléfono de trabajo': '8095550100',
    'Teléfono personal': '8095550101',
    // Cascade País -> Ciudad -> Sector -> Calle:
    Calle: datos.resolver('datosEmpleado.calle'),
    Nombre: datos.resolver('datosEmpleado.contacto'),
    Teléfono: '8095550102',
    Parentesco: 'Amigo',
  };
}

function rhDatosBasicosQA() {
  return {
    'Fecha de inicio': new Date().toLocaleDateString('es-DO', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    'Saldo a favor ISR': '0',
    'Días tomados': '0',
    'Días pendientes': '0',
    'Días programados': '0',
  };
}

function rhPaqueteSalarialQA() {
  return {
    Salario: '20000',
    'Monto tope de comisión': '0',
    'Porciento Salario': '100',
  };
}

module.exports = { datosBasicosQA, datosPersonalesQA, rhDatosBasicosQA, rhPaqueteSalarialQA };
