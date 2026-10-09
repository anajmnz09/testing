const zlib = require('zlib');
const { expect } = require('chai');
const { extraerTexto } = require('../pdf');

/** Arma un PDF mínimo: `paginas` = [{ contenido, fuenteToUnicode?, imagen? }]. Contenido Flate. */
function armarPdf(paginas) {
  const objs = [];
  const add = (cuerpo) => {
    objs.push(cuerpo);
    return objs.length;
  };
  add(null); // 1 catálogo
  add(null); // 2 pages
  const kids = [];
  for (const p of paginas) {
    const flate = zlib.deflateSync(Buffer.from(p.contenido, 'latin1'));
    const contenido = add(Buffer.concat([Buffer.from(`<< /Length ${flate.length} /Filter /FlateDecode >>\nstream\n`), flate, Buffer.from('\nendstream')]));
    let fuente;
    if (p.cmap) {
      const cm = zlib.deflateSync(Buffer.from(p.cmap, 'latin1'));
      const tu = add(Buffer.concat([Buffer.from(`<< /Length ${cm.length} /Filter /FlateDecode >>\nstream\n`), cm, Buffer.from('\nendstream')]));
      fuente = add(Buffer.from(`<< /Type /Font /Subtype /Type0 /BaseFont /X /Encoding /Identity-H /ToUnicode ${tu} 0 R >>`));
    } else {
      fuente = add(Buffer.from('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'));
    }
    let xobj = '';
    if (p.imagen) {
      const img = add(Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${p.imagen} /Height ${p.imagen} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length 1 >>\nstream\nx\nendstream`));
      xobj = `/XObject << /Im1 ${img} 0 R >>`;
    }
    const pag = add(Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contenido} 0 R /Resources << /Font << /F1 ${fuente} 0 R >> ${xobj} >> >>`));
    kids.push(pag);
  }
  objs[0] = Buffer.from('<< /Type /Catalog /Pages 2 0 R >>');
  objs[1] = Buffer.from(`<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`);
  let out = Buffer.from('%PDF-1.5\n');
  objs.forEach((o, i) => {
    out = Buffer.concat([out, Buffer.from(`${i + 1} 0 obj\n`), o, Buffer.from('\nendobj\n')]);
  });
  return Buffer.concat([out, Buffer.from('trailer\n<< /Root 1 0 R >>\n%%EOF\n')]);
}

const LARGO = ' Este texto es suficientemente largo para considerarse una especificación legible por completo.';

describe('ia/pdf — extracción de texto del caso de uso, sin dependencias (unitario)', function () {
  it('fuente simple con WinAnsi: texto, tildes (octales) y saltos de línea; varias páginas en orden', function () {
    const p1 = `BT /F1 12 Tf 40 700 Td (1. Abrir el m\\363dulo Empleados.) Tj 0 -14 Td (2. Escribir el nombre en Buscar.${LARGO}) Tj ET`;
    const p2 = 'BT /F1 12 Tf 40 700 Td [(Resultado ) -20 (esperado: listado)] TJ ET';
    const r = extraerTexto(armarPdf([{ contenido: p1 }, { contenido: p2 }]));
    expect(r.paginas).to.equal(2);
    expect(r.texto).to.contain('[Página 1]').and.contain('1. Abrir el módulo Empleados.').and.contain('2. Escribir el nombre en Buscar.');
    expect(r.texto.indexOf('Abrir el módulo')).to.be.below(r.texto.indexOf('Resultado esperado: listado'));
    expect(r.texto.split('\n').some((l) => l.startsWith('1. Abrir'))).to.equal(true);
    expect(r.suficiente).to.equal(true);
    expect(r.imagenes).to.equal(0);
  });

  it('fuente Type0 con ToUnicode (como Word/Chrome): decodifica los códigos de glifo a texto', function () {
    const cmap = '/CIDInit begincmap 1 begincodespacerange <0000> <FFFF> endcodespacerange 3 beginbfchar <0001> <0043> <0002> <0061> <0003> <00F3> endbfchar 1 beginbfrange <0010> <0012> <0041> endbfrange endcmap';
    const r = extraerTexto(armarPdf([{ cmap, contenido: `BT /F1 12 Tf 10 700 Td <00010002> Tj <00030010001100120003> Tj ET ${LARGO}` }]));
    expect(r.texto).to.contain('Ca').and.contain('óABCó');
  });

  it('detecta imágenes de contenido (no íconos) y marca texto insuficiente cuando no hay texto legible', function () {
    const conImagen = extraerTexto(armarPdf([{ contenido: `BT /F1 12 Tf 10 700 Td (Caso) Tj (${LARGO}) Tj ET`, imagen: 300 }]));
    expect(conImagen.imagenes).to.equal(1);
    const icono = extraerTexto(armarPdf([{ contenido: `BT /F1 12 Tf 10 700 Td (Caso) Tj (${LARGO}) Tj ET`, imagen: 16 }]));
    expect(icono.imagenes).to.equal(0);
    const escaneado = extraerTexto(armarPdf([{ contenido: 'q 100 0 0 100 0 0 cm /Im1 Do Q', imagen: 600 }]));
    expect(escaneado.suficiente).to.equal(false);
    expect(escaneado.imagenes).to.equal(1);
  });

  it('un PDF ilegible no revienta: devuelve vacío e insuficiente', function () {
    const r = extraerTexto(Buffer.from('%PDF-1.4 basura sin objetos'));
    expect(r).to.deep.include({ texto: '', paginas: 0, suficiente: false });
  });
});
