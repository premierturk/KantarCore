const { app, BrowserWindow, ipcMain, Menu } = require("electron");
const Shortcut = require("electron-shortcut");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const { spawn, execSync } = require("child_process");
const AppConfig = require("./electron-helpers/app-config");
const AntenTcp = require("./electron-helpers/anten-tcp");
const KantarPort = require("./electron-helpers/kantar-port");
const FisPrinter = require("./electron-helpers/fis-printer");
const {
  ayarlarMenu,
  openSettingsWindow,
} = require("./electron-helpers/ayarlar/ayarlarMenu");
const AppFiles = require("./electron-helpers/app-files");
const CameraCapture = require("./electron-helpers/camera-capture");
// var ping = require("ping");
let mainWindow;

const safeMainWindow = new Proxy(
  {},
  {
    get(target, prop) {
      if (prop === "webContents") {
        if (mainWindow && !mainWindow.isDestroyed()) {
          return mainWindow.webContents;
        }
        return {
          send: () => {},
        };
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        const val = mainWindow[prop];
        if (typeof val === "function") {
          return val.bind(mainWindow);
        }
        return val;
      }
      if (prop === "isDestroyed") {
        return () => true;
      }
      return undefined;
    },
  },
);

const printToAngular = (message) => {
  try {
    safeMainWindow.webContents.send("print", message);
  } catch (e) {
    // Kapatma sırasındaki hataları yut
  }
};

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

  module.exports = { mainWindow: safeMainWindow, printToAngular, app };

  AppConfig.initialize();
  KantarPort.start();

  AntenTcp.createServer();

  // if (AppConfig.pts) {
  //   plakaTespitApp();
  // }

  if (AppConfig.reader || AppConfig.antenseriport) {
    readerApp();

    setInterval(() => {
      readerApp();
    }, 60 * 1000);
  }

  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 4000);
}
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  //app
  app.on("ready", onReady);
}

app.on("window-all-closed", () => {
  try {
    execSync("taskkill /f /im ReaderAppSerialPort.exe");
    execSync("taskkill /f /im ReaderApp.exe");
  } catch (e) {}
  app.exit(0);
});

app.on("will-quit", () => {
  try {
    execSync("taskkill /f /im ReaderAppSerialPort.exe");
    execSync("taskkill /f /im ReaderApp.exe");
  } catch (e) {}
});

app.on("activate", () => mainWindow ?? onReady());

//ipcMain
ipcMain.on("restart_update", () => autoUpdater.quitAndInstall());

ipcMain.on("onprint", FisPrinter.printFis);

ipcMain.on("bariyer", AntenTcp.openBariyer);

ipcMain.on("kantarConfig", AppConfig.update);

ipcMain.on("antenRestart", AntenTcp.antenRestart);

ipcMain.on("capture-cameras", CameraCapture.captureCameras);

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

let readerChild = null;

function readerApp() {
  if (readerChild && !readerChild.killed) {
    console.log("ReaderApp zaten calisiyor.");
    return;
  }

  const appPath = AppFiles.getReaderExePath();
  const appSerialPath = AppFiles.getReaderSerialExePath();
  let command = "";

  if (AppConfig.antenseriport) {
    const params = [`${AppConfig.antencomport}`, "8080"];
    command = `start /min "ReaderAppSerialPort" "${appSerialPath}" ${params.join(
      " ",
    )}`;
    printToAngular("ReaderApp SerialPort Baslatildi");
  } else {
    const params = [`${AppConfig.antenip}:7896`, `${AppConfig.antenport}`];
    command = `start /min "ReaderApp" "${appPath}" ${params.join(" ")}`;
    printToAngular("ReaderApp TCP Baslatildi");
  }

  readerChild = spawn("cmd.exe", ["/c", command], { shell: true });

  readerChild.stderr.on("data", (data) => {
    console.error(`Komut calistirma hatasi: ${data}`);
  });

  readerChild.on("close", (code) => {
    console.log(`Komut ${code} koduyla tamamlandi.`);
    readerChild = null;
  });

  console.log(`ReaderApp uygulamasi baslatildi.`);
}

let ptsChild = null;

function plakaTespitApp() {
  if (ptsChild && !ptsChild.killed) {
    console.log("PlakaTespit zaten calisiyor.");
    return;
  }

  const ptsPath = AppFiles.getPtsExePath();

  if (AppConfig.pts) {
    printToAngular("PlakaTespit Başlatıldı");

    const ptsDir = path.dirname(ptsPath);
    ptsChild = spawn(ptsPath, [], {
      cwd: ptsDir,
    });

    ptsChild.stderr.on("data", (data) => {
      console.error(`PlakaTespit hatasi: ${data}`);
    });

    ptsChild.on("close", (code) => {
      console.log(`PlakaTespit ${code} koduyla tamamlandi.`);
      ptsChild = null;
    });

    console.log(`PlakaTespit uygulaması başlatıldı.`);
  }
}
