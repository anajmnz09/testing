const { createDriver, authFlow, navigationFlow, quitDriver } = require('@triple/core');
const SRHHNavBar = require('@triple/core/components/SRHHNavBar');
const BancoCandidatosPage = require('../pages/BancoCandidatosPage');

(async () => {
  const driver = await createDriver();
  try {
    await authFlow.login(driver);
    await navigationFlow.abrirModulo(driver, 'Reclutamiento');
    const navBar = new SRHHNavBar(driver);
    await navBar.ir('Banco de candidatos');
    const banco = await new BancoCandidatosPage(driver).estaCargado();
    await banco.irATab('Descartados');
    await banco.grid.buscar('Marisol Reyes');
    await driver.sleep(1500);
    const filas = await banco.grid.filasPorColumnas();
    console.log('FILAS_DESCARTADOS_MARISOL', JSON.stringify(filas));
  } catch (e) {
    console.log('ERROR', e.message);
  } finally {
    await quitDriver(driver);
  }
})();
