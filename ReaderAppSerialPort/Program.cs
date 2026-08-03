using System;
using System.IO.Ports;
using System.Linq;
using System.Collections.Generic;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Web.Script.Serialization;
using System.Windows.Forms;
using System.Drawing;

namespace RFIDEPCReader
{
  internal class Program
  {
    [System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetStdHandle(int nStdHandle);

    [System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetConsoleMode(IntPtr hConsoleHandle, out uint lpMode);

    [System.Runtime.InteropServices.DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool SetConsoleMode(IntPtr hConsoleHandle, uint dwMode);

    [System.Runtime.InteropServices.DllImport("kernel32.dll")]
    private static extern IntPtr GetConsoleWindow();

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    private const int STD_INPUT_HANDLE = -10;
    private const uint ENABLE_QUICK_EDIT_MODE = 0x0040;
    private const uint ENABLE_EXTENDED_FLAGS = 0x0080;

    private const int SW_HIDE = 0;
    private const int SW_SHOW = 5;

    private static NotifyIcon trayIcon;
    private static bool isConsoleVisible = false;

    private static void HideConsole()
    {
      try
      {
        string logPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ReaderAppLog.txt");
        IntPtr hWnd = GetConsoleWindow();
        System.IO.File.AppendAllText(logPath, $"[HIDE] Time: {DateTime.Now}, hWnd: {hWnd}\n");

        if (hWnd != IntPtr.Zero)
        {
          ShowWindow(hWnd, SW_HIDE);
          isConsoleVisible = false;
        }
      }
      catch (Exception ex)
      {
        try
        {
          string logPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ReaderAppLog.txt");
          System.IO.File.AppendAllText(logPath, $"[HIDE ERROR] {ex.Message}\n");
        }
        catch {}
      }
    }

    private static void ShowConsole()
    {
      try
      {
        string logPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ReaderAppLog.txt");
        IntPtr hWnd = GetConsoleWindow();
        System.IO.File.AppendAllText(logPath, $"[SHOW] Time: {DateTime.Now}, hWnd: {hWnd}\n");

        if (hWnd != IntPtr.Zero)
        {
          bool r1 = ShowWindow(hWnd, SW_SHOW);
          bool r2 = ShowWindow(hWnd, 9); // SW_RESTORE
          bool r3 = SetForegroundWindow(hWnd);
          System.IO.File.AppendAllText(logPath, $"[SHOW RESULTS] r1: {r1}, r2: {r2}, r3: {r3}\n");
          isConsoleVisible = true;
        }
        else
        {
          System.IO.File.AppendAllText(logPath, $"[SHOW] hWnd was zero! Cannot show.\n");
        }
      }
      catch (Exception ex)
      {
        try
        {
          string logPath = System.IO.Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "ReaderAppLog.txt");
          System.IO.File.AppendAllText(logPath, $"[SHOW ERROR] {ex.Message}\n");
        }
        catch {}
      }
    }

    private static void ToggleConsole()
    {
      if (isConsoleVisible)
        HideConsole();
      else
        ShowConsole();
    }

    private static void ExitApplication()
    {
      try
      {
        if (trayIcon != null)
        {
          trayIcon.Visible = false;
          trayIcon.Dispose();
        }
        Application.ExitThread();
      }
      catch {}
    }

    private static void StartTrayIcon()
    {
      Thread trayThread = new Thread(() =>
      {
        try
        {
          trayIcon = new NotifyIcon();
          trayIcon.Text = $"RFID EPC Reader ({comPortName})";
          trayIcon.Icon = SystemIcons.Application;

          ContextMenu trayMenu = new ContextMenu();
          trayMenu.MenuItems.Add("Göster", (s, e) => ShowConsole());
          trayMenu.MenuItems.Add("Gizle", (s, e) => HideConsole());
          trayMenu.MenuItems.Add("-");
          trayMenu.MenuItems.Add("Çıkış", (s, e) => ExitApplication());

          trayIcon.ContextMenu = trayMenu;
          trayIcon.DoubleClick += (s, e) => ToggleConsole();
          trayIcon.Visible = true;

          Application.Run();
        }
        catch {}
      });

      trayThread.SetApartmentState(ApartmentState.STA);
      trayThread.IsBackground = false;
      trayThread.Start();
      trayThread.Join();
    }

    private static void DisableQuickEdit()
    {
      try
      {
        IntPtr conIn = GetStdHandle(STD_INPUT_HANDLE);
        uint mode;
        if (GetConsoleMode(conIn, out mode))
        {
          mode &= ~ENABLE_QUICK_EDIT_MODE;
          mode |= ENABLE_EXTENDED_FLAGS;
          SetConsoleMode(conIn, mode);
        }
      }
      catch (Exception ex)
      {
        Console.WriteLine($"[BİLGİ] QuickEdit devre dışı bırakılamadı: {ex.Message}");
      }
    }

    private static int baudRate = 9600;
    private static object clientLock = new object();

    // Serial port yeniden bağlanma için
    private static string comPortName;

    private static List<TcpClient> connectedClients = new List<TcpClient>();
    private static List<byte> dataBuffer = new List<byte>();
    private static bool isRunning = true;
    private static object lockObject = new object();
    private static SerialPort serialPort;
    private static object serialPortLock = new object();
    private static TcpListener tcpListener;

    private static void AcceptClients()
    {
      try
      {
        while (true)
        {
          TcpClient client = tcpListener.AcceptTcpClient();

          // Zaman aşımları ve performans ayarları
          client.SendTimeout = 3000;    // 3 saniye yazma zaman aşımı
          client.ReceiveTimeout = 0;    // Okuma zaman aşımı yok (KantarCore pasif alıcı olduğu için bağlantı kopmamalı)
          client.NoDelay = true;        // Nagle algoritmasını devre dışı bırak, veriyi bekletmeden gönder

          lock (clientLock)
          {
            connectedClients.Add(client);
            string clientInfo = ((IPEndPoint)client.Client.RemoteEndPoint).Address.ToString();
            Console.WriteLine($"[TCP] Yeni bağlantı: {clientInfo} (Toplam: {connectedClients.Count})");
          }

          // Client okuma thread'i başlat
          Thread clientThread = new Thread(() => HandleClient(client));
          clientThread.IsBackground = true;
          clientThread.Start();
        }
      }
      catch (Exception ex)
      {
        Console.WriteLine($"[TCP] AcceptClients Hatası: {ex.Message}");
      }
    }

    private static void AnalizeEPCData(byte[] epcData)
    {
      if (epcData.Length < 4)
        return;

      string epcNumber = "";

      // 10 byte veri: Kısa format (örn: 40010993)
      if (epcData.Length == 10)
      {
        byte[] epcBytes = new byte[4];
        Array.Copy(epcData, 1, epcBytes, 0, 4);
        epcNumber = BitConverter.ToString(epcBytes).Replace("-", "");
      }
      // 18 byte veri: Uzun format (örn: 10016536)
      else if (epcData.Length == 18)
      {
        byte[] epcBytes = new byte[3];
        Array.Copy(epcData, 10, epcBytes, 0, 3);
        string hexValue = BitConverter.ToString(epcBytes).Replace("-", "");
        long decValue = Convert.ToInt64(hexValue, 16);
        epcNumber = decValue.ToString();
      }

      // Doğrulama: Tam 8 hane, sadece rakam, ve 4001/1001 ile başlamalı
      if (!string.IsNullOrEmpty(epcNumber)
          && epcNumber.Length == 8
          && epcNumber.All(char.IsDigit)
          && (epcNumber.StartsWith("4001") || epcNumber.StartsWith("1001")))
      {
        Console.WriteLine(epcNumber);
        BroadcastToAllClients(epcNumber);
      }
    }

    private static void BroadcastToAllClients(string message)
    {
      lock (clientLock)
      {
        List<TcpClient> disconnectedClients = new List<TcpClient>();

        foreach (var client in connectedClients)
        {
          try
          {
            if (client.Connected)
            {
              NetworkStream stream = client.GetStream();
              byte[] data = Encoding.UTF8.GetBytes(message + "\n");
              stream.Write(data, 0, data.Length);
            }
            else
            {
              disconnectedClients.Add(client);
            }
          }
          catch
          {
            disconnectedClients.Add(client);
          }
        }

        // Bağlantısı kopan clientları temizle
        foreach (var client in disconnectedClients)
        {
          connectedClients.Remove(client);
          try { client.Close(); } catch { }
        }
      }
    }

    private static void HandleClient(TcpClient client)
    {
      string clientInfo = "Bilinmeyen";
      try { clientInfo = ((IPEndPoint)client.Client.RemoteEndPoint).Address.ToString(); } catch { }

      try
      {
        NetworkStream stream = client.GetStream();
        byte[] buffer = new byte[4096];
        StringBuilder jsonBuffer = new StringBuilder();

        while (client.Connected)
        {
          int bytesRead = stream.Read(buffer, 0, buffer.Length);
          if (bytesRead == 0)
            break;

          string receivedData = Encoding.UTF8.GetString(buffer, 0, bytesRead);
          Console.WriteLine($"{receivedData}");

          try
          {
            // Gelen veriyi JSON buffer'a ekle
            jsonBuffer.Append(receivedData);
            string accumulated = jsonBuffer.ToString().Trim();

            // JSON verisi içeriyor mu kontrol et
            if (accumulated.Contains("{"))
            {
              // JSON mesajlarını tek tek çıkar ve işle
              while (true)
              {
                int jsonStart = accumulated.IndexOf('{');
                if (jsonStart == -1)
                  break;

                // JSON başlangıcından önce hex veri varsa onu işle
                if (jsonStart > 0)
                {
                  string preData = accumulated.Substring(0, jsonStart).Trim();
                  if (!string.IsNullOrEmpty(preData))
                  {
                    ProcessHexData(preData);
                  }
                }

                // Eşleşen kapanış süslü parantezini bul
                int braceCount = 0;
                int jsonEnd = -1;
                for (int i = jsonStart; i < accumulated.Length; i++)
                {
                  if (accumulated[i] == '{') braceCount++;
                  else if (accumulated[i] == '}') braceCount--;

                  if (braceCount == 0)
                  {
                    jsonEnd = i;
                    break;
                  }
                }

                if (jsonEnd == -1)
                {
                  // JSON henüz tamamlanmadı, sonraki okumayı bekle
                  // Sadece JSON başlangıcından itibaren tut
                  jsonBuffer.Clear();
                  jsonBuffer.Append(accumulated.Substring(jsonStart));
                  break;
                }

                // Tam JSON mesajını çıkar
                string jsonMessage = accumulated.Substring(jsonStart, jsonEnd - jsonStart + 1);
                accumulated = accumulated.Substring(jsonEnd + 1).Trim();

                // PTS JSON VERİSİ
                /*
                 * {"plate":"34OTO34","ts":"2026-06-29T15:33:03","evidence":"data/evidence/34OTO34_20260629_153303.jpg"}
                 */
                try
                {
                  var pts = new JavaScriptSerializer().Deserialize<PtsPayload>(jsonMessage);
                  if (pts != null && !string.IsNullOrEmpty(pts.plate))
                  {
                    Console.WriteLine($"[PTS] {pts.plate}");
                    BroadcastToAllClients(jsonMessage);
                  }
                }
                catch (Exception ex)
                {
                  Console.WriteLine($"[UYARI] JSON parse hatası: {ex.Message}");
                }
              }

              // Kalan veriyi buffer'da tut (tamamlanmamış JSON veya hex veri)
              if (!accumulated.Contains("{"))
              {
                jsonBuffer.Clear();
                if (!string.IsNullOrEmpty(accumulated))
                {
                  // Kalan hex veri varsa işle
                  ProcessHexData(accumulated);
                }
              }
            }
            else
            {
              // JSON yok, HGS hex verisi olarak işle
              jsonBuffer.Clear();
              ProcessHexData(accumulated);
            }

            // Buffer çok büyürse temizle (koruma)
            if (jsonBuffer.Length > 10000)
            {
              Console.WriteLine("[UYARI] TCP JSON buffer çok büyüdü, temizleniyor...");
              jsonBuffer.Clear();
            }
          }
          catch (Exception ex)
          {
            Console.WriteLine($"[HATA] Veri işleme hatası: {ex.Message}");
          }
        }
      }
      catch { }
      finally
      {
        lock (clientLock)
        {
          connectedClients.Remove(client);
          Console.WriteLine($"[TCP] Bağlantı kesildi (Kalan: {connectedClients.Count})");
        }
        try { client.Close(); } catch { }
      }
    }

    private static bool IsValidHex(string str)
    {
      return str.All(c => (c >= '0' && c <= '9') || (c >= 'A' && c <= 'F') || (c >= 'a' && c <= 'f'));
    }

    private static void ProcessHexData(string rawData)
    {
      // HGS ANTEN VERİSİ
      // Gelen verideki boşluk ve satır atlamaları temizle
      string hexStr = rawData.Trim().Replace(" ", "").Replace("\r", "").Replace("\n", "");

      if (string.IsNullOrEmpty(hexStr))
        return;

      // Geçerli hex karakteri kontrolü — geçersizse seri porta yazma
      if (!IsValidHex(hexStr))
      {
        Console.WriteLine($"[UYARI] Geçersiz hex veri atlandı: {hexStr}");
        return;
      }

      // Uzunluk tek ise başa 0 ekle ki byte çevriminde hata olmasın
      if (hexStr.Length % 2 != 0)
        hexStr = "0" + hexStr;

      // Hex stringi byte dizisine çevir
      byte[] hexBytes = new byte[hexStr.Length / 2];
      for (int i = 0; i < hexBytes.Length; i++)
      {
        hexBytes[i] = Convert.ToByte(hexStr.Substring(i * 2, 2), 16);
      }

      // Seri porta yaz
      lock (serialPortLock)
      {
        if (serialPort != null && serialPort.IsOpen)
        {
          serialPort.Write(hexBytes, 0, hexBytes.Length);
          Console.WriteLine($"[SERI PORT] Veri yazıldı: {hexStr}");
        }
        else
        {
          Console.WriteLine($"[SERI PORT] Port açık değil, veri yazılamadı.");
        }
      }
    }

    private static void Main(string[] args)
    {
      // Başlangıçta konsol ekranını gizle
      HideConsole();

      // CMD ekranına tıklanınca donmayı engellemek için QuickEdit modunu kapat
      DisableQuickEdit();

      Console.Title = "RFID EPC TCP Server";
      Console.WriteLine("=== RFID EPC TCP Server ===\n");

      // Argüman kontrolü
      if (args.Length < 2)
      {
        Console.WriteLine("Kullanım: RFIDEPCReader.exe <COM_PORT> <TCP_PORT>");
        Console.WriteLine("Örnek: RFIDEPCReader.exe COM2 5000");
        ShowConsole();
        return;
      }

      comPortName = args[0];
      int tcpPort = int.Parse(args[1]);

      // Mutex ile tek instance kontrolü
      bool createdNew;
      using (Mutex mutex = new Mutex(true, "ReaderAppSerialPort" + comPortName + tcpPort, out createdNew))
      {
        if (!createdNew)
        {
          Console.WriteLine("Uygulama zaten çalışıyor! Sadece bir adet çalışabilir.");
          return;
        }

        try
        {
          // İlk bağlantıyı aç
          OpenSerialPort();

          // Serial port izleme thread'i başlat
          Thread monitorThread = new Thread(MonitorSerialPort);
          monitorThread.IsBackground = true;
          monitorThread.Start();

          // TCP Server başlat
          tcpListener = new TcpListener(IPAddress.Any, tcpPort);
          tcpListener.Start();
          Console.WriteLine($"✓ TCP Server başlatıldı: Port {tcpPort}");
          Console.WriteLine($"  Bağlantı için: telnet localhost {tcpPort}");

          // Client kabul etmek için thread başlat
          Thread acceptThread = new Thread(AcceptClients);
          acceptThread.IsBackground = true;
          acceptThread.Start();

          Console.WriteLine("\n" + new string('-', 60));
          Console.WriteLine("EPC verileri bekleniyor...");
          Console.WriteLine("Sistem tepsisi (saatin yanı) aktif.");
          Console.WriteLine(new string('-', 60) + "\n");

          // Sistem tepsisi simgesi oluştur ve mesaj döngüsünü başlat (kapatılana kadar bloke eder)
          StartTrayIcon();
        }
        catch (Exception ex)
        {
          Console.WriteLine($"Hata: {ex.Message}");
        }
        finally
        {
          // Uygulamayı durdur
          isRunning = false;

          // Temizlik
          lock (serialPortLock)
          {
            if (serialPort != null && serialPort.IsOpen)
            {
              serialPort.Close();
              Console.WriteLine("\nSerial Port kapatıldı.");
            }
          }

          if (tcpListener != null)
          {
            tcpListener.Stop();
            Console.WriteLine("TCP Server kapatıldı.");
          }

          lock (clientLock)
          {
            foreach (var client in connectedClients)
            {
              try { client.Close(); } catch { }
            }
            connectedClients.Clear();
          }
        }

        Console.WriteLine("\nUygulama sonlandırılıyor...");
        Thread.Sleep(1000);
      }
    }

    private static void MonitorSerialPort()
    {
      int reconnectAttempt = 0;
      const int maxReconnectDelay = 30; // Maksimum 30 saniye bekle

      while (isRunning)
      {
        try
        {
          bool needsReconnect = false;

          lock (serialPortLock)
          {
            // Port null ise veya açık değilse yeniden bağlanma gerekiyor
            if (serialPort == null || !serialPort.IsOpen)
            {
              needsReconnect = true;
            }
          }

          if (needsReconnect)
          {
            reconnectAttempt++;
            int delay = Math.Min(reconnectAttempt * 2, maxReconnectDelay);

            Console.WriteLine($"[BİLGİ] Serial Port bağlantısı koptu. {delay} saniye sonra yeniden bağlanılacak... (Deneme: {reconnectAttempt})");
            Thread.Sleep(delay * 1000);

            if (isRunning)
            {
              Console.WriteLine($"[BİLGİ] Yeniden bağlanılıyor: {comPortName}");
              OpenSerialPort();

              // Başarılı bağlantıda sayacı sıfırla
              lock (serialPortLock)
              {
                if (serialPort != null && serialPort.IsOpen)
                {
                  reconnectAttempt = 0;
                  Console.WriteLine($"✓ Yeniden bağlantı başarılı!");
                }
              }
            }
          }
          else
          {
            // Port açıksa sayacı sıfırla
            reconnectAttempt = 0;
          }

          // Her 5 saniyede bir kontrol et
          Thread.Sleep(5000);
        }
        catch (Exception ex)
        {
          Console.WriteLine($"[HATA] Monitor hatası: {ex.Message}");
          Thread.Sleep(5000);
        }
      }
    }

    private static void OpenSerialPort()
    {
      lock (serialPortLock)
      {
        try
        {
          // Eğer port açıksa önce kapat
          if (serialPort != null && serialPort.IsOpen)
          {
            serialPort.DataReceived -= SerialPort_DataReceived;
            serialPort.ErrorReceived -= SerialPort_ErrorReceived;
            serialPort.Close();
            serialPort.Dispose();
            Thread.Sleep(500); // Portun tamamen kapanması için bekle
          }

          // Yeni port örneği oluştur
          serialPort = new SerialPort
          {
            PortName = comPortName,
            BaudRate = baudRate,
            DataBits = 8,
            Parity = Parity.None,
            StopBits = StopBits.One,
            ReadTimeout = 1000,
            WriteTimeout = 1000
          };

          // Event handler'ları ekle
          serialPort.DataReceived += SerialPort_DataReceived;
          serialPort.ErrorReceived += SerialPort_ErrorReceived;

          // Port'u aç
          serialPort.Open();

          Console.WriteLine($"✓ Serial Port: {serialPort.PortName} açıldı");
          Console.WriteLine($"✓ Baud Rate: {serialPort.BaudRate}");
        }
        catch (Exception ex)
        {
          Console.WriteLine($"[HATA] Serial Port açılamadı: {ex.Message}");
          serialPort = null;
        }
      }
    }

    private static List<byte[]> ProcessBuffer()
    {
      List<byte[]> packets = new List<byte[]>();

      while (true)
      {
        int startIndex = dataBuffer.IndexOf(0x00);
        if (startIndex == -1)
        {
          dataBuffer.Clear();
          break;
        }

        if (startIndex > 0)
        {
          dataBuffer.RemoveRange(0, startIndex);
          startIndex = 0;
        }

        int endIndex = dataBuffer.IndexOf(0xEE);
        if (endIndex == -1)
        {
          break;
        }

        int packetLength = endIndex + 1;
        byte[] packet = dataBuffer.GetRange(0, packetLength).ToArray();
        dataBuffer.RemoveRange(0, packetLength);

        packets.Add(packet);
      }

      if (dataBuffer.Count > 1000)
      {
        Console.WriteLine("\n[UYARI] Buffer çok büyüdü, temizleniyor...\n");
        dataBuffer.Clear();
      }

      return packets;
    }

    private static void SerialPort_DataReceived(object sender, SerialDataReceivedEventArgs e)
    {
      List<byte[]> packetsToProcess = null;

      lock (serialPortLock)
      {
        try
        {
          SerialPort sp = (SerialPort)sender;

          if (sp == null || !sp.IsOpen)
            return;

          int bytesToRead = sp.BytesToRead;

          if (bytesToRead > 0)
          {
            byte[] buffer = new byte[bytesToRead];
            sp.Read(buffer, 0, bytesToRead);

            lock (lockObject)
            {
              dataBuffer.AddRange(buffer);
              packetsToProcess = ProcessBuffer();
            }
          }
        }
        catch (Exception ex)
        {
          Console.WriteLine($"Okuma Hatası: {ex.Message}");
        }
      }

      // Kilitler serbest kaldıktan sonra EPC paketlerini işle ve yayına gönder
      if (packetsToProcess != null && packetsToProcess.Count > 0)
      {
        foreach (var packet in packetsToProcess)
        {
          try
          {
            AnalizeEPCData(packet);
          }
          catch (Exception ex)
          {
            Console.WriteLine($"[HATA] Paket analiz hatası: {ex.Message}");
          }
        }
      }
    }

    private static void SerialPort_ErrorReceived(object sender, SerialErrorReceivedEventArgs e)
    {
      Console.WriteLine($"[UYARI] Serial Port Hatası: {e.EventType}");
    }

    private class PtsPayload
    {
      public string plate { get; set; }
      public string ts { get; set; }
      public string evidence { get; set; }
    }
  }

  // RTSP YAYINI : rtsp://admin:Rbyl!1524@10.210.210.XX:554/Streaming/Channels/101
}
