using System;
using System.IO.Ports;
using System.Linq;
using System.Collections.Generic;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;

namespace RFIDEPCReader
{
    internal class Program
    {
        private static SerialPort serialPort;
        private static List<byte> dataBuffer = new List<byte>();
        private static object lockObject = new object();

        private static TcpListener tcpListener;
        private static List<TcpClient> connectedClients = new List<TcpClient>();
        private static object clientLock = new object();

        private static void Main(string[] args)
        {
            Console.Title = "RFID EPC TCP Server";
            Console.WriteLine("=== RFID EPC TCP Server ===\n");

            // Argüman kontrolü
            if (args.Length < 2)
            {
                Console.WriteLine("Kullanım: RFIDEPCReader.exe <COM_PORT> <TCP_PORT>");
                Console.WriteLine("Örnek: RFIDEPCReader.exe COM2 5000");
            }

            string comPort = args[0];
            int tcpPort = int.Parse(args[1]);

            // Mutex ile tek instance kontrolü
            bool createdNew;
            using (Mutex mutex = new Mutex(true, "ReaderAppSerialPort" + comPort + tcpPort, out createdNew))
            {
                if (!createdNew)
                {
                    Console.WriteLine("Uygulama zaten çalışıyor! Sadece bir adet çalışabilir.");
                    return;
                }

                try
                {
                    // Serial port ayarları
                    serialPort = new SerialPort
                    {
                        PortName = comPort,
                        BaudRate = 9600,
                        DataBits = 8,
                        Parity = Parity.None,
                        StopBits = StopBits.One,
                        ReadTimeout = 1000
                    };

                    // Port açma
                    serialPort.DataReceived += SerialPort_DataReceived;
                    serialPort.Open();

                    Console.WriteLine($"✓ Serial Port: {serialPort.PortName} açıldı");
                    Console.WriteLine($"✓ Baud Rate: {serialPort.BaudRate}");

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
                    Console.WriteLine("Çıkmak için 'Q' tuşuna basın");
                    Console.WriteLine(new string('-', 60) + "\n");

                    // Kullanıcı çıkış yapana kadar bekle
                    while (Console.ReadKey(true).Key != ConsoleKey.Q)
                    {
                        Thread.Sleep(100);
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Hata: {ex.Message}");
                }
                finally
                {
                    // Temizlik
                    if (serialPort != null && serialPort.IsOpen)
                    {
                        serialPort.Close();
                        Console.WriteLine("\nSerial Port kapatıldı.");
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

        private static void AcceptClients()
        {
            try
            {
                while (true)
                {
                    TcpClient client = tcpListener.AcceptTcpClient();

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

        private static void HandleClient(TcpClient client)
        {
            try
            {
                NetworkStream stream = client.GetStream();
                byte[] buffer = new byte[1024];

                while (client.Connected)
                {
                    int bytesRead = stream.Read(buffer, 0, buffer.Length);
                    if (bytesRead == 0)
                        break;
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
                            byte[] data = Encoding.UTF8.GetBytes(message);
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

        private static void SerialPort_DataReceived(object sender, SerialDataReceivedEventArgs e)
        {
            try
            {
                SerialPort sp = (SerialPort)sender;
                int bytesToRead = sp.BytesToRead;

                if (bytesToRead > 0)
                {
                    byte[] buffer = new byte[bytesToRead];
                    sp.Read(buffer, 0, bytesToRead);

                    lock (lockObject)
                    {
                        dataBuffer.AddRange(buffer);
                        ProcessBuffer();
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Okuma Hatası: {ex.Message}");
            }
        }

        private static void ProcessBuffer()
        {
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

                AnalizeEPCData(packet);
            }

            if (dataBuffer.Count > 1000)
            {
                Console.WriteLine("\n[UYARI] Buffer çok büyüdü, temizleniyor...\n");
                dataBuffer.Clear();
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

            if (!string.IsNullOrEmpty(epcNumber))
            {
                // Console'a yaz
                Console.WriteLine(epcNumber);

                // Tüm TCP clientlara gönder
                BroadcastToAllClients(epcNumber);
            }
        }
    }
}