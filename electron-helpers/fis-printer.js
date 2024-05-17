
const AppConfig = require("./app-config");
const AppFiles = require('./app-files');
const fs = require("fs");
var nrc = require("node-run-cmd");

//main.js variables
var mainWindow;
var printToAngular;

function initializeMainJsVariables() {
    const mainJs = require('../main');
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

            fs.writeFile(AppFiles.outTxt, fisTxt, (err, res) => {
                if (err) {
                    printToAngular(err);
                    return;
                }
                const command =
                    AppFiles.exePath + `"${AppConfig.printerName}" "${AppFiles.outTxt}"`;

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