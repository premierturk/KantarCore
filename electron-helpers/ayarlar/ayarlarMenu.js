const { Menu, BrowserWindow } = require("electron");
const Shortcut = require("electron-shortcut");
const fs = require("fs");
const AppFiles = require("../app-files");

const menuTempt = [
  {
    label: "Ayarlar",
    click: () => {
      var ayarlarWindow = new BrowserWindow({
        width: 750,
        height: 800,
        title: "Ayarlar",
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          enableRemoteModule: true,
          backgroundThrottling: false,
          preload: "../preload.js",
        },
      });

      ayarlarWindow.setMenu(null);
      ayarlarWindow.loadURL(`file://${__dirname}/ui/ayarlar.html`);

      new Shortcut("Ctrl+F11", (e) => ayarlarWindow.webContents.openDevTools());

      setTimeout(() => {
        var config = fs.readFileSync(AppFiles.kantarConfig, "utf-8");
        if (config != "")
          ayarlarWindow.webContents.send("config", JSON.parse(config));
      }, 1000);
    },
  },
];

module.exports = {
  ayarlarMenu: Menu.buildFromTemplate(menuTempt),
};
