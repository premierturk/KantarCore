const net = require("net");
const AppConfig = require("./app-config");
//#region main.js variables
var mainWindow;
var printToAngular;
//#endregion

var tcpmessages = [];
var arr = [];
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

    // PTS TCP Server — her zaman baslar (antenTip'ten bagimsiz)
    AntenTcp.startPtsServer();

    // HGS TCP Server — antenTip'e gore
    if (AppConfig.antenTip === "hopland") {
      AntenTcp.connectToHopland();
    } else if (AppConfig.antenTip && AppConfig.antenTip !== "antenyok") {
      AntenTcp.startHgsServer();
    } else {
      console.log("[HGS] antenTip yapilandirilmamis veya 'antenyok' — HGS server baslatilmadi.");
    }
  }

  // -----------------------------------------------------------------
  // PTS Server — Port 8081 — PlakaTespit.exe buraya baglanir
  // -----------------------------------------------------------------
  static startPtsServer() {
    try {
      const ptsServer = net.createServer((socket) => {
        let ptsBuffer = "";
        console.log("[PTS TCP] Yeni baglanti kabul edildi.");

        socket.on("data", (d) => {
          ptsBuffer += d.toString();

          let newlineIndex;
          while ((newlineIndex = ptsBuffer.indexOf("\n")) !== -1) {
            const line = ptsBuffer.substring(0, newlineIndex).trim();
            ptsBuffer = ptsBuffer.substring(newlineIndex + 1);

            if (line.length > 0) {
              mainWindow.webContents.send("plaka", line);
              console.log("[PTS] PLAKA =>", line);
            }
          }
        });

        socket.on("close", () => {
          // reconnect_each:true — baglanti her seferinde kapaniyor.
          // Kalan buffer'da veri varsa isle, sonra temizle.
          const remaining = ptsBuffer.trim();
          if (remaining.length > 0) {
            mainWindow.webContents.send("plaka", remaining);
            console.log("[PTS] PLAKA (close) =>", remaining);
          }
          ptsBuffer = ""; // Bir sonraki baglanti icin temizle
        });

        socket.on("error", (err) => {
          console.error("[PTS TCP] Soket hatasi:", err.message);
          ptsBuffer = "";
        });
      });

      ptsServer.on("error", (err) => {
        console.error("[PTS TCP] Sunucu hatasi:", err.message);
      });

      ptsServer.listen(8081, "0.0.0.0", () => {
        console.log("[PTS TCP] Sunucu 8081 portunda dinliyor.");
      });
    } catch (e) {
      console.error("[PTS TCP] Sunucu baslatılamadı:", e.message);
    }
  }

  // -----------------------------------------------------------------
  // HGS Server — Port 5555 — ReaderApp (Takipsan) buraya baglanir
  // -----------------------------------------------------------------
  static startHgsServer() {
    try {
      const hgsServer = net.createServer();
      hgsServer.on("connection", AntenTcp.handleConnection);
      hgsServer.on("error", (err) => {
        console.error("[HGS TCP] Sunucu hatasi:", err.message);
      });
      hgsServer.listen(5555, "0.0.0.0", () => {
        console.log("[HGS TCP] Sunucu 5555 portunda dinliyor.");
      });
    } catch (e) {
      console.error("[HGS TCP] Sunucu baslatılamadı:", e.message);
    }
  }

  // -----------------------------------------------------------------
  // Hopland — KantarCore disa baglanir (client)
  // -----------------------------------------------------------------
  static connectToHopland() {
    try {
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
      if (AntenTcp.connection) {
        AntenTcp.connection.destroy();
        AntenTcp.connection = null;
        console.log("[HGS Hopland] Baglanti sonlandirildi.");
      }
      var client = net.connect(
        { port: AppConfig.antenport, host: AppConfig.pcip },
        () => {
          AntenTcp.connection = client;
          console.log("[HGS Hopland] Sunucuya baglanildi!");
        },
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
        console.log("[HGS Hopland] Baglanti hatasi: " + err.message);
        if (!reconnectInterval) {
          reconnectInterval = setInterval(() => {
            AntenTcp.connectToHopland();
          }, 3000);
        }
      });
    } catch (error) {
      printToAngular("Beklenmeyen Hata Olustu!");
    }
  }

  static antenRestart() {
    if (AntenTcp.connection) {
      AntenTcp.connection.write("AA010F000094CF");
      mainWindow.webContents.send(
        "successRestart",
        "Anten Tekrardan Baslatildi.",
      );
      console.log("[HGS] Anten baslama komutu: AA010F000094CF");
    }
  }

  static handleConnection(conn) {
    AntenTcp.connection = conn;
    var remoteAddress = conn.remoteAddress + ":" + conn.remotePort;
    console.log("[HGS TCP] Yeni baglanti: " + remoteAddress);
    printToAngular("HGS baglantisi: " + remoteAddress);
    conn.on("data", onConnData);
    conn.on("error", onConnError);
    conn.on("close", () =>
      console.log("[HGS TCP] Baglanti kapandi: " + remoteAddress),
    );
  }

  static openBariyer(event) {
    if (AntenTcp.connection) {
      AntenTcp.connection.write("0100000111040D12CA");
      mainWindow.webContents.send("basarili", "Cikis bariyeri acildi.");
    }
  }
}

