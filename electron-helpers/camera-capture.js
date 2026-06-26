const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("child_process");
const axios = require("axios");

async function uploadImage(
  uploadUrl,
  id,
  isHafriyatDokum,
  filename,
  filePath,
  printToAngular,
) {
  try {
    const boundary =
      "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
    const fileBuffer = fs.readFileSync(filePath);

    const bodyBuffer = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="Id"\r\n\r\n`),
      Buffer.from(`${id || 0}\r\n`),

      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(
        `Content-Disposition: form-data; name="IsHafriyatDokum"\r\n\r\n`,
      ),
      Buffer.from(`${isHafriyatDokum != null ? isHafriyatDokum : ""}\r\n`),

      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="Name"\r\n\r\n`),
      Buffer.from(`${filename}\r\n`),

      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(
        `Content-Disposition: form-data; name="File"; filename="${filename}"\r\n`,
      ),
      Buffer.from(`Content-Type: image/jpeg\r\n\r\n`),
      fileBuffer,
      Buffer.from(`\r\n`),

      Buffer.from(`--${boundary}--\r\n`),
    ]);

    printToAngular(`Gorsel API'ye yukleniyor: ${uploadUrl}`);
    console.log(`Uploading to ${uploadUrl}...`);

    const response = await axios.post(uploadUrl, bodyBuffer, {
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
    });

    printToAngular(
      `Gorsel basariyla yuklendi: ${filename} (Sunucu yaniti: ${JSON.stringify(response.data)})`,
    );
    console.log("Upload response:", response.status, response.data);
    return response.data;
  } catch (err) {
    const errMsg = err.response
      ? JSON.stringify(err.response.data)
      : err.message;
    printToAngular(`HATA: Gorsel yuklenemedi (${filename}): ${errMsg}`);
    console.error("Upload failed:", err.message);
    if (err.response) {
      console.error("Response data:", err.response.data);
    }
    throw err;
  }
}

class CameraCapture {
  static captureCameras(event, payload) {
    const mainJs = require("../main");
    const printToAngular = mainJs.printToAngular;

    try {
      const { plaka, cameras, uploadUrl, id, isHafriyatDokum } = payload || {};
      printToAngular("Kamera yakalama baslatildi...");
      console.log("Kamera yakalama baslatildi...", payload);

      const targetDir = os.tmpdir();
      printToAngular(`Gecici hedef dizin: ${targetDir}`);

      const ffmpegPath = path.join(__dirname, "..", "ffmpeg", "ffmpeg.exe");
      printToAngular(`ffmpeg.exe yolu: ${ffmpegPath}`);
      if (!fs.existsSync(ffmpegPath)) {
        printToAngular(`HATA: ffmpeg.exe bulunamadı! Yol: ${ffmpegPath}`);
        console.error(`ffmpeg.exe bulunamadi! Yol: ${ffmpegPath}`);
        return;
      }

      if (!cameras || cameras.length === 0) {
        printToAngular("Kameralar listesi bos.");
        return;
      }

      // Bağıntılı URL'leri Node.js tarafında mutlak hale getir
      let finalUploadUrl = uploadUrl;
      if (uploadUrl && uploadUrl.startsWith("/")) {
        const AppConfig = require("./app-config");
        finalUploadUrl = `${AppConfig.url}/HYS.WebApi${uploadUrl}`;
      }

      cameras.forEach((cam) => {
        const { name, url } = cam;
        if (!name || !url) {
          printToAngular("Eksik kamera adi veya URL bilgisi atlandi.");
          return;
        }

        // Dosya adı formatı: [Plaka]-[KameraAdı]
        const rawFileName = `${plaka || "BilinmeyenPlaka"}-${name}`;
        // Dosya adı için geçersiz karakterleri temizle
        const sanitizedName = rawFileName.replace(/[\/\\:*?"<>|]/g, "_");
        const filename = `${sanitizedName}.jpg`;
        const outputPath = path.join(targetDir, filename);

        printToAngular(`Kamera capture basliyor: ${name} -> ${outputPath}`);
        console.log(`Kamera capture basliyor: ${name} -> ${outputPath}`);

        // Güvenli, son derece hızlı ve optimize edilmiş FFmpeg komut argümanları
        const args = [
          "-skip_frame",
          "nokey",
          "-rtsp_transport",
          "tcp",
          "-fflags",
          "nobuffer",
          "-flags",
          "low_delay",
          "-strict",
          "experimental",
          "-analyzeduration",
          "100000",
          "-probesize",
          "100000",
          "-i",
          url,
          "-vframes",
          "1",
          "-y",
          outputPath,
        ];

        printToAngular(
          `FFmpeg komutu calistiriliyor: ffmpeg ${args.join(" ")}`,
        );

        const child = spawn(ffmpegPath, args);

        child.on("error", (err) => {
          printToAngular(
            `HATA [${name}]: FFmpeg baslatilamadi: ${err.message}`,
          );
          console.error(err);
        });

        const timeoutId = setTimeout(() => {
          printToAngular(`Kamera capture zaman asimi (15s): ${name}`);
          console.log(`Killing ffmpeg for camera ${name} due to timeout.`);
          child.kill("SIGKILL");
        }, 15000); // 15 seconds timeout

        child.on("close", async (code) => {
          clearTimeout(timeoutId);
          printToAngular(`Kamera capture tamamlandi: ${name} (Kod: ${code})`);
          console.log(
            `FFmpeg capture for camera ${name} completed with code ${code}`,
          );

          if (code === 0) {
            try {
              if (finalUploadUrl) {
                await uploadImage(
                  finalUploadUrl,
                  id,
                  isHafriyatDokum,
                  filename,
                  outputPath,
                  printToAngular,
                );
              } else {
                printToAngular(
                  `Bilgi: uploadUrl tanimlanmadigi icin yukleme yapilmadi.`,
                );
              }
            } catch (uploadErr) {
              console.error(`Upload error for ${name}:`, uploadErr.message);
            } finally {
              // Yüklemeden sonra geçici dosyayı temizle
              try {
                if (fs.existsSync(outputPath)) {
                  fs.unlinkSync(outputPath);
                  printToAngular(`Gecici dosya silindi: ${outputPath}`);
                }
              } catch (unlinkErr) {
                console.error(`Gecici dosya silinemedi:`, unlinkErr.message);
              }
            }
          }
        });

        child.stderr.on("data", (data) => {
          const msg = data.toString();
          console.log(`ffmpeg [${name}]: ${msg}`);
          printToAngular(`ffmpeg [${name}]: ${msg}`);
        });
      });
    } catch (error) {
      printToAngular(`Kamera yakalama ana fonksiyon hatasi: ${error.message}`);
      console.error("Kamera yakalama hatasi:", error);
    }
  }
}

module.exports = CameraCapture;
