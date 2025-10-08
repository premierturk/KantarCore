const fs = require("fs");
const AppFiles = require("./app-files");
const { app } = require("electron");
const { ayarlarMenu } = require("./ayarlar/ayarlarMenu");

class SerialPortConfigs {
  path;
  autoOpen;
  baudRate;
  dataBits;
  parity;

  constructor(_config) {
    for (const [key, value] of Object.entries(_config)) this[key] = value;
  }
}

class AppConfig {
  static depolamaAlanId;
  static kantarAdi;
  static url;
  static kantarMarka;
  static kantar;
  static printerName;
  static isPrinterOn;
  static antencomport;
  static antenseriport;
  static serialPort = new SerialPortConfigs({});

  static initialize() {
    if (!fs.existsSync(AppFiles.kantarConfig))
      fs.appendFileSync(AppFiles.kantarConfig, "");

    var config = fs.readFileSync(AppFiles.kantarConfig, "utf-8");

    if (config == "") {
      ayarlarMenu.items[0].click();
      return;
    }

    setTimeout(() => sendToAngular(config), 2000);
    var jsonConfig = JSON.parse(config);
    for (const [key, value] of Object.entries(jsonConfig)) {
      if (key != "serialPort") this[key] = value;
      else this[key] = new SerialPortConfigs(value);
    }
  }

  static update(event, data) {
    fs.writeFile(AppFiles.kantarConfig, JSON.stringify(data), (err, res) => {
      if (err) {
        printToAngular(err);
        return;
      }
      sendToAngular(JSON.stringify(data));
      app.relaunch();
      app.exit();
    });
  }
}

var sendToAngular = (config) =>
  require("../main").mainWindow.webContents.send("kantarConfig", config);

module.exports = AppConfig;
