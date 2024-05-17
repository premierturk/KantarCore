const { app } = require("electron");
const path = require("path");

class AppFiles {
    static kantarConfig = path.join(app.getPath("userData"), `kantarConfig.json`);
    static tempTxt = "fis/template.txt";
    static outTxt = "fis/output.txt";
    static exePath = "fis/PrintFis.exe";
}

module.exports = AppFiles