const { app } = require("electron");
const path = require("path");
const fs = require("fs");

function getExecutablePath(relativePath) {
  // 1. Packaged app check (process.resourcesPath/..)
  if (process.resourcesPath) {
    const prodPath = path.join(process.resourcesPath, "..", relativePath);
    if (fs.existsSync(prodPath)) return prodPath;
  }

  // 2. Executable parent dir check
  if (process.execPath) {
    const exeDir = path.dirname(process.execPath);
    const exePath = path.join(exeDir, relativePath);
    if (fs.existsSync(exePath)) return exePath;
  }

  // 3. Fallback to dev path (relative to project root)
  const devPath = path.resolve(__dirname, "..", relativePath);
  if (fs.existsSync(devPath)) return devPath;

  return path.resolve(__dirname, "..", relativePath);
}

class AppFiles {
  static kantarConfig = path.join(app.getPath("userData"), `kantarConfig.json`);
  
  static get tempTxt() {
    return getExecutablePath("fis/template.txt");
  }

  static get outTxt() {
    return getExecutablePath("fis/output.txt");
  }

  static exePath = "fis/PrintFis.exe";
  static readerExePath = "readerApp/ReaderApp.exe";
  static readerSerialExePath = "readerApp/ReaderAppSerialPort.exe";
  static ptsExePath = "PlakaTespit/PlakaTespit.exe";

  static getReaderExePath() {
    return getExecutablePath(this.readerExePath);
  }

  static getReaderSerialExePath() {
    return getExecutablePath(this.readerSerialExePath);
  }

  static getPtsExePath() {
    return getExecutablePath(this.ptsExePath);
  }
}

module.exports = AppFiles;

