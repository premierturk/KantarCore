using System;
using System.IO.Ports;
using System.Text;
using System.Threading;

namespace EPCReaderConsole
{
    class Program
    {
        private static SerialPort serialPort;
        private static bool isRunning = true;
        private static readonly object lockObject = new object();
        private static Timer reconnectTimer;
        private static Timer connectionCheckTimer;
        private static bool isReconnecting = false;
        private static DateTime lastDataReceived = DateTime.Now;
        private static string portName; // MODIFIED: Added variable for port name

        static void Main(string[] args)
        {
            // MODIFIED: Get port name from command-line arguments
            if (args.Length == 0)
            {
                Console.WriteLine("Usage: EPCReaderConsole.exe <PortName>");
                Console.WriteLine("Example: EPCReaderConsole.exe COM3");
                return; // Exit if no port name is provided
            }
            portName = args[0];

            // MODIFIED: Use the portName variable for the console title and messages
            Console.Title = $"EPC Reader - {portName} (Auto-Reconnect)";
            Console.WriteLine($"EPC Reader - {portName} Port with Auto-Reconnect");
            Console.WriteLine("Press 'q' to quit\n");

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

        private static void StartConnectionMonitor()
        {
            // Her 1 saniyede bir bağlantı durumunu kontrol et
            connectionCheckTimer = new Timer(CheckConnectionStatus, null, 1000, 1000);
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
                        string[] availablePorts = SerialPort.GetPortNames();
                        bool portExists = false;
                        foreach (string port in availablePorts)
                        {
                            // MODIFIED: Use the portName variable
                            if (port.Equals(portName, StringComparison.OrdinalIgnoreCase))
                            {
                                portExists = true;
                                break;
                            }
                        }

                        if (!portExists)
                        {
                            // MODIFIED: Use the portName variable in the log message
                            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] {portName} port physically disconnected");
                            shouldReconnect = true;
                        }
                        else
                        {
                            try
                            {
                                if (serialPort.IsOpen)
                                {
                                    int bytesToRead = serialPort.BytesToRead;
                                }
                            }
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

                    string[] availablePorts = SerialPort.GetPortNames();
                    bool portExists = false;
                    foreach (string port in availablePorts)
                    {
                        // MODIFIED: Use the portName variable
                        if (port.Equals(portName, StringComparison.OrdinalIgnoreCase))
                        {
                            portExists = true;
                            break;
                        }
                    }

                    if (!portExists)
                    {
                        // MODIFIED: Use the portName variable in the exception message
                        throw new Exception($"{portName} port not found");
                    }

                    serialPort = new SerialPort();
                    serialPort.PortName = portName; // MODIFIED: Use the portName variable
                    serialPort.BaudRate = 9600;
                    serialPort.DataBits = 8;
                    serialPort.Parity = Parity.None;
                    serialPort.StopBits = StopBits.One;
                    serialPort.Handshake = Handshake.None;
                    serialPort.ReadTimeout = 1000;
                    serialPort.WriteTimeout = 1000;

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

        private static void SerialPort_DataReceived(object sender, SerialDataReceivedEventArgs e)
        {
            try
            {
                SerialPort sp = (SerialPort)sender;

                if (!sp.IsOpen) return;

                int bytesToRead = sp.BytesToRead;
                if (bytesToRead > 0)
                {
                    byte[] buffer = new byte[bytesToRead];
                    int bytesRead = sp.Read(buffer, 0, bytesToRead);

                    if (bytesRead > 0)
                    {
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

        private static void HandlePortDisconnection()
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
                        }
                        catch { }
                    }
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

        private static void ProcessEPCData(byte[] data)
        {
            if (data.Length == 0) return;

            // Format 2: 98 D7 XX pattern arama (3 byte'ı decimal'e çevir)
            for (int i = 0; i <= data.Length - 3; i++)
            {
                if (data[i] == 0x98 && data[i + 1] == 0xD7)
                {
                    uint value = ((uint)data[i] << 16) | ((uint)data[i + 1] << 8) | data[i + 2];
                    Console.WriteLine(value.ToString());
                    return;
                }
            }

            // Format 1: 40 01 09 XX pattern arama (4 byte hex)
            for (int i = 0; i <= data.Length - 4; i++)
            {
                if (data[i] == 0x40 && data[i + 1] == 0x01 && data[i + 2] == 0x09)
                {
                    StringBuilder hexValue = new StringBuilder();
                    for (int j = 0; j < 4; j++)
                    {
                        hexValue.Append($"{data[i + j]:X2}");
                    }
                    Console.WriteLine(hexValue.ToString());
                    return;
                }
            }
        }

        private static void CleanupAndExit()
        {
            isRunning = false;

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

            Console.WriteLine("Application closed.");
        }
    }
}