
const net = require("net");
//#region main.js variables
var mainWindow;
var printToAngular;
//#endregion

var tcpmessages = [];
var arr = [];

function initializeMainJsVariables() {
    const mainJs = require('../main');
    mainWindow = mainJs.mainWindow;
    printToAngular = mainJs.printToAngular;
}

class AntenTcp {
    static connection;

    static createServer() {
        initializeMainJsVariables();
        var server = net.createServer();
        server.on("connection", this.handleConnection);

        server.listen(5555, function () {
            console.log("server listening to %j", server.address());
        });
    }

    static handleConnection(conn) {
        this.connection = conn;
        var remoteAddress = conn.remoteAddress + ":" + conn.remotePort;
        console.log("new client connection from " + remoteAddress);
        printToAngular("new client connection from " + remoteAddress);
        conn.on("data", onConnData);
        conn.on("error", onConnError);
        conn.on("close", () => console.log("connection closed from " + remoteAddress));

    }

    static openBariyer(event) {
        if (this.connection) {
            this.connection.write("0100000111040D12CA\r");
            mainWindow.webContents.send("basarili", "Çıkış bariyeri açıldı.");
        }
    }
}

function onConnData(d) {
    try {
        for (let i = 0; i < d.length; i++) arr.push("0x" + d[i].toString(16));
        if (!arr.includes('0x51')) return;
        for (var i = 0; i < arr.length - 4; i++) {
            if (arr[i] == 0x51) {
                if (arr.Length < i + 3) return;
                var hex1 = byteToHex(arr[i + 1]);
                var hex2 = byteToHex(arr[i + 2]);
                var hex3 = byteToHex(arr[i + 3]);
                arr = [];

                var data = parseInt(hex1 + hex2 + hex3, 16);
                printToAngular("Parsed TCP data => " + data);
                tcpmessages.push(data);

                if (tcpmessages.length == 10) {
                    let allSame = [...new Set(tcpmessages)].length == 1;
                    if (allSame) {
                        printToAngular("TCP MESSAGE => " + tcpmessages[0].toString());
                        mainWindow.webContents.send("tcp", tcpmessages[0].toString());
                        console.log(data);
                        tcpmessages = [];
                    } else {
                        tcpmessages = tcpmessages.slice(1);
                    }
                }
            }
        }
    } catch (error) {
        console.log("on connection data error : " + error);
    }
}

function byteToHex(byte) {
    const unsignedByte = byte & 0xff;
    if (unsignedByte < 16) {
        return "0" + unsignedByte.toString(16);
    } else {
        return unsignedByte.toString(16);
    }
}

function onConnError(err) {
    console.log("Connection %s error: %s", remoteAddress, err.message);
}

module.exports = AntenTcp;