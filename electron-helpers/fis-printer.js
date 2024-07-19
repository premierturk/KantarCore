const AppConfig = require("./app-config");
const AppFiles = require("./app-files");
const fs = require("fs");
var nrc = require("node-run-cmd");

//main.js variables
var mainWindow;
var printToAngular;

function initializeMainJsVariables() {
  const mainJs = require("../main");
  mainWindow = mainJs.mainWindow;
  printToAngular = mainJs.printToAngular;
}

class FisPrinter {
  static printFis(event, data) {
    if (!AppConfig.isPrinterOn) return;
    initializeMainJsVariables();
    try {
      printToAngular("ONPRİNT");
      data = data[0];

      printToAngular(data);

      var fisTxt = fs.readFileSync(AppFiles.tempTxt, "utf-8");

      for (const [key, value] of Object.entries(data))
        fisTxt = fisTxt.replaceAll(`{{${key}}}`, value ?? "");

      fs.copyFile(AppFiles.tempTxt, AppFiles.outTxt, (err, res) => {
        if (err) {
          printToAngular(err);
          return;
        }

        fs.writeFile(AppFiles.outTxt, fisTxt, "utf8", function (err) {
          if (err) return console.log(err);
        });

        //const command = AppFiles.exePath + `"${AppConfig.printerName}" "${AppFiles.outTxt}"`;
        printToAngular("Temp yolu: " + AppFiles.tempTxt);
        console.log("Temp yolu: " + AppFiles.tempTxt);
        printToAngular("Out yolu: " + AppFiles.outTxt);
        console.log("Out yolu: " + AppFiles.outTxt);
        const command = `notepad.exe /p '${AppFiles.outTxt}' '${AppConfig.printerName}'`;
        console.log(command);
        printToAngular(command);

        nrc.run(command).then(
          function (exitCodes) {
            printToAngular("printed  " + exitCodes);
          },
          function (err) {
            printToAngular("Command failed to run with error: " + err);
          }
        );
      });
    } catch (error) {
      printToAngular(error);
    }
  }
}

module.exports = FisPrinter;
