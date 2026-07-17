const fs = require('fs');
const path = require('path');
const { SCREENSHOTS_DIR } = require('./paths');

const DIACRITICS_REGEX = new RegExp('[̀-ͯ]', 'g');

function sanitizeFileName(name) {
  return name
    .normalize('NFD')
    .replace(DIACRITICS_REGEX, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

async function saveFailureScreenshot(driver, testTitle) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  const image = await driver.takeScreenshot();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${sanitizeFileName(testTitle)}__${stamp}.png`;
  const filePath = path.join(SCREENSHOTS_DIR, fileName);

  fs.writeFileSync(filePath, image, 'base64');

  return filePath;
}

module.exports = { saveFailureScreenshot, sanitizeFileName };
