const { Menu, BrowserWindow, ipcMain } = require("electron");
const Shortcut = require("electron-shortcut");
const fs = require("fs");
const path = require("path");
const AppFiles = require("../app-files");

let passwordWindow = null;

ipcMain.on("close-password-modal", () => {
  if (passwordWindow) {
    console.log("IPC: Manuel Kapatma Sinyali Alindi.");
    passwordWindow.close();
  }
});

ipcMain.on("password-successful", () => {
  if (passwordWindow) {
    console.log("IPC: Sifre Basarili. Modal Kapatiliyor.");
    passwordWindow.close();
  }
});

function openSettingsWindow(parentWindow) {
  var ayarlarWindow = new BrowserWindow({
    width: 750,
    height: 800,
    title: "Ayarlar",
    parent: parentWindow,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, "..", "preload.js"),
    },
  });

  ayarlarWindow.setMenu(null);
  ayarlarWindow.loadURL(`file://${__dirname}/ui/ayarlar.html`);

  ayarlarWindow.once("ready-to-show", () => {
    ayarlarWindow.show();
  });

  new Shortcut("Ctrl+F11", (e) => ayarlarWindow.webContents.openDevTools());

  setTimeout(() => {
    var config = fs.readFileSync(AppFiles.kantarConfig, "utf-8");
    if (config != "")
      ayarlarWindow.webContents.send("config", JSON.parse(config));
  }, 1000);
}

function createPasswordWindow(parentWindow) {
  if (passwordWindow) return;

  passwordWindow = new BrowserWindow({
    width: 400,
    height: 250,
    parent: parentWindow,
    resizable: false,
    modal: true,
    show: false,
    frame: false,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  const htmlPath = path.join(
    __dirname,
    "ui",
    "ayarlarsifre",
    "sifreKontrol.html"
  );

  passwordWindow.loadFile(htmlPath);

  passwordWindow.once("ready-to-show", () => {
    passwordWindow.show();
  });

  passwordWindow.on("closed", () => {
    passwordWindow = null;
  });
}

const menuTempt = [
  {
    label: "Ayarlar",
    click: (menuItem, browserWindow, event) => {
      createPasswordWindow(browserWindow);
    },
  },
];

module.exports = {
  ayarlarMenu: Menu.buildFromTemplate(menuTempt),
  openSettingsWindow,
};
