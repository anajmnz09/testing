const path = require('path');
const dotenv = require('dotenv');

// Carga jerárquica de variables de entorno para todo el framework.
//
// Orden (dotenv NO pisa variables ya definidas, así que la primera fuente gana):
//   1. .env del módulo que corre (cwd) → override opcional por módulo.
//   2. .env global en la raíz del monorepo → credenciales y URL compartidas.
//
// La raíz se deriva de la ubicación del core (`<raíz>/core/utils` → "../../"),
// nunca del nombre de una carpeta: mover o renombrar el repo no lo afecta.
const MODULE_ENV = path.join(process.cwd(), '.env');
const ROOT_ENV = path.resolve(__dirname, '..', '..', '.env');

dotenv.config({ path: MODULE_ENV }); // 1) override por módulo (si existe)
dotenv.config({ path: ROOT_ENV }); // 2) global compartido

module.exports = { MODULE_ENV, ROOT_ENV };
