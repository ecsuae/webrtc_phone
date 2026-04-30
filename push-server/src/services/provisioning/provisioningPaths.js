'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_DIR = path.join(process.cwd(), 'data', 'provisioning');

function ensureDir(dirPath) {
  const dir = String(dirPath || '').trim() || DEFAULT_DIR;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getProvisioningDir() {
  return ensureDir(process.env.PROVISIONING_DATA_DIR || DEFAULT_DIR);
}

function accountsPath() {
  return path.join(getProvisioningDir(), 'accounts.json');
}

function devicesPath() {
  return path.join(getProvisioningDir(), 'devices.json');
}

module.exports = {
  ensureDir,
  getProvisioningDir,
  accountsPath,
  devicesPath,
};
