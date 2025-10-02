const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const Shortcut = require("electron-shortcut");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const { spawn } = require("child_process");
const AppConfig = require("./electron-helpers/app-config");
const AntenTcp = require("./electron-helpers/anten-tcp");
const KantarPort = require("./electron-helpers/kantar-port");
const FisPrinter = require("./electron-helpers/fis-printer");
const {
  ayarlarMenu,
  openSettingsWindow,
} = require("./electron-helpers/ayarlar/ayarlarMenu");
// var ping = require("ping");
let mainWindow;
const printToAngular = (message) =>
  mainWindow.webContents.send("print", message);

function onReady() {
  mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      backgroundThrottling: false,
      preload: path.join(__dirname, "electron-helpers/preload.js"),
    },
    icon: path.join(__dirname, "assets/icon.ico"),
  });

  mainWindow.setMenu(null);
  mainWindow.setTitle("HYBS_Kantar v" + app.getVersion());
  mainWindow.maximize();

  Menu.setApplicationMenu(ayarlarMenu);

  new Shortcut("Ctrl+F12", (e) => mainWindow.webContents.openDevTools());

  if (process.argv.includes("serve"))
    mainWindow.loadURL("http://localhost:4200");
  else mainWindow.loadURL(`file://${__dirname}/out/kantarcore/index.html`);

  //export after declare variables and methods
  module.exports = { mainWindow, printToAngular, app };

  AppConfig.initialize();
  KantarPort.start();
  AntenTcp.createServer();
  readerApp();

  setInterval(() => {
    console.log("1 dakika gecti, uygulama tekrar baslatiliyor...");
    readerApp();
  }, 60 * 1000);

  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 4000);
}
//app
app.on("ready", onReady);

app.on("window-all-closed", () => app.quit());

app.on("activate", () => mainWindow ?? onReady());

//ipcMain
ipcMain.on("restart_update", () => autoUpdater.quitAndInstall());

ipcMain.on("onprint", FisPrinter.printFis);

ipcMain.on("bariyer", AntenTcp.openBariyer);

ipcMain.on("kantarConfig", AppConfig.update);

ipcMain.on("antenRestart", AntenTcp.antenRestart);

ipcMain.on("tcprestart", AntenTcp.connectToHopland);

ipcMain.on("password-successful", () => {
  console.log("IPC: Sifre Basarili Sinyali Alindi. Ayarlar Aciliyor.");
  openSettingsWindow(mainWindow);
});

//autoUpdater
autoUpdater.on("update-available", () => {
  mainWindow.webContents.send("update_available");
  printToAngular("update_available");
});

autoUpdater.on("download-progress", (progressObj) => {
  let log_message = "Hız: " + progressObj.bytesPerSecond;
  log_message = log_message + " - İndirilen " + progressObj.percent + "%";
  mainWindow.webContents.send("download_progress", {
    text: log_message,
    data: progressObj,
  });
  printToAngular(log_message);
});

autoUpdater.on("update-downloaded", () => {
  printToAngular("update-downloaded");
  mainWindow.webContents.send("update_downloaded");
});

autoUpdater.on("error", (message) => printToAngular(message));

function readerApp() {
  const appPath = path.join(__dirname, "readerApp");
  const executable = "readerapp.exe";
  const fullPath = path.join(appPath, executable);

  const params = [`${AppConfig.antenip}:7896`, "8080"];

  const command = `start /B "ReaderApp" "${fullPath}" ${params.join(" ")}`;

  const child = spawn("cmd.exe", ["/c", command], { shell: true });

  child.stderr.on("data", (data) => {
    console.error(`Komut calistirma hatasi: ${data}`);
  });

  child.on("close", (code) => {
    console.log(`Komut ${code} koduyla tamamlandi.`);
  });

  console.log(`'${executable}' uygulamasi baslatildi.`);
}
