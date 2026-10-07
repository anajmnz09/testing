/**
 * Bancos de texto del módulo Reclutamiento (textarea de comentarios). Solo los DATOS; el mecanismo es
 * `@triple/core/utils/bancoDatos`. Uso: `bancos.comentario.valor(testContext.get(CASO, 'comentario'), 'texto')`.
 */
const { definirBanco } = require('@triple/core/utils/bancoDatos');

const comentario = definirBanco('comentario', {
  categorias: {
    observacion: [
      'Se revisó la documentación presentada',
      'Se confirmó la disponibilidad del candidato',
      'Se dio seguimiento a la solicitud',
      'Se coordinó la entrevista con el área',
    ],
    cierre: ['sin observaciones adicionales', 'a la espera de la próxima etapa', 'pendiente de aprobación', 'conforme a lo acordado'],
  },
  textos: { texto: '{observacion}, {cierre}.' },
});

module.exports = { comentario };
