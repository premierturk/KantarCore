const { app } = require("electron");
const path = require("path");

class AppFiles {
  static kantarConfig = path.join(app.getPath("userData"), `kantarConfig.json`);
  static tempTxt = path.join(
    process.argv[0].replace("HYBS_Kantar.exe", ""),
    "fis/template.txt"
  );
  static outTxt = path.join(
    process.argv[0].replace("HYBS_Kantar.exe", ""),
    "fis/output.txt"
  );
  static exePath = "fis/PrintFis.exe";
}

module.exports = AppFiles;
