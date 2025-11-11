const net = require("net");
const AppConfig = require("./app-config");
//#region main.js variables
var mainWindow;
var printToAngular;
//#endregion

var tcpmessages = [];
let reconnectInterval = null;
function initializeMainJsVariables() {
  const mainJs = require("../main");
  mainWindow = mainJs.mainWindow;
  printToAngular = mainJs.printToAngular;
}

class AntenTcp {
  static connection;

  static createServer() {
    initializeMainJsVariables();
    if (AppConfig.antenTip == "hopland") {
      this.connectToHopland();
    } else {
      console.log("Sunucuya baglanildi takipsan!");
      printToAngular("Sunucuya baglanildi takipsan!");
      var server = net.createServer();

      server.on("connection", this.handleConnection);

      server.listen(5555, function () {
        console.log("server listening to %j", server.address());
      });
    }
  }
  static connectToHopland() {
    try {
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
      if (AntenTcp.connection) {
        AntenTcp.connection.destroy();
        AntenTcp.connection = null;
        console.log("Baglanti Sonlandirildi!");
        printToAngular("Baglanti Sonlandirildi!");
      }
      var client = net.connect(
        { port: AppConfig.antenport, host: AppConfig.pcip },
        () => {
          AntenTcp.connection = client;
          console.log("Sunucuya baglanildi!");
          printToAngular("Sunucuya baglanildi!");
        }
      );
      client.on("data", (data) => {
        onConnData(data);
      });

      client.on("end", () => {
        AntenTcp.connection = null;
      });
      client.on("close", () => {
        AntenTcp.connection = null;
      });
      client.on("error", (err) => {
        console.log("Hata olustu (Antene Baglanilamadi): " + err.message);
        printToAngular("Hata olustu (Antene Baglanilamadi): " + err.message);
        if (!reconnectInterval) {
          reconnectInterval = setInterval(() => {
            AntenTcp.connectToHopland();
          }, 3000);
        }
      });
    } catch (error) {
      printToAngular("Beklenmeyen Hata Olustu !");
    }
  }

  static antenRestart() {
    if (AntenTcp.connection) {
      AntenTcp.connection.write("AA010F000094CF");
      mainWindow.webContents.send(
        "successRestart",
        "Anten Tekrardan Başlatıldı."
      );
      console.log("Anten başlatma komutu AA010F000094CF");
      printToAngular("Anten başlatma komutu AA010F000094CF");
    }
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
      // if (AppConfig.antenTip == "hopland") {
      //   AntenTcp.connection.write("AA010900020100FD93");
      //   AntenTcp.connection.write("AA010900020200FD93");
      //   mainWindow.webContents.send("basarili", "Çıkış bariyeri açıldı.");
      // } else {
      AntenTcp.connection.write("0100000111040D12CA");
      mainWindow.webContents.send("basarili", "Çıkış bariyeri açıldı.");
      // }
    }
  }
}

