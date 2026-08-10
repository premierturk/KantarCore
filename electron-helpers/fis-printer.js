const { BrowserWindow } = require("electron");
const AppConfig = require("./app-config");
const AppFiles = require("./app-files");
const fs = require("fs");

//main.js variables
var mainWindow;
var printToAngular;

function initializeMainJsVariables() {
  const mainJs = require("../main");
  mainWindow = mainJs.mainWindow;
  printToAngular = mainJs.printToAngular;
}

let workerWindow = null;
let isWindowLoaded = false;

function getWorkerWindow() {
  if (!workerWindow || workerWindow.isDestroyed()) {
    workerWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    isWindowLoaded = false;
    
    // Uygulama ilk açıldığında boş sayfayı bir kere yükle
    const htmlContent = `
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page { margin: 0; }
              body { margin: 0; padding: 0; background-color: white; }
              pre { font-family: 'Consolas', monospace; font-weight: bold; font-size: 8pt; margin: 0; padding: 0; white-space: pre-wrap; word-break: break-all; }
            </style>
          </head>
          <body>
            <pre id="content"></pre>
          </body>
        </html>
    `;
    workerWindow.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(htmlContent));
    workerWindow.webContents.on('did-finish-load', () => {
      isWindowLoaded = true;
    });
  }
  return workerWindow;
}

class FisPrinter {
  static printFis(event, data) {
    if (!AppConfig.isPrinterOn) return;
    initializeMainJsVariables();
    try {
      printToAngular("ONPRİNT (ELECTRON NATIVE)");
      data = data[0];

      printToAngular(data);

      var fisTxt = fs.readFileSync(AppFiles.tempTxt, "utf-8");

      for (const [key, value] of Object.entries(data)) {
        fisTxt = fisTxt.replaceAll(`{{${key}}}`, value ?? "");
      }

      // output.txt dosyasını yedek/log amacıyla yazmaya devam ediyoruz.
      try {
        fs.writeFileSync(AppFiles.outTxt, fisTxt, "utf8");
      } catch (writeErr) {
        console.error("output.txt yazma hatası:", writeErr);
      }

      // JS içinde çalışması için kaçış (escape) karakterlerini ayarlıyoruz
      const escapedTxt = fisTxt
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "");

      const win = getWorkerWindow();

      // Sayfa yenilemeden DOM'a müdahale edip yazdıran fonksiyon
      const doPrint = () => {
        win.webContents.executeJavaScript(`document.getElementById('content').innerHTML = '${escapedTxt}';`).then(() => {
          win.webContents.print({
            silent: true,
            deviceName: AppConfig.printerName,
            margins: { marginType: 'none' } // Kenar boşlukları 0
          }, (success, errorType) => {
            if (success) {
              printToAngular("Yazdırıldı (Hızlı Native)");
              console.log("Yazdırıldı (Hızlı Native)");
            } else {
              printToAngular("Yazdırma hatası: " + errorType);
              console.error("Yazdırma hatası:", errorType);
            }
          });
        }).catch(err => {
          console.error("Hızlı yazdırma JS hatası:", err);
        });
      };

      // Zaten yüklüyse beklemeden hemen yazdır!
      if (isWindowLoaded) {
        doPrint();
      } else {
        win.webContents.once("did-finish-load", () => {
          doPrint();
        });
      }

    } catch (error) {
      printToAngular(error);
      console.error(error);
    }
  }
}

module.exports = FisPrinter;
