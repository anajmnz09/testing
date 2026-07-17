const { until } = require('selenium-webdriver');
const config = require('../config');

const DEFAULT_TIMEOUT = config.timeouts.explicitWaitMs;

async function waitForElementVisible(driver, locator, timeout = DEFAULT_TIMEOUT) {
  const element = await driver.wait(until.elementLocated(locator), timeout);
  await driver.wait(until.elementIsVisible(element), timeout);
  return element;
}

async function waitForUrlContains(driver, substring, timeout = DEFAULT_TIMEOUT) {
  await driver.wait(until.urlContains(substring), timeout);
}

module.exports = { waitForElementVisible, waitForUrlContains, DEFAULT_TIMEOUT };