// -----------------------------------------------------------------
// HGS Veri Handler — ReaderApp / Hopland / Takipsan
// Sadece 1001 ve 4001 ile baslayan etiketleri IPC "hgs" olarak iletir
// -----------------------------------------------------------------
let tcpReadBuffer = "";

function onConnData(d) {
  const buffer = Buffer.from(d);
  const hexString = buffer.toString("hex");

  if (AppConfig.antenTip === "hopland" && !AppConfig.reader) {
    const searchStr = "4001";
    const indexStr = hexString.indexOf(searchStr);

    if (indexStr !== -1) {
      const yeniEtiketmesg = hexString.slice(indexStr, indexStr + 8);
      mainWindow.webContents.send("hgs", yeniEtiketmesg);
      console.log("[HGS] ETIKET (yeni format) =>", yeniEtiketmesg);
      return;
    } else {
      var eskiEtiketHex = hexString.slice(32, 38);
      var eskiEtiketmsg = parseInt(eskiEtiketHex, 16);

      if (
        AppConfig.url.includes("samsun") &&
        !String(eskiEtiketmsg).startsWith("103")
      ) {
        eskiEtiketHex = hexString.slice(31, 38);
        eskiEtiketmsg = parseInt(eskiEtiketHex, 16);
        mainWindow.webContents.send("hgs", eskiEtiketmsg);
        console.log("[HGS] ETIKET (samsun) =>", eskiEtiketmsg);
        return;
      }
      if (String(eskiEtiketmsg).startsWith("1001")) {
        mainWindow.webContents.send("hgs", eskiEtiketmsg);
        console.log("[HGS] ETIKET =>", eskiEtiketmsg);
        return;
      }
    }
    // Hopland modunda PTS JSON parse blogu KALDIRILDI.
    // PTS artik ayri porta (8081) geliyor, burada islenmez.

  } else if (AppConfig.reader) {
    tcpReadBuffer += d.toString();

    let newlineIndex;
    while ((newlineIndex = tcpReadBuffer.indexOf("\n")) !== -1) {
      const line = tcpReadBuffer.substring(0, newlineIndex).trim();
      tcpReadBuffer = tcpReadBuffer.substring(newlineIndex + 1);

      if (line.length > 0) {
        printToAngular("reader line : " + line);
        mainWindow.webContents.send("hgs", line);
        console.log("[HGS] ETIKET (reader) =>", line);
      }
    }
  } else {
    // Takipsan binary format
    buffer.forEach((element) => {
      arr.push(element);
    });
    if (arr.length > 100) {
      arr = [];
      return;
    }
    printToAngular("arr string : " + arr);

    // 1001 ile baslayanlar: 101,19,152
    let bindexb1 = arr.indexOf(101);
    let bindexb2 = arr.indexOf(19);
    let bindex = arr.indexOf(152);

    // 4001 ile baslayanlar: 238,0,64
    let dindexd1 = arr.indexOf(238);
    let dindexd2 = arr.indexOf(0);
    let dindex = arr.indexOf(64);

    if (
      bindexb1 !== -1 &&
      bindexb2 !== -1 &&
      bindex !== -1 &&
      bindex === bindexb2 + 1 &&
      bindexb2 === bindexb1 + 1
    ) {
      const hex1 = byteToHex(arr[bindex]);
      const hex2 = byteToHex(arr[bindex + 1]);
      const hex3 = byteToHex(arr[bindex + 2]);
      arr = [];
      if (hex1 === undefined || hex2 === undefined || hex3 === undefined) {
        return;
      }
      var data = parseInt(hex1 + hex2 + hex3, 16);
      var dataString = data.toString();
      if (dataString.startsWith("1001")) {
        tcpmessages.push(data);
        if (tcpmessages.length === 2) {
          let allSame = [...new Set(tcpmessages)].length === 1;
          if (allSame) {
            printToAngular("HGS ETIKET => " + dataString);
            mainWindow.webContents.send("hgs", dataString);
            console.log("[HGS] ETIKET (1001) =>", dataString);
            tcpmessages = [];
          } else {
            tcpmessages = tcpmessages.slice(1);
          }
        }
      }
    } else if (
      dindexd1 !== -1 &&
      dindexd2 !== -1 &&
      dindex !== -1 &&
      dindex === dindexd2 + 1 &&
      dindexd2 === dindexd1 + 1
    ) {
      const hex1 = byteToHex(arr[dindex]);
      const hex2 = byteToHex(arr[dindex + 1]);
      const hex3 = byteToHex(arr[dindex + 2]);
      const hex4 = byteToHex(arr[dindex + 3]);
      arr = [];
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
        tcpmessages.push(data);
        if (tcpmessages.length === 2) {
          let allSame = [...new Set(tcpmessages)].length === 1;
          if (allSame) {
            printToAngular("HGS ETIKET => " + dataString);
            mainWindow.webContents.send("hgs", dataString);
            console.log("[HGS] ETIKET (4001) =>", dataString);
            tcpmessages = [];
          } else {
            tcpmessages = tcpmessages.slice(1);
          }
        }
      }
    }
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
  console.log("[HGS TCP] Baglanti hatasi:", err.message);
  printToAngular("HGS Baglanti Hatasi");
}

module.exports = AntenTcp;
