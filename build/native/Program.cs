using System;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace PclStudio
{
    internal static class Program
    {
        [DllImport("user32.dll", CharSet = CharSet.Unicode)]
        private static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        [DllImport("user32.dll")]
        private static extern bool SetForegroundWindow(IntPtr hWnd);

        private static Mutex _mutex;

        private static void Log(string msg)
        {
            try
            {
                string dir = System.IO.Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PclHomeStudio");
                System.IO.Directory.CreateDirectory(dir);
                System.IO.File.AppendAllText(System.IO.Path.Combine(dir, "boot.log"),
                    DateTime.Now.ToString("HH:mm:ss.fff") + "  [main] " + msg + "\r\n");
            }
            catch { }
        }

        [STAThread]
        private static void Main()
        {
            Log("main enter");
            // 只允许开一个：第二个实例把已有窗口叫到前面就退出。
            // 不然它会去覆盖正在被 WebView2 占用的 index.html，解压失败就白屏。
            bool created;
            _mutex = new Mutex(true, @"Local\PclHomeStudio.SingleInstance", out created);
            Log("mutex created=" + created);
            if (!created)
            {
                // WebView2 子进程会继承 Mutex 句柄，主进程退出后可能留下“幽灵单例”，
                // 所以再确认一次是不是真的有窗口活着，没有就照常启动。
                IntPtr h = FindWindow(null, "PCL 主页工坊");
                if (h != IntPtr.Zero)
                {
                    Log("another instance alive, activating and exit");
                    ShowWindow(h, 9); // SW_RESTORE
                    SetForegroundWindow(h);
                    return;
                }
                Log("stale mutex only, continue");
            }

            Log("building form");
            Application.SetHighDpiMode(HighDpiMode.PerMonitorV2);
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            var form = new MainForm();
            Log("form created");
            Application.Run(form);
            Log("exited");
            GC.KeepAlive(_mutex);
        }
    }
}
