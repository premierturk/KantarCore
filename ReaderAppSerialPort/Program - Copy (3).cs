using System;
using System.Collections.Generic;
using System.IO.Ports;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace EPCReaderConsole
{
    internal class Program
    {
        // Serial Port Fields
        private static SerialPort serialPort;

        private static string comPortName;
        private static DateTime lastDataReceived = DateTime.Now;

        // TCP Server Fields
        private static TcpListener tcpListener;

        private static readonly List<TcpClient> tcpClients = new List<TcpClient>();
        private static int tcpPort;

        // Application State Fields
        private static bool isRunning = true;

        private static readonly object lockObject = new object();
        private static Timer reconnectTimer;
        private static Timer connectionCheckTimer;
        private static bool isReconnecting = false;

        // MUTEX: 1. Add a static Mutex field
        private static Mutex mutex = null;

        private static void Main(string[] args)
        {
            // Check for command-line arguments
            if (args.Length < 2)
            {
                Console.WriteLine("Usage: EPCReaderConsole.exe <ComPort> <TcpPort>");
                Console.WriteLine("Example: EPCReaderConsole.exe COM3 8080");
                return;
            }

            comPortName = args[0];
            tcpPort = int.Parse(args[1]);

            // Mutex ile tek instance kontrolü
            bool createdNew;
            using (Mutex mutex = new Mutex(true, "ReaderAppSerialPort" + comPortName + tcpPort, out createdNew))
            {
                if (!createdNew)
                {
                    Console.WriteLine("Uygulama zaten çalışıyor! Sadece bir adet çalışabilir.");
                    return;
                }

                if (!int.TryParse(args[1], out tcpPort) || tcpPort <= 0 || tcpPort > 65535)
                {
                    Console.WriteLine("Error: Invalid TCP port number provided.");
                    return;
                }

                Console.Title = $"EPC Reader - {comPortName} | TCP Server - {tcpPort}";
                Console.WriteLine($"EPC Reader - {comPortName} Port with Auto-Reconnect");
                Console.WriteLine($"TCP Server listening on port {tcpPort}");
                Console.WriteLine("Press 'q' to quit\n");

                StartTcpServer();

                ConnectToPort();
                StartConnectionMonitor();

                ConsoleKeyInfo keyInfo;
                do
                {
                    keyInfo = Console.ReadKey(true);
                    if (keyInfo.Key == ConsoleKey.Q)
                    {
                        isRunning = false;
                        break;
                    }
                } while (isRunning);

                CleanupAndExit();
            }
        }

        #region TCP Server Logic

        private static void StartTcpServer()
        {
            try
            {
                tcpListener = new TcpListener(IPAddress.Any, tcpPort);
                tcpListener.Start();
                Task.Run(() => ListenForClients());
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] TCP Server could not start: {ex.Message}");
                isRunning = false;
            }
        }

        private static async void ListenForClients()
        {
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] TCP Server started. Waiting for connections...");
            try
            {
                while (isRunning)
                {
                    TcpClient client = await tcpListener.AcceptTcpClientAsync();
                    lock (lockObject)
                    {
                        tcpClients.Add(client);
                    }
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] TCP client connected: {((IPEndPoint)client.Client.RemoteEndPoint).Address}");
                }
            }
            catch (Exception ex)
            {
                if (isRunning)
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] TCP listener error: {ex.Message}");
            }
        }

        private static void BroadcastToClients(string message)
        {
            if (string.IsNullOrEmpty(message)) return;

            byte[] buffer = Encoding.UTF8.GetBytes(message + Environment.NewLine);
            List<TcpClient> disconnectedClients = new List<TcpClient>();

            lock (lockObject)
            {
                foreach (var client in tcpClients)
                {
                    try
                    {
                        if (client.Connected)
                        {
                            NetworkStream stream = client.GetStream();
                            stream.Write(buffer, 0, buffer.Length);
                        }
                        else
                        {
                            disconnectedClients.Add(client);
                        }
                    }
                    catch (Exception)
                    {
                        disconnectedClients.Add(client);
                    }
                }

                foreach (var client in disconnectedClients)
                {
                    tcpClients.Remove(client);
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] TCP client disconnected.");
                }
            }
        }

        #endregion TCP Server Logic

        #region Serial Port Logic

        private static void ConnectToPort()
        {
            try
            {
                lock (lockObject)
                {
                    if (serialPort != null)
                    {
                        try
                        {
                            if (serialPort.IsOpen)
                                serialPort.Close();
                            serialPort.Dispose();
                        }
                        catch { }
                    }

                    bool portExists = Array.Exists(SerialPort.GetPortNames(), p => p.Equals(comPortName, StringComparison.OrdinalIgnoreCase));

                    if (!portExists)
                    {
                        throw new Exception($"{comPortName} port not found");
                    }

                    serialPort = new SerialPort
                    {
                        PortName = comPortName,
                        BaudRate = 9600,
                        DataBits = 8,
                        Parity = Parity.None,
                        StopBits = StopBits.One,
                        Handshake = Handshake.None,
                        ReadTimeout = 1000,
                        WriteTimeout = 1000
                    };

                    serialPort.DataReceived += SerialPort_DataReceived;
                    serialPort.ErrorReceived += SerialPort_ErrorReceived;

                    serialPort.Open();
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Port {serialPort.PortName} connected");
                    isReconnecting = false;
                    lastDataReceived = DateTime.Now;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Connection failed: {ex.Message}");
                StartReconnectTimer();
            }
        }

        private static void CheckConnectionStatus(object state)
        {
            if (!isRunning) return;

            try
            {
                lock (lockObject)
                {
                    bool shouldReconnect = false;
                    if (serialPort == null || !serialPort.IsOpen)
                    {
                        shouldReconnect = true;
                    }
                    else
                    {
                        bool portExists = Array.Exists(SerialPort.GetPortNames(), p => p.Equals(comPortName, StringComparison.OrdinalIgnoreCase));
                        if (!portExists)
                        {
                            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] {comPortName} port physically disconnected");
                            shouldReconnect = true;
                        }
                        else
                        {
                            try { int bytesToRead = serialPort.BytesToRead; }
                            catch (Exception)
                            {
                                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Port communication lost");
                                shouldReconnect = true;
                            }
                        }
                    }

                    if (shouldReconnect && !isReconnecting)
                    {
                        HandlePortDisconnection();
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Connection check error: {ex.Message}");
                if (!isReconnecting)
                {
                    HandlePortDisconnection();
                }
            }
        }

        private static void ProcessEPCData(byte[] data)
        {
            if (data.Length == 0) return;

            string epcData = null;

            // Format 2: 98 D7 XX pattern (önce kontrol et - daha spesifik)
            for (int i = 0; i <= data.Length - 3; i++)
            {
                if (data[i] == 0x98 && data[i + 1] == 0xD7)
                {
                    // 98 D7 18 → 3 byte'ı birleştir ve decimal yap
                    // 0x98D718 = 10016536
                    uint value = ((uint)data[i] << 16) |
                                ((uint)data[i + 1] << 8) |
                                data[i + 2];
                    epcData = value.ToString();
                    break;
                }
            }

            // Format 1: 40 01 09 XX pattern
            if (epcData == null)
            {
                for (int i = 0; i <= data.Length - 4; i++)
                {
                    if (data[i] == 0x40 && data[i + 1] == 0x01 && data[i + 2] == 0x09)
                    {
                        // İlk 4 byte'ı hex string olarak al: 40010993
                        StringBuilder hexValue = new StringBuilder();
                        for (int j = i; j < i + 4 && j < data.Length; j++)
                        {
                            hexValue.Append($"{data[j]:X2}");
                        }
                        epcData = hexValue.ToString();
                        break;
                    }
                }
            }

            if (epcData != null)
            {
                Console.WriteLine($"[EPC READ][SENT TCP] {epcData}");
                BroadcastToClients(epcData);
            }
        }

        private static void CleanupAndExit()
        {
            Console.WriteLine("Closing application...");
            isRunning = false;

            tcpListener?.Stop();
            lock (lockObject)
            {
                foreach (var client in tcpClients)
                {
                    client.Close();
                }
                tcpClients.Clear();
            }

            reconnectTimer?.Dispose();
            connectionCheckTimer?.Dispose();

            try
            {
                if (serialPort != null)
                {
                    if (serialPort.IsOpen)
                        serialPort.Close();
                    serialPort.Dispose();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Cleanup error: {ex.Message}");
            }

            // MUTEX: 3. Release and close the mutex on exit
            mutex?.ReleaseMutex();
            mutex?.Close();
            mutex = null;

            Console.WriteLine("Application closed.");
        }

        // --- Other helper methods ---
        private static void StartConnectionMonitor()
        {
            connectionCheckTimer = new Timer(CheckConnectionStatus, null, 1000, 1000);
        }

        private static void SerialPort_DataReceived(object sender, SerialDataReceivedEventArgs e)
        {
            try
            {
                if (serialPort.IsOpen)
                {
                    int bytes = serialPort.BytesToRead;
                    if (bytes > 0)
                    {
                        byte[] buffer = new byte[bytes];
                        serialPort.Read(buffer, 0, bytes);
                        lastDataReceived = DateTime.Now;
                        ProcessEPCData(buffer);
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Read error: {ex.Message}");
                HandlePortDisconnection();
            }
        }

        private static void SerialPort_ErrorReceived(object sender, SerialErrorReceivedEventArgs e)
        {
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Port error: {e.EventType}");
            HandlePortDisconnection();
        }

        private static void StartReconnectTimer()
        {
            if (isReconnecting || !isRunning) return;
            isReconnecting = true;
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Starting auto-reconnect...");
            reconnectTimer = new Timer(ReconnectCallback, null, 2000, 2000);
        }

        private static void ReconnectCallback(object state)
        {
            if (!isRunning)
            {
                reconnectTimer?.Dispose();
                return;
            }
            ConnectToPort();
            if (serialPort != null && serialPort.IsOpen)
            {
                reconnectTimer?.Dispose();
                reconnectTimer = null;
            }
        }

        private static void HandlePortDisconnection()
        {
            try
            {
                lock (lockObject)
                {
                    if (serialPort != null && serialPort.IsOpen)
                        serialPort.Close();
                }
                if (!isReconnecting)
                {
                    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Port disconnected");
                    StartReconnectTimer();
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Error handling disconnection: {ex.Message}");
                if (!isReconnecting)
                {
                    StartReconnectTimer();
                }
            }
        }

        #endregion Serial Port Logic
    }
}