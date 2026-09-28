/**
 * Metadata SOLO para el Panel de Control: agrupa los campos de
 * `crear-empleado` por sección (igual a como se ven en la app real:
 * "Datos básicos", "Datos personales", "Datos básicos RH", "Paquete
 * salarial") y marca cuáles son requeridos (asterisco en la app).
 *
 * Archivo DELIBERADAMENTE separado de `EmpleadoFormPage.js`/
 * `crear-empleado.test.js`: no es Input Model ni afecta la ejecución del
 * test, es solo para que el Panel muestre los campos organizados igual que
 * el formulario real (a pedido explícito del usuario, 2026-09-02). Si el
 * Panel no encuentra este archivo para un caso, no agrupa nada (mismo
 * criterio tolerante que `organizacion-tests.js`) — ver
 * `panel/anfitrion/contexto.js#camposCaso`.
 */
module.exports = {
  'Tipo ID': { seccion: 'Datos básicos', requerido: true },
  Identificación: { seccion: 'Datos básicos', requerido: true },
  'Primer Nombre': { seccion: 'Datos básicos', requerido: true },
  'Segundo Nombre': { seccion: 'Datos básicos', requerido: false },
  'Primer Apellido': { seccion: 'Datos básicos', requerido: true },
  'Segundo Apellido': { seccion: 'Datos básicos', requerido: false },
  'Dimensión empleado': { seccion: 'Datos básicos', requerido: false },
  Sucursal: { seccion: 'Datos básicos', requerido: true },
  Modalidad: { seccion: 'Datos básicos', requerido: true },
  'Puesto de trabajo': { seccion: 'Datos básicos', requerido: true },
  Departamento: { seccion: 'Datos básicos', requerido: true },
  Supervisor: { seccion: 'Datos básicos', requerido: false },
  Referencia: { seccion: 'Datos básicos', requerido: false },
  'Supervisor multicompañía': { seccion: 'Datos básicos', requerido: false },

  Nacionalidad: { seccion: 'Datos personales', requerido: true },
  'País de nacimiento': { seccion: 'Datos personales', requerido: false },
  'Fecha de nacimiento': { seccion: 'Datos personales', requerido: true },
  Género: { seccion: 'Datos personales', requerido: true },
  'Estado civil': { seccion: 'Datos personales', requerido: true },
  'Número de hijos': { seccion: 'Datos personales', requerido: false },
  Pies: { seccion: 'Datos personales', requerido: false },
  Pulgadas: { seccion: 'Datos personales', requerido: false },
  'Tipo de sangre': { seccion: 'Datos personales', requerido: false },
  'Condición médica': { seccion: 'Datos personales', requerido: false },
  Discapacidad: { seccion: 'Datos personales', requerido: false },
  Riesgo: { seccion: 'Datos personales', requerido: false },
  Camisa: { seccion: 'Datos personales', requerido: false },
  Pantalón: { seccion: 'Datos personales', requerido: false },
  Zapatos: { seccion: 'Datos personales', requerido: false },
  'Email corporativo': { seccion: 'Datos personales', requerido: false },
  'Email personal': { seccion: 'Datos personales', requerido: false },
  'Teléfono de trabajo': { seccion: 'Datos personales', requerido: false },
  'Teléfono personal': { seccion: 'Datos personales', requerido: false },
  País: { seccion: 'Datos personales', requerido: true },
  Ciudad: { seccion: 'Datos personales', requerido: true },
  Sector: { seccion: 'Datos personales', requerido: true },
  Calle: { seccion: 'Datos personales', requerido: true },
  Nombre: { seccion: 'Datos personales', requerido: false },
  Teléfono: { seccion: 'Datos personales', requerido: false },
  Parentesco: { seccion: 'Datos personales', requerido: false },

  'Tipo de contrato': { seccion: 'Datos básicos RH', requerido: true },
  'Fecha de inicio': { seccion: 'Datos básicos RH', requerido: true },
  'Fecha finalización': { seccion: 'Datos básicos RH', requerido: false },
  'Fecha de salida': { seccion: 'Datos básicos RH', requerido: false },
  'Razón de salida': { seccion: 'Datos básicos RH', requerido: false },
  'Tipo de salario': { seccion: 'Datos básicos RH', requerido: true },
  'Categoría de pago horas': { seccion: 'Datos básicos RH', requerido: false },
  Horario: { seccion: 'Datos básicos RH', requerido: false },
  'Forma de pago': { seccion: 'Datos básicos RH', requerido: true },
  Banco: { seccion: 'Datos básicos RH', requerido: false },
  'Tipo de cuenta': { seccion: 'Datos básicos RH', requerido: false },
  'No. cuenta': { seccion: 'Datos básicos RH', requerido: false },
  'Compañía ARS': { seccion: 'Datos básicos RH', requerido: false },
  'Compañía AFP': { seccion: 'Datos básicos RH', requerido: false },
  'Compañía de seguro de vida': { seccion: 'Datos básicos RH', requerido: false },
  'Agente de retencion': { seccion: 'Datos básicos RH', requerido: false },
  'Saldo a favor ISR': { seccion: 'Datos básicos RH', requerido: false },
  'Descuento AFP': { seccion: 'Datos básicos RH', requerido: false },
  'Descuento SFS': { seccion: 'Datos básicos RH', requerido: false },
  'Descuento ISR': { seccion: 'Datos básicos RH', requerido: false },
  'Días tomados': { seccion: 'Datos básicos RH', requerido: false },
  'Días pendientes': { seccion: 'Datos básicos RH', requerido: false },
  'Días programados': { seccion: 'Datos básicos RH', requerido: false },

  Salario: { seccion: 'Paquete salarial', requerido: true },
  'Monto tope de comisión': { seccion: 'Paquete salarial', requerido: false },
  'Porciento Salario': { seccion: 'Paquete salarial', requerido: false },
  'Indicador Comision': { seccion: 'Paquete salarial', requerido: false },
  'Clasificación 1': { seccion: 'Paquete salarial', requerido: false },
  'Clasificación 2': { seccion: 'Paquete salarial', requerido: false },
  'Clasificación 3': { seccion: 'Paquete salarial', requerido: false },
};
