# Módulo Configuración — Pruebas E2E

Proyecto de pruebas automatizadas del módulo **Configuración**. Consume el framework `@triple/core` (ver la documentación completa en el **[README de la raíz](../README.md)**: arquitectura, capas, configuración, recetas y referencia de la API).

Se llega a "Configuración" desde CUALQUIER módulo, vía el ícono de configuración del navbar (`navigationFlow.abrirConfiguracion`, en el core — no es propio de este módulo). Dentro tiene un menú lateral con secciones desplegables (Administración, Nómina, Interfaces, Usuarios y permisos, …); cada opción del menú abre un listado (DataGrid + botón "Crear", igual patrón que el resto de la app).

## Correr las pruebas

Desde esta carpeta (`configuracion/`):

```bash
npm test                                   # toda la suite del módulo
npm test -- tests/crear-sucursal.test.js   # un solo archivo
npm run report:open                        # abre el último reporte HTML
```

> Si es la primera vez, corré `npm install` **en la raíz del monorepo** (no acá).

## Contenido del módulo

```
configuracion/
├── pages/
│   ├── SucursalesPage.js         # listado (Administración > Sucursales)
│   ├── SucursalFormPage.js       # formulario compartido por Crear Y Editar
│   └── SucursalDetallePage.js    # consulta (detalle de solo lectura + botón Editar)
├── data/                         # Execution Context + organización del Panel
├── support/fixtures.js           # arranque común de los casos
└── tests/                        # specs de Mocha — UN CASO POR ARCHIVO
```

La navegación al menú lateral de Configuración (`ConfiguracionesPage.irA`) vive en el **core** (`core/pages/ConfiguracionesPage.js`): es la misma mecánica para cualquier entidad futura (Departamentos, Puestos, Horarios, …), así que no se reimplementa acá.

## Agregar pruebas de Configuración

1. Si la entidad todavía no tiene Page Object (ej. Departamentos), creá su listado/form/detalle en `pages/` siguiendo el patrón de `SucursalesPage.js`/`SucursalFormPage.js`/`SucursalDetallePage.js`.
2. Reutilizá `ConfiguracionesPage.irA('<Opción>', '<Sección del menú>')` para llegar al listado — no reimplementes la navegación del menú lateral.
3. Registrá el caso nuevo en `data/organizacion-tests.js` (sección/categoría/descripción) para que aparezca agrupado en el Panel.

## Credenciales / configuración

Viven en el **`.env` global** de la raíz del monorepo, no acá.
