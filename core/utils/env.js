const path = require('path');
const dotenv = require('dotenv');

// Carga jerárquica de variables de entorno para todo el framework.
//
// Orden (dotenv NO pisa variables ya definidas, así que la primera fuente gana):
//   1. .env del módulo que corre (cwd) → override opcional por módulo.
//   2. .env global del repo (Selenium/.env) → credenciales y URL compartidas.
//
// __dirname aquí es Selenium/core/utils, así que la raíz del repo es "../../".
const MODULE_ENV = path.join(process.cwd(), '.env');
const ROOT_ENV = path.resolve(__dirname, '..', '..', '.env');

dotenv.config({ path: MODULE_ENV }); // 1) override por módulo (si existe)
dotenv.config({ path: ROOT_ENV }); // 2) global compartido

module.exports = { MODULE_ENV, ROOT_ENV };