function onConnData(d) {
  const buffer = Buffer.from(d);
  const hexString = buffer.toString("hex");
  if (AppConfig.antenTip == "hopland" && !AppConfig.reader) {
    const searchStr = "4001";
    const indexStr = hexString.indexOf(searchStr);

    if (indexStr != -1) {
      const yeniEtiketmesg = hexString.slice(indexStr, indexStr + 8);
      mainWindow.webContents.send("tcp", yeniEtiketmesg);
    } else {
      var eskiEtiketHex = hexString.slice(32, 38);
      var eskiEtiketmsg = parseInt(eskiEtiketHex, 16);

      if (
        AppConfig.url.includes("samsun") &&
        !String(eskiEtiketmsg).startsWith("103")
      ) {
        eskiEtiketHex = hexString.slice(31, 38);
        eskiEtiketmsg = parseInt(eskiEtiketHex, 16);
        mainWindow.webContents.send("tcp", eskiEtiketmsg);
        console.log("TCP MESAJI =>", eskiEtiketmsg);
      }
      if (String(eskiEtiketmsg).startsWith("1001")) {
        mainWindow.webContents.send("tcp", eskiEtiketmsg);
        console.log("TCP MESAJI =>", eskiEtiketmsg);
      }
    }
  } else if (AppConfig.reader) {
    printToAngular("reader : " + d.toString());

    mainWindow.webContents.send("tcp", d.toString());
    console.log("TCP MESAJI =>", d.toString());
  } else {
    buffer.forEach((element) => {
      tcpmessages.push(element);
    });
    if (tcpmessages.length > 100) {
      tcpmessages = [];
      return;
    }
    printToAngular("tcpmessages string : " + tcpmessages);

    // 1001 ile başlayanlarda 101,19,152 gelir
    let bindexb1 = tcpmessages.indexOf(101);
    let bindexb2 = tcpmessages.indexOf(19);
    let bindex = tcpmessages.indexOf(152);

    // 4001 ile başlayanlarda 238,0,64 gelir
    let dindexd1 = tcpmessages.indexOf(238);
    let dindexd2 = tcpmessages.indexOf(0);
    let dindex = tcpmessages.indexOf(64);

    if (
      bindexb1 != -1 &&
      bindexb2 != -1 &&
      bindex != -1 &&
      bindex == bindexb2 + 1 &&
      bindexb2 == bindexb1 + 1
    ) {
      const hex1 = byteToHex(tcpmessages[bindex]);
      const hex2 = byteToHex(tcpmessages[bindex + 1]);
      const hex3 = byteToHex(tcpmessages[bindex + 2]);
      tcpmessages = [];
      if (hex1 === undefined || hex2 === undefined || hex3 === undefined) {
        return;
      }
      var data = parseInt(hex1 + hex2 + hex3, 16);
      var dataString = data.toString();
      if (dataString.startsWith("1001")) {
        printToAngular("TCP MESSAGE => " + dataString);
        mainWindow.webContents.send("tcp", dataString);
        tcpmessages = [];
      }
    } else if (
      dindexd1 != -1 &&
      dindexd2 != -1 &&
      dindex != -1 &&
      dindex == dindexd2 + 1 &&
      dindexd2 == dindexd1 + 1
    ) {
      const hex1 = byteToHex(tcpmessages[dindex]);
      const hex2 = byteToHex(tcpmessages[dindex + 1]);
      const hex3 = byteToHex(tcpmessages[dindex + 2]);
      const hex4 = byteToHex(tcpmessages[dindex + 3]);
      tcpmessages = [];
      if (
        hex1 === undefined ||
        hex2 === undefined ||
        hex3 === undefined ||
        hex4 === undefined
      ) {
        return;
      }
      var data = parseInt(hex1 + hex2 + hex3 + hex4);
      var dataString = data.toString();
      if (dataString.startsWith("4001")) {
        printToAngular("TCP MESSAGE => " + dataString);
        mainWindow.webContents.send("tcp", dataString);
        tcpmessages = [];
      }
    }

    // let markerIndex = buffer.indexOf(13);
    // if (markerIndex === -1) {
    //   markerIndex = buffer.indexOf(11);
    //   if (markerIndex === -1) {
    //     buffer.forEach((element) => {
    //       tcpmessages.push(element);
    //     });
    //     return;
    //   } else {
    //     for (let index = 0; index < markerIndex; index++) {
    //       tcpmessages.push(buffer[index]);
    //     }
    //   }
    // }
    // if (tcpmessages[tcpmessages.length - 4].toString() == "64") {
    //   const hex1 = tcpmessages[tcpmessages.length - 1];
    //   const hex2 = tcpmessages[tcpmessages.length - 2];
    //   const hex3 = tcpmessages[tcpmessages.length - 3];
    //   const hex4 = tcpmessages[tcpmessages.length - 4];
    //   if (
    //     hex1 === undefined ||
    //     hex2 === undefined ||
    //     hex3 === undefined ||
    //     hex4 === undefined
    //   ) {
    //     return;
    //   }
    //   const data = (hex4 << 24) | (hex3 << 16) | (hex2 << 8) | hex1;
    //   const dataString = data.toString(16).padStart(8, "0");
    //   if (dataString.startsWith("4001")) {
    //     if (tcpmessages.length > 0) {
    //       mainWindow.webContents.send("tcp", dataString);
    //       tcpmessages = [];
    //       console.log("TCP MESAJI =>", dataString);
    //     }
    //   }
    // } else {
    //   const hex1 = tcpmessages[tcpmessages.length - 1];
    //   const hex2 = tcpmessages[tcpmessages.length - 2];
    //   const hex3 = tcpmessages[tcpmessages.length - 3];
    //   if (hex1 === undefined || hex2 === undefined || hex3 === undefined) {
    //     return;
    //   }
    //   const data = (hex3 << 16) | (hex2 << 8) | hex1;
    //   const dataString = data.toString();
    //   if (dataString.startsWith("1001")) {
    //     if (tcpmessages.length > 0) {
    //       mainWindow.webContents.send("tcp", dataString.toString());
    //       tcpmessages = [];
    //       console.log("TCP MESAJI =>", dataString.toString());
    //     }
    //   }
    // }
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
  console.log("Connection eror");
  printToAngular("Connection eror");
}

module.exports = AntenTcp;
