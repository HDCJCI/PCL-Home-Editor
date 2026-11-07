using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace PclStudio
{
    public class MainForm : Form
    {
        private const int WM_NCLBUTTONDOWN = 0xA1;
        private const int HTCAPTION = 0x2;

        [DllImport("user32.dll")]
        private static extern bool ReleaseCapture();

        [DllImport("user32.dll")]
        private static extern IntPtr SendMessage(IntPtr hWnd, int msg, int wParam, int lParam);

        private readonly WebView2 web;
        private static readonly string Root = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PclHomeStudio");

        public MainForm()
        {
            Text = "PCL 主页工坊";
            FormBorderStyle = FormBorderStyle.None;
            StartPosition = FormStartPosition.CenterScreen;
            Size = new Size(1460, 920);
            MinimumSize = new Size(1020, 660);
            BackColor = Color.FromArgb(22, 119, 200);
            KeyPreview = false;
            Icon = LoadIcon();

            web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = Color.FromArgb(22, 119, 200) };
            Controls.Add(web);
            Load += async (s, e) => await BootAsync();
        }

        /* 无边框 + 保留系统缩放边框，窗口四边仍然能拖拽改大小 */
        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams cp = base.CreateParams;
                cp.Style |= 0x00040000; // WS_THICKFRAME
                cp.Style |= 0x00010000; // WS_MAXIMIZEBOX
                cp.Style |= 0x00020000; // WS_MINIMIZEBOX
                return cp;
            }
        }

        /* ---------------------------------------------------------- 最大化 */

        private const int WM_SYSCOMMAND = 0x0112;
        private const int SC_MAXIMIZE = 0xF030;
        private const int SM_CXSIZEFRAME = 32;
        private const int SM_CYSIZEFRAME = 33;
        private const int SM_CXPADDEDBORDER = 92;

        [DllImport("user32.dll")]
        private static extern int GetSystemMetrics(int nIndex);

        /// <summary>
        /// 无边框窗口最大化时，系统会把窗口矩形限制在工作区，但客户区仍要扣掉一圈
        /// 不可见的缩放边框，于是四周露出底色的缝。这里把窗口矩形按边框宽度向外扩，
        /// 让客户区正好等于工作区。
        /// </summary>
        private void ApplyMaximizedBounds()
        {
            Rectangle wa = Screen.FromControl(this).WorkingArea;
            int bx = Math.Max(8, GetSystemMetrics(SM_CXSIZEFRAME) + GetSystemMetrics(SM_CXPADDEDBORDER));
            int by = Math.Max(8, GetSystemMetrics(SM_CYSIZEFRAME) + GetSystemMetrics(SM_CXPADDEDBORDER));
            MaximizedBounds = new Rectangle(wa.X - bx, wa.Y - by, wa.Width + bx * 2, wa.Height + by * 2);
        }

        protected override void WndProc(ref Message m)
        {
            // 走系统路径最大化（双击标题栏、Win+↑、拖到屏幕顶部）时也要用同一套边界
            if (m.Msg == WM_SYSCOMMAND && (m.WParam.ToInt32() & 0xFFF0) == SC_MAXIMIZE)
            {
                ApplyMaximizedBounds();
            }
            base.WndProc(ref m);
        }

        /// <summary>初始化完成后才有值。绝对不要在 OnResize 里访问 web.CoreWebView2 —— 
        /// 那个属性在初始化期间会阻塞等锁，UI 线程一卡就死锁。</summary>
        private CoreWebView2 _cw;
        private bool? _pushedMax;

        /// <summary>告诉页面当前是不是最大化，好把 □ 换成 ⧉</summary>
        private void PushWindowState()
        {
            CoreWebView2 cw = _cw;
            if (cw == null) return;
            bool max = WindowState == FormWindowState.Maximized;
            if (_pushedMax == max) return;
            _pushedMax = max;
            try
            {
                cw.PostWebMessageAsJson(max
                    ? "{\"cmd\":\"state\",\"max\":true}"
                    : "{\"cmd\":\"state\",\"max\":false}");
            }
            catch { }
        }

        protected override void OnResize(EventArgs e)
        {
            base.OnResize(e);
            PushWindowState();
        }

        private static Icon LoadIcon()
        {
            try
            {
                Assembly asm = Assembly.GetExecutingAssembly();
                using (Stream s = asm.GetManifestResourceStream("app.ico"))
                {
                    if (s != null) return new Icon(s);
                }
            }
            catch { }
            return null;
        }

        /* 排错用：把启动过程中的关键步骤写到 %LOCALAPPDATA%\PclHomeStudio\boot.log */
        private static void Log(string msg)
        {
            try
            {
                Directory.CreateDirectory(Root);
                File.AppendAllText(Path.Combine(Root, "boot.log"),
                    DateTime.Now.ToString("HH:mm:ss.fff") + "  " + msg + "\r\n");
            }
            catch { }
        }

        private static void Extract(string name, string dir)
        {
            Assembly asm = Assembly.GetExecutingAssembly();
            using (Stream s = asm.GetManifestResourceStream(name))
            {
                if (s == null) return;
                try
                {
                    using (var fs = new FileStream(Path.Combine(dir, name), FileMode.Create, FileAccess.Write))
                        s.CopyTo(fs);
                }
                catch (Exception ex)
                {
                    Log("extract failed " + name + ": " + ex.Message);
                }
            }
        }

        /* 扫本机已安装的 Minecraft 版本，带给页面做「一键填入版本名」 */
        private static List<string> ReadVersions()
        {
            var list = new List<string>();
            var bases = new[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), ".minecraft", "versions"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".minecraft", "versions")
            };
            foreach (var b in bases)
            {
                try
                {
                    if (!Directory.Exists(b)) continue;
                    foreach (var d in Directory.GetDirectories(b))
                    {
                        var name = Path.GetFileName(d);
                        if (!string.IsNullOrWhiteSpace(name)) list.Add(name);
                    }
                }
                catch { }
            }
            return list.Distinct().OrderBy(x => x).Take(60).ToList();
        }

        private async Task BootAsync()
        {
            try
            {
                Log("boot start");
                // 每次启动解压到独立的子目录：即使上一份文件还被某个残留的 WebView2 进程
                // 占着，也不会因为覆盖失败导致页面加载不出来。
                var appRoot = Path.Combine(Root, "app");
                var appDir = Path.Combine(appRoot, DateTime.Now.ToString("yyyyMMddHHmmssfff"));
                Directory.CreateDirectory(appDir);
                foreach (var f in new[] { "index.html", "style.css", "app.js" }) Extract(f, appDir);
                Log("assets extracted to " + appDir);
                // 旧目录放后台删，删不掉就算了——绝不能在启动路径上等文件句柄释放
                var staleDirs = new List<string>();
                try
                {
                    foreach (var d in Directory.GetDirectories(appRoot))
                        if (!string.Equals(d, appDir, StringComparison.OrdinalIgnoreCase)) staleDirs.Add(d);
                }
                catch { }
                if (staleDirs.Count > 0)
                {
                    System.Threading.Tasks.Task.Run(() =>
                    {
                        foreach (var d in staleDirs)
                            try { Directory.Delete(d, true); } catch { }
                    });
                }

                var dataDir = Path.Combine(Root, "wv2");
                var env = await CoreWebView2Environment.CreateAsync(null, dataDir);
                Log("env ok: " + env.BrowserVersionString);
                await web.EnsureCoreWebView2Async(env);
                CoreWebView2 cw = web.CoreWebView2;
                _cw = cw;
                Log("webview ready");
                cw.Settings.AreDefaultContextMenusEnabled = false;
                cw.Settings.IsStatusBarEnabled = false;
                cw.Settings.AreDevToolsEnabled = false;
                cw.Settings.IsZoomControlEnabled = false;
                cw.Settings.AreBrowserAcceleratorKeysEnabled = false;
                cw.WebMessageReceived += OnWebMessage;
                cw.ProcessFailed += (s2, e2) => Log("process failed: " + e2.ProcessFailedKind);
                cw.SetVirtualHostNameToFolderMapping("pcl.studio", appDir, CoreWebView2HostResourceAccessKind.Allow);

                var versions = ReadVersions();
                var url = "https://pcl.studio/index.html";
                if (versions.Count > 0)
                    url += "?v=" + string.Join("|", versions.Select(Uri.EscapeDataString));

                cw.NavigationCompleted += (s2, e2) =>
                {
                    Log("nav done ok=" + e2.IsSuccess + " status=" + e2.WebErrorStatus);
                    _pushedMax = null;   // 页面重新加载了，状态要重发一次
                    PushWindowState();
                };
                cw.Navigate(url);
                Log("navigate " + url);
            }
            catch (Exception ex)
            {
                Log("boot failed: " + ex);
                MessageBox.Show(
                    "无法启动内置浏览器内核（WebView2）。\r\n\r\n" +
                    "请确认系统已安装 Microsoft Edge WebView2 运行时：\r\n" +
                    "https://developer.microsoft.com/microsoft-edge/webview2/\r\n\r\n" +
                    ex.Message,
                    "PCL 主页工坊", MessageBoxButtons.OK, MessageBoxIcon.Error);
                Close();
            }
        }

        /// <summary>
        /// 把页面打包好的「主页 + 帮助子页面」文件集写到用户选的目录里。
        /// </summary>
        private void SavePages(string messageJson)
        {
            List<string[]> files = new List<string[]>();
            try
            {
                using (JsonDocument doc = JsonDocument.Parse(messageJson))
                {
                    foreach (JsonElement item in doc.RootElement.GetProperty("files").EnumerateArray())
                    {
                        files.Add(new[] {
                            item.GetProperty("path").GetString(),
                            item.GetProperty("content").GetString()
                        });
                    }
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine("解析导出文件列表失败：" + ex.Message);
                return;
            }
            if (files.Count == 0) return;

            using (FolderBrowserDialog dlg = new FolderBrowserDialog
            {
                Description = "选择导出目录（会生成 Custom.xaml 和 Help 子文件夹）",
                ShowNewFolderButton = true
            })
            {
                if (dlg.ShowDialog(this) != DialogResult.OK) return;
                try
                {
                    foreach (string[] f in files)
                    {
                        string full = Path.Combine(dlg.SelectedPath, f[0].Replace('/', '\\'));
                        Directory.CreateDirectory(Path.GetDirectoryName(full));
                        File.WriteAllText(full, f[1], new System.Text.UTF8Encoding(true));
                    }
                    MessageBox.Show(
                        $"已导出 {files.Count} 个文件：\n{dlg.SelectedPath}\n\n" +
                        "Custom.xaml 放在所选目录，Help 里的文件请复制到 PCL 目录的 PCL\\Help\\ 文件夹。",
                        "PCL 主页工坊", MessageBoxButtons.OK, MessageBoxIcon.Information);
                }
                catch (Exception ex)
                {
                    MessageBox.Show("导出失败：" + ex.Message, "PCL 主页工坊",
                        MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
        }

        private void OnWebMessage(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            string cmd = null;
            try
            {
                using (JsonDocument doc = JsonDocument.Parse(e.WebMessageAsJson))
                {
                    JsonElement el;
                    if (doc.RootElement.TryGetProperty("cmd", out el)) cmd = el.GetString();
                }
            }
            catch { return; }

            switch (cmd)
            {
                case "drag":
                    ReleaseCapture();
                    SendMessage(Handle, WM_NCLBUTTONDOWN, HTCAPTION, 0);
                    break;
                case "min":
                    WindowState = FormWindowState.Minimized;
                    break;
                case "max":
                    if (WindowState == FormWindowState.Maximized) WindowState = FormWindowState.Normal;
                    else
                    {
                        ApplyMaximizedBounds();
                        WindowState = FormWindowState.Maximized;
                    }
                    PushWindowState();
                    break;
                case "savepages":
                    // 页面发来的整套导出：主页 Custom.xaml + 每个帮助子页面的 json/xaml
                    SavePages(e.WebMessageAsJson);
                    break;
                case "close":
                    Close();
                    break;
            }
        }
    }
}
