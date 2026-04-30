const net = require("net");
const { SerialPort } = require("serialport");
const AppConfig = require("./app-config");
const { parse } = require("path");

//#region main.js variables
var mainWindow;
var printToAngular;
//#endregion

var currMessage = "";
var messages = [];

var datas = [];

function initializeMainJsVariables() {
  const mainJs = require("../main");
  mainWindow = mainJs.mainWindow;
  printToAngular = mainJs.printToAngular;
}

class KantarPort {
  static port;
  static start() {
    if (!AppConfig.kantar) return;
    initializeMainJsVariables();
    //Serialport
    this.port = new SerialPort(AppConfig.serialPort);

    this.port.open(this.openning);
    this.port.on("error", this.onError);

    this.port.on("data", this.onData);
    mainWindow.on("minimize", () => {
      this.port.close();
    });
    mainWindow.on("maximize", () => {
      if (!this.port.isOpen) {
        this.port.open(this.openning);
      }
    });
  }

  static dataParser(msg) {
    if (AppConfig.kantarMarka == "tartanTarim") {
      return msg.split(" ")[0].replaceAll("WN", "").replaceAll("-", "");
    } else if (AppConfig.kantarMarka == "netKantar") {
      return msg
        .split("\n")[0]
        .replaceAll("=", "")
        .replaceAll(" ", "")
        .replaceAll("(kg)", "");
    } else if (AppConfig.kantarMarka == "ideKantar") {
      try {
        let match = msg.match(/-?\d+/); 
    return match ? parseInt(match[0]) : 0;
      } catch (error) {
        console.log("Kantar verisi int'e çevrilemedi "+error);
        return 0;
      }
    
} else if (AppConfig.kantarMarka == "tamTarti") {
      var str = msg.split(" ")[0];
      var data = str.substring(str.length - 6);
      return data;
    } else if (AppConfig.kantarMarka == "tunayKantar") {
      return msg.replaceAll("\u0002", "");
    } else if (AppConfig.kantarMarka == "uzayKantar") {
      return msg.toString().trim().split(/\s+/)[1];
    } else if (AppConfig.kantarMarka == "tunaylarKantar") {
      try {
        msg = msg.trim().split(" ")[1];

        return parseInt(msg);
      } catch (error) {
        console.log("Kantar verisi int'e çevrilemedi");
        return 0;
      }
    } else if (AppConfig.kantarMarka == "weiloKantar") {
      return msg
        .replaceAll("US", "")
        .replaceAll("GS", "")
        .replaceAll("ST", "")
        .replaceAll("WN", "")
        .replaceAll(",", "")
        .replaceAll("+", "")
        .replaceAll("-", "")
        .replaceAll("kg", "")
        .replaceAll(" ", "");
    } else {
      return msg;
    }
  }

  static openning(err) {
    if (err) {
      console.log("Error opening port: " + err.messages);
      printToAngular("Error opening port: ", err.message);
    }
  }

  static onError(err) {
    console.log("Error: " + err.messages);
    printToAngular("Error: ", err.message);
  }

  static onData(data) {

    currMessage += Buffer.from(data).toString();

    if (
      !currMessage.endsWith("\\r") && //fake data from hercules
      !currMessage.endsWith("\r") && //other kantars
      !currMessage.endsWith("\n") && //net kantar
      !currMessage.endsWith("\\n")
    )
      return;

    if (AppConfig.kantarMarka == "tamTarti" && !currMessage.includes("\r"))
      return;

    currMessage = currMessage
      .replaceAll("\\r", "")
      .replaceAll("\r", "")
      .replaceAll("\n", "")
      .replaceAll("\\n", "");

    if (currMessage.length > 50) {
      currMessage = "";
      return;
    }
   
    currMessage = KantarPort.dataParser(currMessage); //parse kantar data

    messages.push(currMessage);

    if (messages.length == 3) {
      let allSame = [...new Set(messages)].length == 1;
      if (allSame) {
        mainWindow.webContents.send("kantar", messages[0]);
        // console.log("Data sended => " + messages[0]);
        messages = [];
      } else {
        messages = messages.slice(1);
      }
    }
    currMessage = "";
  }
}

module.exports = KantarPort;
