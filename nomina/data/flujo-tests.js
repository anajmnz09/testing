/**
 * Metadata de FLUJOS del módulo Nómina: vacía a propósito. `asignar-empleado-nomina` declara en su
 * propio código que `codigos` se alimenta del `codigo` de la entidad `empleado`
 * (`registrarCaso(CASO, [{ clave: 'codigos', entidad: 'empleado', campo: 'codigo' }])`), y no hay
 * orden de negocio que el código no pueda demostrar. Ver GUIDELINES §12 y
 * `reclutamiento/data/flujo-tests.js`.
 */
module.exports = {};
