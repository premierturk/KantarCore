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
      var client = net.connect(
        { port: AppConfig.antenport, host: AppConfig.antenip },
        () => {
          AntenTcp.connection = null;
          console.log("Baglanti Sonlandirildi!");
          printToAngular("Baglanti Sonlandirildi!");
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

// function onConnData(d) {
//   try {
//     let arr = [];

//     // d arrayindeki byte'ları hex string'e çevir
//     for (let i = 0; i < d.length; i++) {
//       arr.push("0x" + d[i].toString(16).padStart(2, "0"));
//     }

//     // Eğer gerekli byte'lar yoksa işlemi bitir
//     if (!arr.includes("0x51") && !arr.includes("0x13")) return;

//     for (let i = 0; i < arr.length - 4; i++) {
//       if (arr[i] === "0x51" || arr[i] === "0x13") {
//         if (arr.length < i + 4) return;

//         // Sonraki 3 byte'ı birleştirip hex string oluştur
//         const hex1 = arr[i + 1].slice(2); // '0x' kısmını at
//         const hex2 = arr[i + 2].slice(2);
//         const hex3 = arr[i + 3].slice(2);

//         arr = [];

//         const data = parseInt(hex1 + hex2 + hex3, 16);

//         if (!data.toString().startsWith("1001")) return;

//         tcpmessages.push(data);

//         // if (tcpmessages.length === 2) {
//         // const allSame = new Set(tcpmessages).size === 1;
//         // if (allSame) {
//         mainWindow.webContents.send("tcp", data.toString());
//         console.log("TCP MESAJI =>", data.toString());
//         tcpmessages = [];
//         // } else {
//         //   tcpmessages = tcpmessages.slice(1); // yalnızca sonuncuyu tut
//         // }
//         // }
//       }
//     }
//   } catch (e) {
//     console.error("TCP verisi işlenirken hata:", e);
//   }
// }

// function onConnData(d) {
//   try {
//     const buffer = Buffer.from(d);
//     const results = []; // Tüm bulunan değerleri burada saklayacağız

//     let offset = 0; // Aramaya başlayacağımız konum

//     // Buffer içinde 152 (0x98) değerinin her geçtiği yeri bulmak için döngü kullanıyoruz.
//     // indexOf'un ikinci parametresi (fromIndex) sayesinde aramaya kaldığımız yerden devam edebiliriz.
//     while (offset < buffer.length) {
//       let markerIndex = buffer.indexOf(152, offset);

//       // Eğer 152 bulunamazsa veya buffer'ın sonuna ulaştıysak döngüyü kır.
//       if (markerIndex === -1) {
//         break;
//       }

//       // 152 bulundu. Şimdi ondan sonraki 2 baytı kontrol edelim.
//       // Toplamda markerIndex + 1 (152'nin kendisi) + 2 (sonraki 2 bayt) = 3 bayt.
//       // Yani markerIndex + 3'e kadar olan veriye ihtiyacımız var.
//       if (buffer.length < markerIndex + 3) {
//         // Yeterli bayt yoksa, bu 152'yi işleyemeyiz. Sonraki aramaya geçmek için offset'i artırıyoruz.
//         offset = markerIndex + 1;
//         continue;
//       }

//       // 152'nin kendisi ve sonraki iki baytı alıyoruz.
//       // Sizin "98 D0 65" örneğinizdeki gibi, 152 (0x98) ilk bayt olacak.
//       const byte1 = buffer[markerIndex]; // 152 (0x98)
//       const byte2 = buffer[markerIndex + 1];
//       const byte3 = buffer[markerIndex + 2];

//       // Undefined kontrolü
//       if (byte1 === undefined || byte2 === undefined || byte3 === undefined) {
//         // Bu durum teorik olarak üstteki buffer.length kontrolüyle yakalanmalı,
//         // ama yine de defensive bir kontrol olarak kalabilir.
//         offset = markerIndex + 1;
//         continue;
//       }

//       // Bitwise işlemlerle sayıyı birleştir.
//       const data = (byte1 << 16) | (byte2 << 8) | byte3;
//       const dataString = data.toString();

//       // "1001" ile başlayıp başlamadığını kontrol et.
//       if (dataString.startsWith("1001")) {
//         // Şarta uyan her değeri sonuçlar dizisine ekle.
//         results.push(dataString);
//       }

//       // Bir sonraki 152'yi aramak için aramayı, mevcut 152'nin bir sonraki konumundan başlat.
//       // Bu, aynı 152'yi tekrar işlememizi engeller.
//       offset = markerIndex + 1;
//     }
//     // Eğer sonuçlar varsa, bunları Angular'a gönder.
//     if (results.length > 0) {
//       const allSame = new Set(results).size === 1;

//       if (allSame) {
//         mainWindow.webContents.send("tcp", results[0].toString());
//         console.log("TCP MESAJI =>", results[0].toString());
//         results = [];
//       } else {
//         results = results.slice(1); // yalnızca sonuncuyu tut
//       }
//       // Tüm sonuçları tek bir mesaj olarak veya tek tek gönderebilirsiniz.
//       // Örnek: İlk bulunanı gönderiyoruz. Tümünü göndermek isterseniz join veya farklı bir yapı kullanın.
//       // mainWindow.webContents.send("tcp", results[0]);
//       // console.log("OGS Etiket Data =>", results[0]);

//       // Eğer sadece ilk uygun değeri gönderip sonra sıfırlamak istiyorsanız:
//       // mainWindow.webContents.send("tcp", results[0]);
//       // console.log("İlk Bulunan TCP Mesajı =>", results[0]);
//       // tcpmessages = []; // İhtiyaca göre
//     }
//   } catch (e) {
//     console.error("TCP verisi işlenirken hata:", e);
//   }
// }

function onConnData(d) {
  const buffer = Buffer.from(d);
  const hexString = buffer.toString("hex");
  printToAngular("hex string : " + hexString);
  if (AppConfig.antenTip == "hopland") {
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
  } else {
    let markerIndex = buffer.indexOf(13);
    if (markerIndex === -1) {
      markerIndex = buffer.indexOf(11);
      if (markerIndex === -1) {
        buffer.forEach((element) => {
          tcpmessages.push(element);
        });
        return;
      } else {
        for (let index = 0; index < markerIndex; index++) {
          tcpmessages.push(buffer[index]);
        }
      }
    }
    if (tcpmessages[tcpmessages.length - 4].toString() == "64") {
      const hex1 = tcpmessages[tcpmessages.length - 1];
      const hex2 = tcpmessages[tcpmessages.length - 2];
      const hex3 = tcpmessages[tcpmessages.length - 3];
      const hex4 = tcpmessages[tcpmessages.length - 4];
      if (
        hex1 === undefined ||
        hex2 === undefined ||
        hex3 === undefined ||
        hex4 === undefined
      ) {
        return;
      }
      const data = (hex4 << 24) | (hex3 << 16) | (hex2 << 8) | hex1;
      const dataString = data.toString(16).padStart(8, "0");
      if (dataString.startsWith("4001")) {
        if (tcpmessages.length > 0) {
          mainWindow.webContents.send("tcp", dataString);
          tcpmessages = [];
          console.log("TCP MESAJI =>", dataString);
        }
      }
    } else {
      const hex1 = tcpmessages[tcpmessages.length - 1];
      const hex2 = tcpmessages[tcpmessages.length - 2];
      const hex3 = tcpmessages[tcpmessages.length - 3];

      if (hex1 === undefined || hex2 === undefined || hex3 === undefined) {
        return;
      }
      const data = (hex3 << 16) | (hex2 << 8) | hex1;
      const dataString = data.toString();
      if (dataString.startsWith("1001")) {
        if (tcpmessages.length > 0) {
          mainWindow.webContents.send("tcp", dataString.toString());
          tcpmessages = [];
          console.log("TCP MESAJI =>", dataString.toString());
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
  console.log("Connection eror");
  printToAngular("Connection eror");
}

module.exports = AntenTcp;
