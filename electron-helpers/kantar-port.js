
const net = require("net");
const { SerialPort } = require("serialport");
const AppConfig = require("./app-config");

//#region main.js variables
var mainWindow;
var printToAngular;
//#endregion

var currMessage = "";
var messages = [];

function initializeMainJsVariables() {
    const mainJs = require('../main');
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
            return msg
                .replaceAll("A", "")
                .replaceAll("B", "")
                .replaceAll("C", "")
                .replaceAll(" ", "");
        } else if (AppConfig.kantarMarka == "tamTarti") {
            var str = msg.split(" ")[0];
            var data = str.substring(str.length - 6);
            return data;
        } else if (AppConfig.kantarMarka == "tunayKantar") {
            return msg.replaceAll("\u0002", "");
        }
        else {
            return msg;
        }
    }

    static openning(err) {
        if (err) {
            console.log("Error opening port: " + err.messages);
            return printToAngular("Error opening port: ", err.message);
        }
    }

    static onError(err) {
        console.log("Error: " + err.messages);
        printToAngular("Error: ", err.message);
    }

    static onData(data) {
        currMessage += Buffer.from(data).toString();

        console.log("First Read =>" + currMessage);
        printToAngular("First Read =>" + currMessage);

        if (
            !currMessage.endsWith("\\r") && //fake data from hercules
            !currMessage.endsWith("\r") && //other kantars
            !currMessage.endsWith("\n") //net kantar
        )
            return;


        if (AppConfig.kantarMarka == "tamTarti" && !currMessage.includes("\r")) return;

        console.log("Completed Msg =>" + currMessage);
        printToAngular("Completed Msg =>" + currMessage);

        currMessage = currMessage.replaceAll("\\r", "").replaceAll("\r", "");

        if (currMessage.length > 50) {
            currMessage = "";
            return;
        }

        console.log("Before Parser =>" + currMessage);
        printToAngular("Before Parser =>" + currMessage);

        currMessage = KantarPort.dataParser(currMessage); //parse kantar data

        console.log("After Parser =>" + currMessage);
        printToAngular("After Parser =>" + currMessage);

        messages.push(currMessage);

        if (messages.length == 5) {
            let allSame = [...new Set(messages)].length == 1;
            if (allSame) {
                mainWindow.webContents.send("kantar", [messages[0]]);
                console.log("Data sended => " + messages[0]);
                messages = [];
            } else {
                messages = messages.slice(1);
            }
        }
        currMessage = "";
    }
}




module.exports = KantarPort;