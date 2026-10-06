/**
 * Valores QA por defecto (modo automático) para los campos de texto/fecha del
 * formulario "Crear Empleado" que NO tienen un "primer valor" razonable (a
 * diferencia de un selectbox, un campo de texto libre no tiene "primera opción"
 * — sin un valor explícito, `TextInputStrategy`/`DatePickerStrategy` no tocan el
 * control, ver `builtinStrategies.js`).
 *
 * Los valores salen del generador único del Core (`core/utils/datosPrueba.js`):
 * nombre/apellidos de catálogo (cambian en cada corrida) e Identificación/correo
 * únicos por construcción. El llamador (`valoresSeccion` en `crear-empleado`)
 * sigue dando prioridad a lo dirigido desde el Panel.
 */
const datosPrueba = require('@triple/core/utils/datosPrueba');

// Persona de la ÚLTIMA llamada a `datosBasicosQA()`: permite que los correos de
// `datosPersonalesQA()` se deriven del mismo nombre (coherencia dentro del test).
let ultimaPersona = null;

function datosBasicosQA() {
  const persona = datosPrueba.personaUnica();
  ultimaPersona = persona;
  return {
    'Primer Nombre': persona.primerNombre,
    'Segundo Nombre': persona.segundoNombre,
    'Primer Apellido': persona.primerApellido,
    'Segundo Apellido': persona.segundoApellido,
    'Dimensión empleado': 'QA',
    Referencia: 'Referencia QA',
    // Cascade Tipo ID -> Identificación: 11 dígitos (formato cédula RD más común).
    Identificación: datosPrueba.identificacion(),
  };
}

function datosPersonalesQA() {
  const persona = ultimaPersona || datosPrueba.personaUnica();
  return {
    'Fecha de nacimiento': '01/01/1990',
    'Número de hijos': '0',
    // "Pies" (0-8) y "Pulgadas" (0-11): la app corrige silenciosamente
    // cualquier valor fuera de rango al límite más cercano.
    Pies: '5',
    Pulgadas: '7',
    'Condición médica': 'Ninguna',
    Discapacidad: 'Ninguna',
    'Email corporativo': datosPrueba.correo(persona),
    'Email personal': datosPrueba.correo({ ...persona, primerApellido: persona.segundoApellido }),
    // Solo dígitos: el editor enmascarado ("(XXX) XXX-XXXX") los formatea
    // solo — con guiones en el valor, la máscara los interpreta mal y
    // termina desalineada (confirmado con Selenium real).
    'Teléfono de trabajo': '8095550100',
    'Teléfono personal': '8095550101',
    // Cascade País -> Ciudad -> Sector -> Calle:
    Calle: 'Calle QA Automatizada 1',
    Nombre: 'Contacto QA',
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
