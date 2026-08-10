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

function getWorkerWindow() {
  if (!workerWindow || workerWindow.isDestroyed()) {
    workerWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
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

      // HTML içeriğini oluştur (Consolas, Bold, 8pt, 0 Kenar boşluğu)
      const escapedTxt = fisTxt
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      const htmlContent = `
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              @page {
                margin: 0;
              }
              body {
                margin: 0;
                padding: 0;
                background-color: white;
              }
              pre {
                font-family: 'Consolas', monospace;
                font-weight: bold;
                font-size: 8pt;
                margin: 0;
                padding: 0;
                white-space: pre-wrap;
                word-break: break-all;
              }
            </style>
          </head>
          <body>
            <pre>${escapedTxt}</pre>
          </body>
        </html>
      `;

      // Kalıcı BrowserWindow nesnesini alıyoruz (Sıfırdan süreç başlatma maliyetini önler)
      const win = getWorkerWindow();

      // Eski did-finish-load dinleyicilerini temizleyerek mükerrer yazdırmayı önlüyoruz
      win.webContents.removeAllListeners("did-finish-load");

      win.webContents.on("did-finish-load", () => {
        win.webContents.print({
          silent: true,
          deviceName: AppConfig.printerName,
          margins: { marginType: 'none' } // Kenar boşlukları 0
        }, (success, errorType) => {
          if (success) {
            printToAngular("Yazdırıldı (Electron Native)");
            console.log("Yazdırıldı (Electron Native)");
          } else {
            printToAngular("Yazdırma hatası: " + errorType);
            console.error("Yazdırma hatası:", errorType);
          }
        });
      });

      const dataUrl = "data:text/html;charset=utf-8," + encodeURIComponent(htmlContent);
      win.loadURL(dataUrl);

    } catch (error) {
      printToAngular(error);
      console.error(error);
    }
  }
}

module.exports = FisPrinter;
