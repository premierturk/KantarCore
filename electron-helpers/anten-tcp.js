const net = require("net");
//#region main.js variables
var mainWindow;
var printToAngular;
//#endregion

var tcpmessages = [];
var arr = [];

function initializeMainJsVariables() {
  const mainJs = require("../main");
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
    AntenTcp.connection = conn;
    var remoteAddress = conn.remoteAddress + ":" + conn.remotePort;
    console.log("new client connection from " + remoteAddress);
    printToAngular("new client connection from " + remoteAddress);
    conn.on("data", onConnData);
    conn.on("error", onConnError);
    conn.on("close", () =>
      console.log("connection closed from " + remoteAddress)
    );
  }

  static openBariyer(event) {
    if (AntenTcp.connection) {
      AntenTcp.connection.write("0100000111040D12CA");
      mainWindow.webContents.send("basarili", "Çıkış bariyeri açıldı.");
    }
  }
}

function onConnData(d) {
  try {
    let arr = [];

    // d arrayindeki byte'ları hex string'e çevir
    for (let i = 0; i < d.length; i++) {
      arr.push("0x" + d[i].toString(16).padStart(2, "0"));
    }

    // Eğer gerekli byte'lar yoksa işlemi bitir
    if (!arr.includes("0x51") && !arr.includes("0x13")) return;

    for (let i = 0; i < arr.length - 4; i++) {
      if (arr[i] === "0x51" || arr[i] === "0x13") {
        if (arr.length < i + 4) return;

        // Sonraki 3 byte'ı birleştirip hex string oluştur
        const hex1 = arr[i + 1].slice(2); // '0x' kısmını at
        const hex2 = arr[i + 2].slice(2);
        const hex3 = arr[i + 3].slice(2);

        arr = [];

        const data = parseInt(hex1 + hex2 + hex3, 16);

        if (!data.toString().startsWith("1001")) return;

        tcpmessages.push(data);

        // if (tcpmessages.length === 2) {
        // const allSame = new Set(tcpmessages).size === 1;
        // if (allSame) {
        mainWindow.webContents.send("tcp", data.toString());
        console.log("TCP MESAJI =>", data.toString());
        tcpmessages = [];
        // } else {
        //   tcpmessages = tcpmessages.slice(1); // yalnızca sonuncuyu tut
        // }
        // }
      }
    }
  } catch (e) {
    console.error("TCP verisi işlenirken hata:", e);
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
