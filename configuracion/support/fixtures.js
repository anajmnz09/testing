const { createDriver, authFlow } = require('@triple/core');
const navigationFlow = require('@triple/core/flows/navigationFlow');
const SucursalesPage = require('../pages/SucursalesPage');
const DepartamentosPage = require('../pages/DepartamentosPage');
const PuestosPage = require('../pages/PuestosPage');
const HorariosPage = require('../pages/HorariosPage');
const GradosAcademicosPage = require('../pages/GradosAcademicosPage');
const BeneficiosPage = require('../pages/BeneficiosPage');
const HabilidadesPage = require('../pages/HabilidadesPage');
const PlanesDeSegurosPage = require('../pages/PlanesDeSegurosPage');
const RazonesDeSalidasPage = require('../pages/RazonesDeSalidasPage');
const ProveedoresDeSegurosPage = require('../pages/ProveedoresDeSegurosPage');
const BancosPage = require('../pages/BancosPage');

/**
 * Fixtures compartidos por los casos del módulo (mismo patrón que
 * `reclutamiento/support/fixtures.js`): el arranque común (crear driver,
 * login, entrar a Configuración, ir al listado) vive acá una sola vez.
 */

/**
 * Registra el beforeEach estándar y devuelve un contexto que se completa
 * antes de cada test: `{ driver, lista }`, con `lista` = listado de
 * Sucursales ya cargado.
 */
function usarListadoSucursales() {
  const ctx = {};
  beforeEach(async function () {
    ctx.driver = await createDriver();
    await authFlow.login(ctx.driver);
    const configuraciones = await navigationFlow.abrirConfiguracion(ctx.driver);
    await configuraciones.irA('Sucursales', 'Administración');
    ctx.lista = await new SucursalesPage(ctx.driver).listo();
  });
  return ctx;
}

/** Igual que `usarListadoSucursales`, pero deja cargado el listado "Departamentos". */
function usarListadoDepartamentos() {
  const ctx = {};
  beforeEach(async function () {
    ctx.driver = await createDriver();
    await authFlow.login(ctx.driver);
    const configuraciones = await navigationFlow.abrirConfiguracion(ctx.driver);
    await configuraciones.irA('Departamentos', 'Administración');
    ctx.lista = await new DepartamentosPage(ctx.driver).listo();
  });
  return ctx;
}

/** Igual que `usarListadoSucursales`, pero deja cargado el listado "Puestos". */
function usarListadoPuestos() {
  const ctx = {};
  beforeEach(async function () {
    ctx.driver = await createDriver();
    await authFlow.login(ctx.driver);
    const configuraciones = await navigationFlow.abrirConfiguracion(ctx.driver);
    await configuraciones.irA('Puestos', 'Administración');
    ctx.lista = await new PuestosPage(ctx.driver).listo();
  });
  return ctx;
}

/** Igual que `usarListadoSucursales`, pero deja cargado el listado "Horarios". */
function usarListadoHorarios() {
  const ctx = {};
  beforeEach(async function () {
    ctx.driver = await createDriver();
    await authFlow.login(ctx.driver);
    const configuraciones = await navigationFlow.abrirConfiguracion(ctx.driver);
    await configuraciones.irA('Horarios', 'Administración');
    ctx.lista = await new HorariosPage(ctx.driver).listo();
  });
  return ctx;
}

/** Igual que `usarListadoSucursales`, pero deja cargado el listado "Grados Académicos". */
function usarListadoGradosAcademicos() {
  const ctx = {};
  beforeEach(async function () {
    ctx.driver = await createDriver();
    await authFlow.login(ctx.driver);
    const configuraciones = await navigationFlow.abrirConfiguracion(ctx.driver);
    await configuraciones.irA('Grados Académicos', 'Administración');
    ctx.lista = await new GradosAcademicosPage(ctx.driver).listo();
  });
  return ctx;
}

/** Igual que `usarListadoSucursales`, pero deja cargado el listado "Beneficios". */
function usarListadoBeneficios() {
  const ctx = {};
  beforeEach(async function () {
    ctx.driver = await createDriver();
    await authFlow.login(ctx.driver);
    const configuraciones = await navigationFlow.abrirConfiguracion(ctx.driver);
    await configuraciones.irA('Beneficios', 'Administración');
    ctx.lista = await new BeneficiosPage(ctx.driver).listo();
  });
  return ctx;
}

/** Igual que `usarListadoSucursales`, pero deja cargado el listado "Habilidades" (Empleados). */
function usarListadoHabilidades() {
  const ctx = {};
  beforeEach(async function () {
    ctx.driver = await createDriver();
    await authFlow.login(ctx.driver);
    const configuraciones = await navigationFlow.abrirConfiguracion(ctx.driver);
    await configuraciones.irA('Habilidades', 'Empleados');
    ctx.lista = await new HabilidadesPage(ctx.driver).listo();
  });
  return ctx;
}

/** Igual que `usarListadoSucursales`, pero deja cargado el listado "Planes de seguros" (Empleados). */
function usarListadoPlanesDeSeguros() {
  const ctx = {};
  beforeEach(async function () {
    ctx.driver = await createDriver();
    await authFlow.login(ctx.driver);
    const configuraciones = await navigationFlow.abrirConfiguracion(ctx.driver);
    await configuraciones.irA('Planes de seguros', 'Empleados');
    ctx.lista = await new PlanesDeSegurosPage(ctx.driver).listo();
  });
  return ctx;
}

/** Igual que `usarListadoSucursales`, pero deja cargado el listado "Razones de Salidas" (Empleados). */
function usarListadoRazonesDeSalidas() {
  const ctx = {};
  beforeEach(async function () {
    ctx.driver = await createDriver();
    await authFlow.login(ctx.driver);
    const configuraciones = await navigationFlow.abrirConfiguracion(ctx.driver);
    await configuraciones.irA('Razones de Salidas', 'Empleados');
    ctx.lista = await new RazonesDeSalidasPage(ctx.driver).listo();
  });
  return ctx;
}

/** Igual que `usarListadoSucursales`, pero deja cargado el listado "Proveedores de seguros" (Empleados; título de destino "Proveedor de seguros"). */
function usarListadoProveedoresDeSeguros() {
  const ctx = {};
  beforeEach(async function () {
    ctx.driver = await createDriver();
    await authFlow.login(ctx.driver);
    const configuraciones = await navigationFlow.abrirConfiguracion(ctx.driver);
    await configuraciones.irA('Proveedores de seguros', 'Empleados', 'Proveedor de seguros');
    ctx.lista = await new ProveedoresDeSegurosPage(ctx.driver).listo();
  });
  return ctx;
}

/** Igual que `usarListadoSucursales`, pero deja cargado el listado "Bancos" (Empleados). */
function usarListadoBancos() {
  const ctx = {};
  beforeEach(async function () {
    ctx.driver = await createDriver();
    await authFlow.login(ctx.driver);
    const configuraciones = await navigationFlow.abrirConfiguracion(ctx.driver);
    await configuraciones.irA('Bancos', 'Empleados');
    ctx.lista = await new BancosPage(ctx.driver).listo();
  });
  return ctx;
}

module.exports = {
  usarListadoSucursales,
  usarListadoDepartamentos,
  usarListadoPuestos,
  usarListadoHorarios,
  usarListadoGradosAcademicos,
  usarListadoBeneficios,
  usarListadoHabilidades,
  usarListadoPlanesDeSeguros,
  usarListadoRazonesDeSalidas,
  usarListadoProveedoresDeSeguros,
  usarListadoBancos,
};
