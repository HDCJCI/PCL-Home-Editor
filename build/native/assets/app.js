/* =========================================================================
 * PCL 主页工坊 · app.js
 * 按 PCL 自定义主页的真实布局模型（纵向单列 / StackPanel 流式）编辑，
 * 导出可直接放进 PCL\Custom.xaml 的 XAML。
 * ========================================================================= */
'use strict';

/* --------------------------------------------------------------- 小工具 */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
let _n = 0;
const uid = () => 'e' + (++_n).toString(36) + Math.random().toString(36).slice(2, 5);
const escH = s => String(s === undefined || s === null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const escAttr = s => String(s === undefined || s === null ? '' : s)
  .replace(/'/g, '%27').replace(/"/g, '%22').replace(/\(/g, '%28').replace(/\)/g, '%29');
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* -------------------------------------------------- 输入框绑定 / 变量标记 */
const RE_BIND = /^\s*\{Binding\b/i;
const isBinding = v => RE_BIND.test(String(v === undefined || v === null ? '' : v));

function bindTargetName(v) {
  const m = String(v).match(/ElementName\s*=\s*([^\s,}]+)/i);
  return m ? m[1] : '输入框';
}
/* PCL 的 XAML 解析器不认 StringFormat，遇到就剥掉（老工程也能自动救回来） */
function stripUnsupported(v) {
  if (typeof v !== 'string') return v;
  return v
    .replace(/,\s*StringFormat\s*=\s*'[^']*'/gi, '')
    .replace(/,\s*StringFormat\s*=\s*"[^"]*"/gi, '');
}
function sanitizeDoc(doc) {
  let n = 0;
  walk(doc.elements, e => {
    if (!e.p) return;
    // 旧工程里的 IsWarn 写法 PCL 已经不认了，迁移到 Theme
    if (e.type === 'hint' && e.p.isWarn && !e.p.theme) { e.p.theme = 'Yellow'; delete e.p.isWarn; n++; }
    if (e.type === 'hint' && e.p.theme && e.p.isWarn !== undefined) delete e.p.isWarn;
    Object.keys(e.p).forEach(k => {
      const v = e.p[k];
      if (typeof v === 'string' && /StringFormat/i.test(v)) {
        e.p[k] = stripUnsupported(v);
        n++;
      }
    });
  });
  return n;
}

/* 预览时把 {variable:名字:默认值} 显示成默认值 */
function resolveVars(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/\{variable:([^:}]+):([^}]*)\}/g, (all, name, def) => def);
}
function fieldHTML(v) {
  const str = String(v === undefined || v === null ? '' : v);
  if (isBinding(str)) return `<span class="bindchip">⟵ ${escH(bindTargetName(str))}</span>`;
  return escH(resolveVars(str));
}
function editSpan(field, v, cls) {
  const c = cls ? ` class="${cls}"` : '';
  if (isBinding(v)) return `<span${c}>${fieldHTML(v)}</span>`;
  return `<span${c} data-edit="${field}">${fieldHTML(v)}</span>`;
}
/* 文档里所有带名字的输入框 */
function collectTextboxes() {
  const out = [];
  walk(state.doc.elements, e => {
    if (e.type === 'textbox' && e.p && e.p.name) out.push(e.p.name);
  });
  return out;
}
function bindRow(field, label) {
  const boxes = collectTextboxes();
  if (!boxes.length) return '';
  return `<div class="bindrow"><span class="bindlab">${label || '绑定输入框'}：</span>${boxes.map(n =>
    `<button class="chipb" data-bind="${escH(n)}" data-bindfield="${field}" title="引用「${escH(n)}」里输入的内容">${escH(n)}</button>`).join('')}</div>`;
}

/* --------------------------------------------------------------- 类型表 */
/* 这些类型可以指定高度；h = 0 时随内容自适应 */
const FIXED_H = new Set(['button', 'textbutton', 'listitem', 'textbox', 'image', 'divider', 'rect', 'icontextbutton', 'iconbutton', 'card', 'panel', 'row']);

const TYPE = {
  card:       { label: '卡片',     icon: 'card',  kid: true },
  panel:      { label: '自绘面板', icon: 'panel', kid: true },
  text:       { label: '文本',     icon: 'text' },
  image:      { label: '图片',     icon: 'image' },
  button:     { label: '按钮',     icon: 'btn' },
  textbutton: { label: '文字按钮', icon: 'tbtn' },
  listitem:   { label: '列表项',   icon: 'list' },
  hint:       { label: '提示条',   icon: 'hint' },
  textbox:    { label: '输入框',   icon: 'input' },
  icontextbutton: { label: '图文按钮', icon: 'btn' },
  iconbutton: { label: '图标按钮', icon: 'btn' },
  row:        { label: '横向行',   icon: 'panel', kid: true },
  divider:    { label: '分隔线',   icon: 'divider' },
  rect:       { label: '色块',     icon: 'rect' }
};

const PALETTE = [
  { group: '内容', items: ['text', 'image', 'listitem'] },
  { group: '交互', items: ['button', 'textbutton', 'icontextbutton', 'iconbutton', 'textbox'] },
  { group: '容器', items: ['card', 'panel', 'row', 'hint', 'divider', 'rect'] }
];

const EVENTS = [
  ['',             '无（纯展示）',                          ''],
  ['打开网页',     '打开一个网址，必须带 ://',               'https://www.example.com'],
  ['打开文件',     '运行程序 / 打开文件夹，| 后面是启动参数',  'notepad.exe'],
  ['打开帮助',     '打开帮助文档的数据源',                   'https://example.com/help.json'],
  ['执行命令',     '执行系统命令（会弹安全确认）',            'cmd.exe|/c echo hi'],
  ['启动游戏',     '版本名（versions 下的文件夹名）',         '\\current'],
  ['复制文本',     '把文字复制到剪贴板',                     '要复制的内容'],
  ['刷新主页',     '重新加载自定义主页',                     ''],
  ['刷新页面',     '刷新当前页面（部分页面不支持）',           ''],
  ['刷新帮助',     '刷新帮助列表',                           ''],
  ['今日人品',     'PCL 的今日人品小彩蛋',                   ''],
  ['内存优化',     '执行内存优化',                           ''],
  ['清理垃圾',     '清理游戏缓存垃圾',                       ''],
  ['弹出窗口',     '消息框：标题|内容|按钮文字',              '标题|正文内容'],
  ['弹出提示',     '右下角小提示：文字|颜色',                '提示文字|Green'],
  ['切换页面',     '跳到启动器某个页面',                     'Setup|SetupUI'],
  ['导入整合包',   '打开整合包导入',                         ''],
  ['安装整合包',   '打开整合包安装',                         ''],
  ['下载文件',     '网址|文件名|保存路径（后两段可省）',       'https://example.com/a.zip'],
  ['修改设置',     '改启动器设置项：设置项名|值',             'UiLauncherTransparent|400'],
  ['写入设置',     '同「修改设置」',                         'UiLauncherTransparent|400'],
  ['修改变量',     '写自定义变量：变量名|值',                'myvar|hello'],
  ['写入变量',     '同「修改变量」',                         'myvar|hello'],
  ['加入房间',     '加入联机房间，可留空',                    ''],
  ['检查更新',     '检查 PCL 更新',                          '']
];
const NO_DATA_EVENTS = ['', '刷新主页', '刷新页面', '刷新帮助', '今日人品', '内存优化',
  '清理垃圾', '导入整合包', '安装整合包', '检查更新'];

/* 切换页面的参数是枚举名，不是数字 —— 这是 PCL 源码里 EnumUtils.FromString(Of PageType) 的要求 */
const PAGE_TYPES = [
  ['Launch', '启动'], ['Download', '下载'], ['Link', '联机'], ['Setup', '设置'], ['Other', '更多'],
  ['InstanceSelect', '版本选择'], ['TaskManager', '任务管理'], ['InstanceSetup', '版本设置'],
  ['ResourceDetail', '资源详情'], ['HelpDetail', '帮助详情']
];
const PAGE_SUBS = {
  Download: [['DownloadInstall', '安装'], ['DownloadMod', 'Mod'], ['DownloadPack', '整合包'],
             ['DownloadDataPack', '数据包'], ['DownloadResourcePack', '资源包'], ['DownloadShader', '光影']],
  Setup: [['SetupLaunch', '启动'], ['SetupLink', '联机'], ['SetupUI', '界面'], ['SetupSystem', '系统']],
  Link: [['LinkMain', '联机主页']],
  Other: [['OtherHelp', '帮助'], ['OtherAbout', '关于'], ['OtherTest', '测试']],
  InstanceSetup: [['InstanceOverall', '概览'], ['InstanceSetup', '设置'], ['InstanceModify', '修改'],
                  ['InstanceMod', 'Mod 管理'], ['InstanceModDisabled', '禁用 Mod'], ['InstanceExport', '导出']]
};

/* --------------------------------------------------------------- 默认值 */
function defaultsFor(type) {
  switch (type) {
    case 'card':       return { h: 0,  gap: 12, p: { title: '卡片标题', canSwap: false, isSwapped: false, useAnim: true, swapRight: false, mouseAnim: true } };
    case 'panel':      return { h: 0,  gap: 12, p: { bg: '#FFFFFF', border: '#E6E8EB', bw: 1, radius: 10, pad: 12 } };
    case 'row':        return { h: 0,  gap: 10, p: { gapx: 10 } };
    case 'text':       return { h: 0,  gap: 8,  p: { text: '文本内容', size: 14, weight: 'normal', color: 'auto', align: 'left', varName: '' } };
    case 'image':      return { h: 120, gap: 10, p: { src: '', radius: 8, fallback: '', loading: '', cache: true } };
    case 'button':     return { h: 40, gap: 8,  p: { text: '按钮', colorType: '', padding: '', eventType: '', eventData: '', tooltip: '' } };
    case 'textbutton': return { h: 34, gap: 8,  p: { text: '文字按钮', eventType: '', eventData: '', tooltip: '' } };
    case 'listitem':   return { h: 56, gap: 6,  p: { logo: '', title: '列表项标题', info: '描述文字', type: 'Clickable', eventType: '打开网页', eventData: 'https://' } };
    case 'icontextbutton': return { h: 36, gap: 8, p: { text: '图文按钮', logo: '', logoScale: 1, colorType: '', eventType: '', eventData: '', tooltip: '' } };
    case 'iconbutton': return { h: 30, gap: 8, p: { logo: '', logoScale: 1, theme: 'Color', eventType: '', eventData: '', tooltip: '' } };
    case 'hint':       return { h: 0,  gap: 10, p: { text: '这是一条提示信息', theme: 'Blue' } };
    case 'textbox':    return { h: 34, gap: 8,  p: { hint: '请输入内容…', name: 'input1', radius: 3, hasBg: true } };
    case 'divider':    return { h: 1,  gap: 10, p: { color: '#E6E8EB' } };
    case 'rect':       return { h: 80, gap: 10, p: { bg: '#1370B5', radius: 10 } };
    default:           return { h: 0,  gap: 8,  p: {} };
  }
}

function createEl(type, ov) {
  const d = defaultsFor(type);
  const el = {
    id: uid(), type, name: TYPE[type].label,
    w: 0, h: d.h, gap: d.gap, align: 'left',
    mt: 0, mx: 0, valign: 'stretch', noHit: false,
    hidden: false, locked: false,
    p: Object.assign({}, d.p)
  };
  if (TYPE[type].kid) el.children = [];
  if (ov) {
    ['w', 'h', 'gap', 'name', 'hidden', 'locked', 'align'].forEach(k => {
      if (ov[k] !== undefined) el[k] = ov[k];
    });
    if (ov.p) Object.assign(el.p, ov.p);
    if (ov.children) el.children = ov.children;
  }
  return el;
}

/* --------------------------------------------------------------- 状态 */
const LS_KEY = 'pcl-home-studio-v2';

const state = {
  doc: null,
  sel: null,
  scale: 1,
  chrome: true,
  preview: false,
  past: [],
  future: [],
  modalTab: 'xaml',
  versions: []
};

function emptyDoc(name = 'Custom') {
  return {
    name,
    view: { w: 640, theme: 'light', bg: '#EFF4FA' },
    elements: []
  };
}

/* --------------------------------------------------------------- 模板 */
function tplClassic() {
  const d = emptyDoc('Custom');
  d.view = { w: 640, theme: 'light', bg: '#EFF4FA' };

  d.elements.push(createEl('text', { gap: 2, p: { text: 'Plain Craft Launcher 2', size: 26, weight: 'bold', color: '#16181D' } }));
  d.elements.push(createEl('text', { gap: 16, p: { text: 'Minecraft 启动器 · 我的自定义主页', size: 12.5, color: '#8A9099' } }));

  const c1 = createEl('card', { p: { title: '启动游戏' } });
  c1.children = [
    createEl('text', { gap: 2, p: { text: 'Minecraft 1.20.1', size: 20, weight: 'bold' } }),
    createEl('text', { gap: 14, p: { text: 'Forge 47.2.0 · Java 17 · 上次游玩 2 天前', size: 12, color: '#8A9099' } }),
    createEl('button', { h: 44, gap: 8, p: { text: '启动游戏', colorType: 'highlight', eventType: '启动游戏' } }),
    createEl('button', { h: 36, gap: 12, p: { text: '打开游戏目录', eventType: '打开文件', eventData: '.' } }),
    createEl('hint', { p: { text: '启动前会自动检查 Java 和内存设置', isWarn: false } })
  ];
  d.elements.push(c1);

  const c2 = createEl('card', { p: { title: '公告' } });
  c2.children = [
    createEl('hint', { p: { text: '已启用自定义主页，修改后重启 PCL 生效', isWarn: false } }),
    createEl('text', { gap: 0, p: { text: '本周更新：\n· 新增 Bangumi 番剧主页预设\n· Modrinth 资源下载体验优化\n· 修复部分情况下启动崩溃的问题', size: 12.5, color: 'auto' } })
  ];
  d.elements.push(c2);

  const c3 = createEl('card', { p: { title: '快捷方式' } });
  c3.children = [
    createEl('listitem', { p: { title: '哔哩哔哩', info: '看 Minecraft 视频和教程', eventType: '打开网页', eventData: 'https://www.bilibili.com' } }),
    createEl('listitem', { p: { title: 'Minecraft Wiki', info: '查合成表和机制', eventType: '打开网页', eventData: 'https://zh.minecraft.wiki' } }),
    createEl('listitem', { gap: 0, p: { title: 'Modrinth', info: '下载模组和整合包', eventType: '打开网页', eventData: 'https://modrinth.com' } })
  ];
  d.elements.push(c3);

  const c4 = createEl('card', { gap: 0, p: { title: '最近游玩' } });
  c4.children = [
    createEl('listitem', { p: { title: '1.20.1 · Forge', info: '上次游玩：2 天前', eventType: '启动游戏', eventData: '' } }),
    createEl('listitem', { gap: 0, p: { title: '1.19.2 · Fabric', info: '上次游玩：3 周前', eventType: '启动游戏', eventData: '' } })
  ];
  d.elements.push(c4);
  return d;
}

function tplDark() {
  const d = emptyDoc('Custom');
  d.view = { w: 640, theme: 'dark', bg: '#202226' };
  d.elements = [
    createEl('text', { gap: 4, w: 300, align: 'center', p: { text: 'MINECRAFT', size: 40, weight: 'bold', color: '#FFFFFF', align: 'center' } }),
    createEl('text', { gap: 18, w: 300, align: 'center', p: { text: '选好版本，点一下就能玩', size: 12.5, color: 'auto', align: 'center' } }),
    createEl('button', { h: 46, w: 260, align: 'center', gap: 10, p: { text: '启动游戏', colorType: 'highlight', eventType: '启动游戏' } }),
    createEl('button', { h: 36, w: 260, align: 'center', gap: 10, p: { text: '版本设置', eventType: '切换页面', eventData: '3|1' } }),
    createEl('button', { h: 36, w: 260, align: 'center', gap: 18, p: { text: '更多功能', eventType: '切换页面', eventData: '4|1' } }),
    createEl('hint', { w: 320, align: 'center', gap: 0, p: { text: '已启用自定义主页 · PCL 主页工坊生成', isWarn: false } })
  ];
  return d;
}

function tplBlank() {
  return emptyDoc('Custom');
}

const TEMPLATES = { classic: tplClassic, dark: tplDark, blank: tplBlank };

/* --------------------------------------------------------------- 预设区块 */
const BLOCK_META = [
  { key: 'launch',   label: '启动区块' },
  { key: 'notice',   label: '公告区块' },
  { key: 'links',    label: '快捷方式' },
  { key: 'versions', label: '版本列表' },
  { key: 'snapshot', label: '快照卡片' }
];
const BLOCK_LABEL = { launch: '启动区块', notice: '公告区块', links: '快捷方式', versions: '版本列表', snapshot: '快照卡片' };

const BLOCK_BUILD = {
  launch() {
    const c = createEl('card', { p: { title: '启动游戏' } });
    c.children = [
      createEl('text', { gap: 2, p: { text: 'Minecraft 1.20.1', size: 20, weight: 'bold' } }),
      createEl('text', { gap: 14, p: { text: '点击下方按钮切换版本 / 账号', size: 12, color: '#8A9099' } }),
      createEl('button', { h: 44, gap: 8, p: { text: '启动游戏', colorType: 'highlight', eventType: '启动游戏' } }),
      createEl('button', { h: 36, gap: 12, p: { text: '打开游戏目录', eventType: '打开文件', eventData: '.' } }),
      createEl('hint', { p: { text: '启动前会自动检查 Java 和内存设置', isWarn: false } })
    ];
    return c;
  },
  notice() {
    const c = createEl('card', { p: { title: '公告' } });
    c.children = [
      createEl('hint', { p: { text: '已启用自定义主页，修改后重启 PCL 生效', isWarn: false } }),
      createEl('text', { gap: 0, p: { text: '这里写公告内容：\n· 第一条\n· 第二条', size: 12.5, color: 'auto' } })
    ];
    return c;
  },
  links() {
    const c = createEl('card', { p: { title: '快捷方式' } });
    c.children = [
      createEl('listitem', { p: { title: '哔哩哔哩', info: '看 Minecraft 视频和教程', eventType: '打开网页', eventData: 'https://www.bilibili.com' } }),
      createEl('listitem', { p: { title: 'Minecraft Wiki', info: '查合成表和机制', eventType: '打开网页', eventData: 'https://zh.minecraft.wiki' } }),
      createEl('listitem', { gap: 0, p: { title: 'Modrinth', info: '下载模组和整合包', eventType: '打开网页', eventData: 'https://modrinth.com' } })
    ];
    return c;
  },
  snapshot() {
    const c = createEl('card', { gap: 12, p: { title: '最新快照版 - 26.4-snapshot-7', canSwap: true } });

    // 大图：换成官网那期的截图地址就行
    const img = createEl('image', { h: 170, gap: 4, p: { src: '', radius: 6 } });

    // 版本号胶囊（图片下方居中）
    const pill = createEl('panel', {
      w: 210, align: 'center', gap: 6,
      p: { bg: '#0E6FD0', border: '#0E6FD0', bw: 0, radius: 17, pad: 6 }
    });
    pill.children = [
      createEl('text', { gap: 0, p: { text: '26.4-snapshot-7', size: 18, color: '#FFFFFF', align: 'center' } })
    ];

    const upd = createEl('text', { gap: 10, p: { text: '最后更新：2026-11-03', size: 11, color: '#1677C8', align: 'right' } });

    // 底部一排按钮
    const row = createEl('row', { gap: 0, p: { gapx: 14 } });
    row.children = [
      createEl('textbutton', { h: 30, gap: 0, p: { text: '▶  启动', eventType: '启动游戏', eventData: '\\current' } }),
      createEl('textbutton', { h: 30, gap: 0, p: { text: '☁  服务端', eventType: '打开网页', eventData: 'https://www.minecraft.net/zh-hans/download/server' } }),
      createEl('textbutton', { h: 30, gap: 0, p: { text: 'W  维基', eventType: '打开网页', eventData: 'https://zh.minecraft.wiki' } }),
      createEl('textbutton', { h: 30, gap: 0, p: { text: '▣  更新日志', eventType: '打开网页', eventData: 'https://www.minecraft.net/zh-hans/news' } })
    ];

    c.children = [img, pill, upd, row];
    return c;
  },

  versions() {
    const c = createEl('card', { gap: 12, p: { title: '我的版本' } });
    c.children = [
      createEl('listitem', { p: { title: '1.20.1 · Forge', info: '上次游玩：2 天前', eventType: '启动游戏', eventData: '' } }),
      createEl('listitem', { p: { title: '1.19.2 · Fabric', info: '上次游玩：3 周前', eventType: '启动游戏', eventData: '' } }),
      createEl('listitem', { gap: 0, p: { title: '新建版本…', info: '去下载页安装一个新版本', eventType: '切换页面', eventData: '3|1' } })
    ];
    return c;
  }
};

/* --------------------------------------------------------------- 结构 */
function walk(list, cb, parent = null) {
  for (const e of list) {
    cb(e, parent);
    if (e.children) walk(e.children, cb, e);
  }
}

function find(id, list = state.doc.elements, parent = null) {
  for (const e of list) {
    if (e.id === id) return { el: e, parent };
    if (e.children) {
      const r = find(id, e.children, e);
      if (r) return r;
    }
  }
  return null;
}

function listOf(id) {
  const rec = find(id);
  if (!rec) return null;
  const arr = rec.parent ? rec.parent.children : state.doc.elements;
  return { arr, i: arr.indexOf(rec.el), el: rec.el, parent: rec.parent };
}

function pathTo(id, list = state.doc.elements, trail = []) {
  for (const e of list) {
    if (e.id === id) return trail;
    if (e.children) {
      const r = pathTo(id, e.children, trail.concat(e));
      if (r) return r;
    }
  }
  return null;
}

function cloneEl(e) {
  const c = JSON.parse(JSON.stringify(e));
  const re = n => { n.id = uid(); if (n.children) n.children.forEach(re); };
  re(c);
  return c;
}

function countEls() {
  let n = 0;
  walk(state.doc.elements, () => n++);
  return n;
}

/* --------------------------------------------------------------- 画布渲染 */
const SVG_ICON = {
  card: '<rect x="2.5" y="3.5" width="15" height="13" rx="2.5"/><path d="M2.5 7.5h15"/>',
  panel: '<rect x="2.5" y="3.5" width="15" height="13" rx="2.5"/>',
  text: '<path d="M4 5h12M10 5v10M7.5 15h5"/>',
  image: '<rect x="2.5" y="4.5" width="15" height="11" rx="2.5"/><circle cx="7" cy="8.5" r="1.3"/><path d="M4 14l4-4 3 3 2.5-2 2.5 3"/>',
  btn: '<rect x="2.5" y="5.5" width="15" height="9" rx="3"/>',
  tbtn: '<path d="M4 8h8M4 12h12"/>',
  list: '<path d="M3 6h14M3 10h14M3 14h9"/>',
  hint: '<circle cx="10" cy="10" r="7.5"/><path d="M10 9v4.5M10 6.6v.2"/>',
  input: '<rect x="2.5" y="5.5" width="15" height="9" rx="2.5"/><path d="M5.5 8.5v3"/>',
  divider: '<path d="M3 10h14"/>',
  rect: '<rect x="3" y="3" width="14" height="14" rx="3"/>'
};

const iconSVG = key => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"
  stroke-linecap="round" stroke-linejoin="round">${SVG_ICON[key] || ''}</svg>`;

function elStyle(e) {
  const st = [];
  if (e.w > 0) {
    st.push(`width:${Math.round(e.w)}px`);
    st.push(`align-self:${e.align === 'center' ? 'center' : e.align === 'right' ? 'flex-end' : 'flex-start'}`);
  }
  if (FIXED_H.has(e.type) && e.h) st.push(`height:${Math.round(e.h)}px`);
  if (e.gap) st.push(`margin-bottom:${e.gap}px`);
  if (e.mt) st.push(`margin-top:${e.mt}px`);
  if (e.mx) { st.push(`margin-left:${e.mx}px`); st.push(`margin-right:${e.mx}px`); }
  if (e.noHit) st.push('pointer-events:none');
  return st.join(';');
}

function svgIcon(d, scale) {
  const path = String(d || '').trim();
  const sz = 16 * (Number(scale) > 0 ? Number(scale) : 1);
  const box = `width:${sz}px;height:${sz}px`;
  if (!path) return `<svg class="ib-svg" style="${box}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/></svg>`;
  if (/^[Mm]/.test(path)) return `<svg class="ib-svg" style="${box}" viewBox="0 0 24 24"><path d="${escAttr(path)}"/></svg>`;
  return `<svg class="ib-svg" style="${box}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/></svg>`;
}

function renderEl(e) {
  if (e.hidden) return '';
  const p = e.p;
  const id = e.id;
  const style = elStyle(e);

  switch (e.type) {
    case 'card': {
      const kids = (e.children || []).map(renderEl).join('');
      return `<div class="el e-card" data-id="${id}" style="${style}">
        ${p.title ? `<div class="card-hd">${editSpan('p.title', p.title, 'ttl')}${p.canSwap ? `<span class="chev">${p.swapRight ? '▸' : '▾'}</span>` : ''}</div>` : ''}
        <div class="stack card-bd" data-stack="${id}">${kids || (state.preview ? '' : '<div class="drop-empty">拖组件到这里</div>')}</div>
      </div>`;
    }
    case 'panel': {
      const kids = (e.children || []).map(renderEl).join('');
      return `<div class="el e-panel" data-id="${id}"
        style="${style};background:${p.bg};border:${p.bw}px solid ${p.border};border-radius:${p.radius}px">
        <div class="stack panel-bd" data-stack="${id}" style="padding:${p.pad === undefined ? 12 : p.pad}px">${kids || (state.preview ? '' : '<div class="drop-empty">拖组件到这里</div>')}</div>
      </div>`;
    }
    case 'row': {
      const kids = (e.children || []).map(renderEl).join('');
      return `<div class="el e-row" data-id="${id}" data-stack="${id}" style="${style};gap:${p.gapx === undefined ? 10 : p.gapx}px">
        ${kids || (state.preview ? '' : '<div class="drop-empty">拖组件到这里</div>')}
      </div>`;
    }
    case 'text':
      return `<div class="el e-text" data-id="${id}"
        style="${style};font-size:${p.size}px;font-weight:${p.weight === 'bold' ? 700 : 450};color:${p.color === 'auto' ? 'var(--txt)' : p.color};text-align:${p.align}">
        ${editSpan('p.text', p.text)}</div>`;
    case 'button': {
      const cls = p.colorType === 'highlight' ? 'highlight' : p.colorType === 'red' ? 'red' : '';
      return `<div class="el e-btn ${cls}" data-id="${id}" style="${style}">${editSpan('p.text', p.text)}</div>`;
    }
    case 'textbutton':
      return `<div class="el e-tbtn" data-id="${id}" style="${style}">${editSpan('p.text', p.text)}</div>`;
    case 'hint': {
      const th = (p.theme || 'Blue').toLowerCase();
      return `<div class="el e-hint ${th}" data-id="${id}" style="${style}">
        <span class="hint-ic">${th === 'blue' ? 'i' : '!'}</span>
        ${editSpan('p.text', p.text, 'hint-tx')}</div>`;
    }
    case 'listitem':
      return `<div class="el e-li" data-id="${id}" style="${style}">
        <div class="li-logo" style="${p.logo ? `background-image:url('${escAttr(p.logo)}')` : ''}">${p.logo ? '' : iconSVG('image')}</div>
        <div class="li-tx">
          ${editSpan('p.title', p.title, 'li-title')}
          ${editSpan('p.info', p.info, 'li-info')}
        </div>
        ${(p.type === undefined ? !!p.eventType : p.type === 'Clickable') ? '<span class="li-go">›</span>' : ''}
      </div>`;
    case 'image':
      return `<div class="el e-img" data-id="${id}"
        style="${style};border-radius:${p.radius}px;${p.src ? `background-image:url('${escAttr(p.src)}')` : ''}">
        ${p.src ? '' : '<span>图片</span>'}</div>`;
    case 'textbox':
      return `<div class="el e-tb ${p.hasBg === false ? 'no-bg' : ''}" data-id="${id}"
        style="${style};border-radius:${p.radius === undefined ? 3 : p.radius}px"><span>${escH(p.hint)}</span><b class="tb-name">${escH(p.name)}</b></div>`;
    case 'icontextbutton': {
      const cls = p.colorType === 'highlight' ? 'highlight' : p.colorType === 'red' ? 'red' : '';
      return `<div class="el e-btn e-ibtn ${cls}" data-id="${id}" style="${style}">
        ${svgIcon(p.logo, p.logoScale)}${editSpan('p.text', p.text)}</div>`;
    }
    case 'iconbutton': {
      const th = (p.theme || 'Color').toLowerCase();
      return `<div class="el e-ibtn e-iconb ${th}" data-id="${id}" style="${style}">${svgIcon(p.logo, p.logoScale)}</div>`;
    }
    case 'divider':
      return `<div class="el e-div" data-id="${id}" style="${style};background:${p.color}"></div>`;
    case 'rect':
      return `<div class="el e-rect" data-id="${id}" style="${style};background:${p.bg};border-radius:${p.radius}px"></div>`;
    default:
      return '';
  }
}

function chromeHTML() {
  return `
    <div class="pcl-titlebar">
      <span class="pcl-logo">PCL</span>
      <div class="pcl-tabs">
        <span class="pcl-tab on"><i>▶</i>启动</span>
        <span class="pcl-tab"><i>↓</i>下载</span>
        <span class="pcl-tab"><i>⚙</i>设置</span>
        <span class="pcl-tab"><i>▦</i>更多</span>
      </div>
      <div class="pcl-win"><i>─</i><i>□</i><i>✕</i></div>
    </div>`;
}

function renderCanvas() {
  const v = state.doc.view;
  const chrome = state.chrome;
  const pad = chrome ? 16 : 0;
  const totalW = pad * 2 + v.w;
  const s = state.scale;

  const inner = $('#stageInner');
  inner.style.width = totalW * s + 'px';

  inner.innerHTML = `
    <div class="pcl-window ${v.theme === 'dark' ? 'dark' : ''}"
         style="width:${totalW}px;transform:scale(${s})">
      ${chrome ? chromeHTML() : ''}
      <div class="pcl-content" style="${chrome ? `padding:${pad}px` : 'padding:0'}">
        <div class="page stack ${state.preview ? 'preview' : ''}" id="page" data-stack=""
             data-theme="${v.theme}" style="width:${v.w}px;background:${v.bg}">
          ${state.doc.elements.map(renderEl).join('')}
          ${state.doc.elements.length === 0 && !state.preview
            ? '<div class="page-empty">把左边的组件或「预设区块」拖进来<br><span>PCL 主页是纵向单列布局，卡片会自动撑满宽度</span></div>' : ''}
          <div class="indicator" id="indicator" hidden></div>
          <div class="sel-box" id="selBox" hidden></div>
        </div>
      </div>
    </div>`;
  updateSelection();
}

function updateSelection() {
  const box = $('#selBox');
  if (!box) return;
  if (!state.sel || state.preview) { box.hidden = true; return; }
  const node = document.querySelector(`.page [data-id="${state.sel}"]`);
  const page = $('#page');
  if (!node || !page) { box.hidden = true; return; }
  const r = node.getBoundingClientRect();
  const pr = page.getBoundingClientRect();
  const s = state.scale;
  box.hidden = false;
  box.style.left = (r.left - pr.left) / s - 2 + 'px';
  box.style.top = (r.top - pr.top) / s - 2 + 'px';
  box.style.width = r.width / s + 4 + 'px';
  box.style.height = r.height / s + 4 + 'px';
  const rec = find(state.sel);
  box.classList.toggle('locked', !!(rec && rec.el.locked));
}

/* --------------------------------------------------------------- 组件库 */
function renderPalette() {
  const q = ($('#palSearch').value || '').trim().toLowerCase();
  const blocks = BLOCK_META.filter(b => !q || b.label.toLowerCase().includes(q));
  const blockHtml = blocks.length ? `<div class="pal-group">
      <div class="pal-group-title">预设区块</div>
      <div class="pal-grid">
        ${blocks.map(b => `<div class="pal-item block" data-block="${b.key}" title="整块插入，插进来就能用">
            <span class="ic">${iconSVG('card')}</span><span class="nm">${b.label}</span>
          </div>`).join('')}
      </div>
    </div>` : '';
  const html = blockHtml + PALETTE.map(g => {
    const items = g.items.filter(t => !q || TYPE[t].label.toLowerCase().includes(q));
    if (!items.length) return '';
    return `<div class="pal-group">
      <div class="pal-group-title">${g.group}</div>
      <div class="pal-grid">
        ${items.map(t => `<div class="pal-item" data-type="${t}" title="拖到画布，或单击添加">
            <span class="ic">${iconSVG(TYPE[t].icon)}</span><span class="nm">${TYPE[t].label}</span>
          </div>`).join('')}
      </div>
    </div>`;
  }).join('');
  $('#palette').innerHTML = html || '<div class="empty">没有匹配的组件</div>';
}

/* --------------------------------------------------------------- 图层 */
function renderLayers() {
  const out = [];
  const rec = (list, depth) => {
    for (const e of list) {
      out.push(`<div class="layer ${e.id === state.sel ? 'sel' : ''}" data-id="${e.id}" style="padding-left:${8 + depth * 12}px">
        <span class="lay-ic">${iconSVG(TYPE[e.type].icon)}</span>
        <span class="lay-name">${escH(e.name)}</span>
        <button class="lay-act ${e.hidden ? 'warn' : ''}" data-act="vis" data-id="${e.id}" title="显示 / 隐藏">${e.hidden ? '○' : '●'}</button>
        <button class="lay-act ${e.locked ? 'warn' : ''}" data-act="lock" data-id="${e.id}" title="锁定">${e.locked ? '▣' : '▢'}</button>
      </div>`);
      if (e.children) rec(e.children, depth + 1);
    }
  };
  rec(state.doc.elements, 0);
  $('#layers').innerHTML = out.join('') || '<div class="empty">还没有元素<br>从上面拖一个进来</div>';
  $('#layerCount').textContent = countEls();
}

/* --------------------------------------------------------------- 属性面板 */
const fld = (label, inner, cls = '') => `<div class="field ${cls}"><label>${label}</label>${inner}</div>`;
const txtInp = (field, val, ph = '') => `<input class="inp" data-field="${field}" value="${escH(val)}" placeholder="${escH(ph)}" spellcheck="false">`;
const areaInp = (field, val, rows = 3) => `<textarea class="inp area" data-field="${field}" rows="${rows}" spellcheck="false">${escH(val)}</textarea>`;
const numInp = (field, val, min = -9999, max = 9999, step = 1) =>
  `<input class="inp" type="number" data-field="${field}" value="${Math.round(val * 10) / 10}" min="${min}" max="${max}" step="${step}">`;
const chk = (field, val) => `<label class="switch"><input type="checkbox" data-field="${field}" ${val ? 'checked' : ''}><span></span></label>`;
const colorInp = (field, val) => `<div class="colf">
  <input type="color" data-color-for="${field}" value="${/^#[0-9a-f]{6}$/i.test(val) ? val : '#000000'}">
  <input class="inp" data-field="${field}" value="${escH(val)}" spellcheck="false">
</div>`;
const selInp = (field, val, opts) => `<select class="inp" data-field="${field}">
  ${opts.map(o => `<option value="${escH(o[0])}" ${o[0] === val ? 'selected' : ''}>${escH(o[1])}</option>`).join('')}
</select>`;
const segInp = (field, val, opts) => `<div class="seg">
  ${opts.map(o => `<button class="seg-b ${o[0] === val ? 'on' : ''}" data-set="${field}" data-val="${o[0]}">${escH(o[1])}</button>`).join('')}
</div>`;

function pageInspector() {
  const v = state.doc.view;
  return `
  <div class="sec">
    <div class="sec-head">预览</div>
    <div class="row">
      ${fld('内容区宽度', numInp('view:w', v.w, 320, 1200))}
      ${fld('背景色', colorInp('view:bg', v.bg))}
    </div>
    <div class="row one">${fld('主题', segInp('view:theme', v.theme, [['light', '浅色'], ['dark', '深色']]))}</div>
    <div class="tip">
      宽度只影响<b>预览</b>。导出的主页是<b>自适应撑满</b>的，PCL 窗口多大就多宽，不会再挤在一起。
    </div>
  </div>

  <div class="sec">
    <div class="sec-head">模板</div>
    <div class="quick">
      <button class="qb" data-tpl="classic">经典主页</button>
      <button class="qb" data-tpl="dark">深色极简</button>
      <button class="qb" data-tpl="blank">清空</button>
    </div>
    <div class="tip" style="margin-top:10px">
      导出后存成 <b>Custom.xaml</b>，放到 PCL 目录的 <b>PCL 文件夹</b>里，再在
      <b>设置 → 主页</b> 选「自定义主页」。
    </div>
  </div>

  <div class="sec">
    <div class="sec-head">操作提示</div>
    <div class="tip">
      · 拖动组件可以<b>调整上下顺序</b>，拖进卡片就变成卡片的内容<br>
      · 双击文字直接在画布上改<br>
      · <b>Ctrl+↑ / ↓</b> 也可以上下移动
    </div>
  </div>`;
}

function secHead(e) {
  return `<div class="sec">
    <div class="sec-head">元素 <span class="chip">${iconSVG(TYPE[e.type].icon)}${TYPE[e.type].label}</span></div>
    <div class="row one">${fld('名称', txtInp('name', e.name))}</div>
  </div>`;
}

function secBox(e) {
  const fixed = FIXED_H.has(e.type);
  return `<div class="sec">
    <div class="sec-head">尺寸与间距</div>
    <div class="row one">${fld('宽度', segInp('wmode', e.w > 0 ? 'fixed' : 'auto', [['auto', '撑满'], ['fixed', '自定义']]))}</div>
    ${e.w > 0 ? `<div class="row">
        ${fld('宽度 (px)', numInp('w', e.w, 40, 2000))}
        ${fld('水平对齐', segInp('align', e.align, [['left', '左'], ['center', '中'], ['right', '右']]))}
      </div>` : ''}
    ${fixed ? `<div class="row">
        ${fld('高度 (px)', numInp('h', e.h, 1, 800))}
        ${fld('与下一项间距', numInp('gap', e.gap, 0, 120))}
      </div>` : `<div class="row one">${fld('与下一项间距', numInp('gap', e.gap, 0, 120))}</div>`}
    ${fixed
      ? (TYPE[e.type].kid ? '<div class="tip">高度填 0 = 由内容自适应；并排的卡片填同一个高度就能对齐。</div>' : '')
      : '<div class="tip">高度由内容决定（和 PCL 一样），不能手填。</div>'}
    <div class="row one" style="margin-top:8px">${fld('隐藏', chk('hidden', e.hidden))}</div>
  </div>`;
}

function secCommon(e) {
  const p = e.p;
  return `<div class="sec">
    <div class="sec-head">通用属性</div>
    <div class="row one">${fld('悬停提示（ToolTip）', txtInp('p.tooltip', p.tooltip, '鼠标指向时显示'))}</div>
    <div class="row">${fld('上边距', numInp('mt', e.mt, 0, 300))}${fld('左右边距', numInp('mx', e.mx, 0, 300))}</div>
    <div class="row one">${fld('垂直对齐', segInp('valign', e.valign || 'stretch', [['stretch', '拉伸'], ['top', '上'], ['center', '中'], ['bottom', '下']]))}</div>
    <div class="row one">${fld('不响应鼠标（IsHitTestVisible=False）', chk('noHit', e.noHit))}</div>
    <div class="tip">导出的外边距是 <b>Margin="左右,上,左右,下"</b>。「不响应鼠标」适合纯装饰的图片 / 色块。垂直对齐只有在固定高度时才看得出效果。</div>
  </div>`;
}

function secContent(e) {
  const p = e.p;
  switch (e.type) {
    case 'card':
      return `<div class="sec">
        <div class="sec-head">卡片</div>
        <div class="row one">${fld('标题', txtInp('p.title', p.title, '留空则不显示'))}</div>
        <div class="row one">${fld('可折叠（CanSwap）', chk('p.canSwap', p.canSwap))}</div>
        ${p.canSwap ? `<div class="row">${fld('默认折叠（IsSwapped）', chk('p.isSwapped', p.isSwapped))}${fld('箭头朝右（SwapLogoRight）', chk('p.swapRight', p.swapRight))}</div>` : ''}
        <div class="row">${fld('展开动画（UseAnimation）', chk('p.useAnim', p.useAnim !== false))}${fld('悬停变色（HasMouseAnimation）', chk('p.mouseAnim', p.mouseAnim !== false))}</div>
        <div class="tip">卡片底色由 PCL 主题控制；想自己配色用「自绘面板」。<br>默认折叠、箭头方向只在开启「可折叠」后才生效 —— 这是 PCL 的限制。</div>
      </div>`;
    case 'panel':
      return `<div class="sec">
        <div class="sec-head">面板样式</div>
        <div class="row one">${fld('背景色', colorInp('p.bg', p.bg))}</div>
        <div class="row">${fld('边框色', colorInp('p.border', p.border))}${fld('边框粗细', numInp('p.bw', p.bw, 0, 12))}</div>
        <div class="row">${fld('圆角', numInp('p.radius', p.radius, 0, 60))}${fld('内边距', numInp('p.pad', p.pad === undefined ? 12 : p.pad, 0, 40))}</div>
        <div class="tip">面板只是「自己配颜色的容器」，位置同样由上下顺序决定 —— PCL 主页没有 x/y 坐标。<br>拖动它时：落在别的卡片<b>中间</b>才算放进去，落在<b>上下边缘</b>是插到它前面 / 后面。</div>
      </div>`;
    case 'row':
      return `<div class="sec">
        <div class="sec-head">横向行</div>
        <div class="row one">${fld('列间距', numInp('p.gapx', p.gapx === undefined ? 10 : p.gapx, 0, 80))}</div>
        <div class="tip">导出为 <b>&lt;StackPanel Orientation="Horizontal"&gt;</b>，适合放一排按钮 / 图标，也能把宽度小的卡片、面板并排。<br>子元素自己的「下间距」在这里不起作用，横向间距由这里的「列间距」统一控制；并排的卡片记得设固定宽度（拖进来会自动给 220）。</div>
      </div>`;
    case 'text':
      return `<div class="sec">
        <div class="sec-head">文本</div>
        <div class="row one">${fld('内容（可换行）', areaInp('p.text', p.text, 4))}</div>
        ${bindRow('p.text', '显示输入框内容')}
        <div class="chips" style="margin:0 0 6px">
          ${[['{user}', '玩家名'], ['{version}', '版本号'], ['{name}', '版本名'], ['{login}', '登录方式'],
             ['{date}', '日期'], ['{time}', '时间'], ['{pcl_version}', 'PCL 版本'], ['{hint}', '随机提示']]
            .map(([v, t]) => `<button class="chipb" data-ins="p.text" data-val="${v}" title="插入 ${v}">${t}</button>`).join('')}
        </div>
        <div class="tip">上面这些是 PCL 的替换标记，运行时会被换成实际内容（例如 {user} → 你的游戏名）。<br>这些标记点一下是<b>追加</b>到文字末尾。</div>
        <div class="row one">${fld('变量名（可选）', txtInp('p.varName', p.varName || '', '例如 Msg'))}</div>
        <div class="row">${fld('字号', numInp('p.size', p.size, 6, 120))}
          ${fld('字重', segInp('p.weight', p.weight, [['normal', '常规'], ['bold', '加粗']]))}</div>
        <div class="row one">${fld('对齐', segInp('p.align', p.align, [['left', '左'], ['center', '中'], ['right', '右']]))}</div>
        <div class="row one">${fld('颜色', p.color === 'auto'
            ? '<input class="inp" value="跟随 PCL 主题" disabled>'
            : colorInp('p.color', p.color))}</div>
        <div class="row one">${fld('自动跟随主题', chk('p.colorAuto', p.color === 'auto'))}</div>
      </div>`;
    case 'button':
      return `<div class="sec">
        <div class="sec-head">按钮</div>
        <div class="row one">${fld('文字', txtInp('p.text', p.text))}</div>
        <div class="row one">${fld('配色', segInp('p.colorType', p.colorType, [['', '默认黑'], ['highlight', '主题色'], ['red', '红色']]))}</div>
        <div class="row one">${fld('内边距（Padding）', txtInp('p.padding', p.padding, '留空 = PCL 默认'))}</div>
      </div>`;
    case 'textbutton':
      return `<div class="sec">
        <div class="sec-head">文字按钮</div>
        <div class="row one">${fld('文字', txtInp('p.text', p.text))}</div>
      </div>`;
    case 'listitem':
      return `<div class="sec">
        <div class="sec-head">列表项</div>
        <div class="row one">${fld('标题', txtInp('p.title', p.title))}</div>
        <div class="row one">${fld('描述', txtInp('p.info', p.info))}</div>
        <div class="row one">${fld('图标地址', txtInp('p.logo', p.logo, 'https://…/favicon.ico'))}</div>
        <div class="row one">${fld('类型（Type）', segInp('p.type', p.type === undefined ? (p.eventType ? 'Clickable' : '') : p.type, [['', '仅展示'], ['Clickable', '可点击']]))}</div>
        <div class="tip">Type 留空时只是静态信息；设为 Clickable 才会有悬停 / 点击反馈和右侧箭头。</div>
      </div>`;
    case 'hint':
      return `<div class="sec">
        <div class="sec-head">提示条</div>
        <div class="row one">${fld('文字', areaInp('p.text', p.text, 3))}</div>
        <div class="row one">${fld('颜色主题（Theme）', segInp('p.theme', p.theme || (p.isWarn ? 'Yellow' : 'Blue'), [['Blue', '蓝'], ['Yellow', '黄'], ['Red', '红']]))}</div>
        <div class="tip">导出为 <b>Theme="Blue|Yellow|Red"</b>。旧的 <b>IsWarn</b> 写法 PCL 已不再识别（所以以前黄色不生效），打开旧工程会自动迁移。</div>
      </div>`;
    case 'image':
      return `<div class="sec">
        <div class="sec-head">图片</div>
        <div class="row one">${fld('图片地址（Source）', txtInp('p.src', p.src, 'https://…'))}</div>
        <div class="row one">${fld('备用地址（FallbackSource）', txtInp('p.fallback', p.fallback, '首次下载失败时用'))}</div>
        <div class="row one">${fld('加载中图片（LoadingSource）', txtInp('p.loading', p.loading, '本地图片，不能联网'))}</div>
        <div class="row one">${fld('缓存网络图片（EnableCache）', chk('p.cache', p.cache !== false))}</div>
        <div class="row one">${fld('圆角', numInp('p.radius', p.radius, 0, 60))}</div>
        <div class="tip">本地图片写相对路径，文件要放在 PCL 目录里。缓存开启时同一张图 7 天内不会重复下载。</div>
      </div>`;
    case 'icontextbutton':
      return `<div class="sec">
        <div class="sec-head">图文按钮</div>
        <div class="row one">${fld('文字', txtInp('p.text', p.text))}</div>
        <div class="row one">${fld('图标（Logo，SVG path）', areaInp('p.logo', p.logo, 2))}</div>
        <div class="row">${fld('图标缩放', numInp('p.logoScale', p.logoScale, 0.2, 3))}
          ${fld('配色', segInp('p.colorType', p.colorType, [['', '默认黑'], ['highlight', '主题色'], ['red', '红色']]))}</div>
        <div class="tip">Logo 填 SVG 的 <b>path d</b> 数据（从 IconFont / Material Symbols 复制）。缩放是 <b>LogoScale</b>，默认 1。</div>
      </div>`;
    case 'iconbutton':
      return `<div class="sec">
        <div class="sec-head">图标按钮</div>
        <div class="row one">${fld('图标（Logo，SVG path）', areaInp('p.logo', p.logo, 2))}</div>
        <div class="row">${fld('图标缩放', numInp('p.logoScale', p.logoScale, 0.2, 3))}
          ${fld('主题（Theme）', segInp('p.theme', p.theme || 'Color', [['Color', '主题色'], ['White', '白'], ['Black', '黑'], ['Red', '红']]))}</div>
        <div class="tip">只有图标没有文字，记得在「尺寸与间距」里给个宽度和高度（例如 28 × 28）。</div>
      </div>`;
    case 'textbox':
      return `<div class="sec">
        <div class="sec-head">输入框</div>
        <div class="row one">${fld('占位文字', txtInp('p.hint', p.hint))}</div>
        <div class="row one">${fld('名称（Name）', txtInp('p.name', p.name))}</div>
        <div class="row">${fld('圆角', numInp('p.radius', p.radius === undefined ? 3 : p.radius, 0, 40))}
          ${fld('高度', numInp('h', e.h, 20, 200))}</div>
        <div class="row one">${fld('显示背景（HasBackground）', chk('p.hasBg', p.hasBg !== false))}</div>
        <div class="tip">PCL 的输入框有 <b>CornerRadius</b>（默认 3）和 <b>HasBackground</b> 两个属性。关掉背景就是透明底、只剩描边，适合压在彩色面板上。</div>
      </div>`;
    case 'divider':
      return `<div class="sec">
        <div class="sec-head">分隔线</div>
        <div class="row one">${fld('颜色', colorInp('p.color', p.color))}</div>
      </div>`;
    case 'rect':
      return `<div class="sec">
        <div class="sec-head">色块</div>
        <div class="row one">${fld('填充色', colorInp('p.bg', p.bg))}</div>
        <div class="row one">${fld('圆角', numInp('p.radius', p.radius, 0, 200))}</div>
      </div>`;
  }
  return '';
}

function secEvent(e) {
  if (!['button', 'textbutton', 'listitem', 'icontextbutton', 'iconbutton'].includes(e.type)) return '';
  const p = e.p;
  const cur = EVENTS.find(x => x[0] === p.eventType) || EVENTS[0];
  const noData = NO_DATA_EVENTS.includes(p.eventType);
  return `<div class="sec">
    <div class="sec-head">点击事件</div>
    <div class="row one">${fld('EventType', selInp('p.eventType', p.eventType, EVENTS.map(x => [x[0], x[0] || x[1]])))}</div>
    ${noData ? '' : `<div class="row one">${fld('EventData', txtInp('p.eventData', p.eventData, cur[2]))}</div>
    ${bindRow('p.eventData', '用输入框内容')}`}
    ${p.eventType === '切换页面' ? (() => {
      const raw = String(p.eventData || '');
      const curPage = raw.split('|')[0] || '';
      const curSub = raw.split('|')[1] || '';
      const subs = PAGE_SUBS[curPage] || [];
      return `<div class="sec-note">页面名必须是 PCL 的枚举名，<b>写数字无效</b>。先选主页面，再选子页面。</div>
        <div class="chips">
          ${PAGE_TYPES.map(([v, t]) => `<button class="chipb${curPage === v ? ' on' : ''}" data-fill="${v}" data-keep="0">${t}</button>`).join('')}
        </div>
        ${subs.length ? `<div class="chips" style="margin-top:6px">
          ${subs.map(([v, t]) => `<button class="chipb${curSub === v ? ' on' : ''}" data-fill="${curPage}|${v}">${t}</button>`).join('')}
        </div>` : ''}`;
    })() : ''}
    ${p.eventType === '启动游戏'
      ? `<div class="sec-note">第一段填<b>版本名称</b>（versions 里的文件夹名），不是原版版本号${state.versions.length ? `。本机检测到 ${state.versions.length} 个：` : '：'}</div>
         <div class="chips">
           <button class="chipb" data-fill="\\current" title="不写死版本，跟着 PCL 当前选中的那个走">当前选中版本</button>
           ${state.versions.slice(0, 12).map(v =>
            `<button class="chipb" data-fill="${escH(v)}" title="${escH(v)}">${escH(v)}</button>`).join('')}
         </div>`
      : ''}
    <div class="tip">${p.eventType
      ? `<b>${escH(p.eventType)}</b>：${escH(cur[1])}${noData ? '，不需要参数。' : `<br>参数：<b>${escH(cur[2])}</b>`}`
      : '没有事件就是纯装饰，点了没反应。'}</div>
    ${p.eventType === '弹出窗口' && isBinding(p.eventData)
      ? '<div class="tip warn">弹窗的 EventData 是「标题|内容」，现在整串交给输入框。<br>想要标题就在输入框里自己打 <b>标题|内容</b> —— PCL 的解析器不支持 StringFormat 拼接，别写那个。</div>'
      : ''}
    ${p.eventType === '启动游戏' && !p.eventData
      ? '<div class="tip warn">没填版本名的话，点下去 PCL 会报「尚未安装该版本」。版本名 = PCL 版本列表里显示的那个（例如 <b>1.20.1</b>），连服务器写 <b>1.20.1|mc.hypixel.net</b>。</div>'
      : ''}
  </div>`;
}

function secActions() {
  return `<div class="sec">
    <div class="sec-head">操作</div>
    <div class="quick four">
      <button class="qb" data-move="up">↑ 上移</button>
      <button class="qb" data-move="down">↓ 下移</button>
      <button class="qb" data-act="dup">复制</button>
      <button class="qb danger" data-act="del">删除</button>
    </div>
  </div>`;
}

function renderInspector() {
  const host = $('#inspector');
  if (!state.sel) {
    $('#inspectorTitle').textContent = '页面设置';
    host.innerHTML = pageInspector();
    return;
  }
  const rec = find(state.sel);
  if (!rec) { state.sel = null; renderInspector(); return; }
  const e = rec.el;
  $('#inspectorTitle').textContent = TYPE[e.type].label;
  host.innerHTML = [
    secHead(e), secBox(e), secContent(e), secCommon(e), secEvent(e), secActions()
  ].join('');
}

/* --------------------------------------------------------------- 全量刷新 */
function renderAll() {
  renderCanvas();
  renderLayers();
  renderInspector();
  updateUndoBtns();
  updateStatus();
}

function updateStatus() {
  const rec = state.sel ? find(state.sel) : null;
  if (state.preview) {
    $('#sbInfo').textContent = '预览模式 · 按 Esc 退出';
    document.body.classList.add('preview-on');
  } else {
    document.body.classList.remove('preview-on');
    $('#sbInfo').textContent = rec
      ? `${TYPE[rec.el.type].label} · ${rec.el.w > 0 ? rec.el.w + 'px 宽' : '撑满宽度'}`
      : `共 ${countEls()} 个元素 · 预览宽 ${state.doc.view.w}px · 导出后自适应`;
  }
  $('#zoomLabel').textContent = Math.round(state.scale * 100) + '%';
}

function updateUndoBtns() {
  $('#btnUndo').disabled = !state.past.length;
  $('#btnRedo').disabled = !state.future.length;
}

/* --------------------------------------------------------------- 历史 */
function pushHist(before) {
  state.past.push(before);
  if (state.past.length > 80) state.past.shift();
  state.future.length = 0;
  updateUndoBtns();
}

function mutate(fn) {
  const before = JSON.stringify(state.doc);
  fn();
  renderAll();
  pushHist(before);
  saveSoon();
}

let histBefore = null, histTimer = null;
function softChange(fn) {
  if (histBefore === null) histBefore = JSON.stringify(state.doc);
  fn();
  renderCanvas();
  renderLayers();
  updateStatus();
  saveSoon();
  clearTimeout(histTimer);
  histTimer = setTimeout(() => {
    if (histBefore !== null) { pushHist(histBefore); histBefore = null; }
  }, 450);
}

function flushHist() {
  clearTimeout(histTimer);
  if (histBefore !== null) { pushHist(histBefore); histBefore = null; }
}

function undo() {
  flushHist();
  if (!state.past.length) return;
  state.future.push(JSON.stringify(state.doc));
  state.doc = JSON.parse(state.past.pop());
  if (state.sel && !find(state.sel)) state.sel = null;
  renderAll(); saveSoon();
}

function redo() {
  flushHist();
  if (!state.future.length) return;
  state.past.push(JSON.stringify(state.doc));
  state.doc = JSON.parse(state.future.pop());
  if (state.sel && !find(state.sel)) state.sel = null;
  renderAll(); saveSoon();
}

function select(id) {
  state.sel = id;
  renderLayers();
  renderInspector();
  updateSelection();
  updateStatus();
}

/* --------------------------------------------------------------- 拖放 */
let drag = null;

function stacks() {
  // 根 stack 就是 .page 自己，'.page .stack' 只取子孙会漏掉它；
  // 漏掉之后「拖到卡片外面」找不到落点，元素就动不了
  const root = $('#page');
  const inner = $$('.page .stack, .page .e-row');
  return root ? [root].concat(inner) : inner;
}

function stackRectOf(node) {
  return node.getBoundingClientRect();
}

/* 找到鼠标下最内层的 stack（根 stack 永远命中，卡片体更小优先） */
function stackUnder(x, y, dragEl) {
  let best = null, bestArea = Infinity;
  for (const s of stacks()) {
    if (dragEl && s !== dragEl && dragEl.contains(s)) continue;
    const r = s.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top - 4 || y > r.bottom + 4) continue;
    const area = r.width * r.height;
    if (area < bestArea) { bestArea = area; best = s; }
  }
  return best;
}

function kidsOf(stack, dragId) {
  return Array.from(stack.children).filter(n => n.classList.contains('el') && n.dataset.id !== dragId);
}

function isRowStack(stack) {
  return !!stack && stack.classList.contains('e-row');
}

function slotIndex(stack, x, y, dragId) {
  const kids = kidsOf(stack, dragId);
  const horiz = isRowStack(stack);
  let idx = kids.length;
  for (let i = 0; i < kids.length; i++) {
    const r = kids[i].getBoundingClientRect();
    const mid = horiz ? r.left + r.width / 2 : r.top + r.height / 2;
    const pos = horiz ? x : y;
    if (pos < mid) { idx = i; break; }
  }
  return { idx, kids };
}

function showIndicator(stack, idx, dragId, x) {
  const ind = $('#indicator');
  const page = $('#page');
  if (!ind || !page) return;
  const pr = page.getBoundingClientRect();
  const s = state.scale;
  const sr = stack.getBoundingClientRect();
  const kids = kidsOf(stack, dragId);

  // 横向容器画竖线
  if (isRowStack(stack)) {
    let xx;
    if (!kids.length) xx = sr.left + 2;
    else if (idx === 0) xx = kids[0].getBoundingClientRect().left - 1;
    else if (idx >= kids.length) xx = kids[kids.length - 1].getBoundingClientRect().right;
    else xx = kids[idx].getBoundingClientRect().left - 1;
    ind.hidden = false;
    ind.style.left = (xx - pr.left) / s - 1.5 + 'px';
    ind.style.top = (sr.top - pr.top) / s + 'px';
    ind.style.width = '3px';
    ind.style.height = sr.height / s + 'px';
    return;
  }

  let y;
  if (!kids.length) y = sr.top + 2;
  else if (idx === 0) y = kids[0].getBoundingClientRect().top - 1;
  else if (idx >= kids.length) y = kids[kids.length - 1].getBoundingClientRect().bottom;
  else y = kids[idx].getBoundingClientRect().top - 1;

  ind.hidden = false;
  ind.style.left = (sr.left - pr.left) / s + 'px';
  ind.style.width = sr.width / s + 'px';
  ind.style.height = '2.5px';
  ind.style.top = (y - pr.top) / s - 1.5 + 'px';
}

function hideIndicator() {
  const ind = $('#indicator');
  if (ind) ind.hidden = true;
  $$('.drop-into').forEach(n => n.classList.remove('drop-into'));
}

function startDrag(ev, id) {
  const rec = find(id);
  if (!rec || rec.el.locked) return;
  drag = {
    id, startY: ev.clientY, startX: ev.clientX,
    moved: false, stack: null, idx: 0,
    before: JSON.stringify(state.doc)
  };
  const node = document.querySelector(`.page [data-id="${id}"]`);
  if (node) node.classList.add('is-dragging');
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd);
  ev.preventDefault();
}

/* 决定「放在哪」：
   · 拖的是卡片/面板 → 不进别的容器里，只在兄弟层排序（避免一拖就嵌套）
   · 从容器外面拖进来 → 靠近上下边缘算插到它前面/后面，中间才算放进去
   · 本来就是它的子元素 → 老老实实按顺序排，不意外弹出 */
function resolveDrop(x, y, dragId, dragEl) {
  const st = stackUnder(x, y, dragEl);
  if (!st) return null;

  const hostEl = st.dataset.stack ? st.closest('.el') : null;
  if (hostEl) {
    const isContainerDrag = dragEl && (dragEl.classList.contains('e-card') || dragEl.classList.contains('e-panel'));
    const parentStack = hostEl.parentElement ? hostEl.parentElement.closest('.stack') : null;
    const canEscape = parentStack && !(dragEl && dragEl.contains(parentStack));

    // 卡片 / 面板拖到横向行里是正常用法，不要把它弹回外层
    if (isContainerDrag && canEscape && !isRowStack(st)) {
      const s2 = slotIndex(parentStack, x, y, dragId);
      return { stack: parentStack, idx: s2.idx };
    }

    const draggedIsChild = dragEl && dragEl.parentElement === st;
    if (!draggedIsChild && canEscape) {
      const r = hostEl.getBoundingClientRect();
      const horiz = isRowStack(st);
      const rel = horiz
        ? (r.width > 0 ? (x - r.left) / r.width : 0.5)
        : (r.height > 0 ? (y - r.top) / r.height : 0.5);
      if (rel < 0.25 || rel > 0.75) {
        const s2 = slotIndex(parentStack, x, y, dragId);
        return { stack: parentStack, idx: s2.idx };
      }
    }
  }
  const { idx } = slotIndex(st, x, y, dragId);
  return { stack: st, idx };
}

function onDragMove(ev) {
  if (!drag) return;
  const dy = Math.abs(ev.clientY - drag.startY);
  const dx = Math.abs(ev.clientX - drag.startX);
  if (!drag.moved && dy + dx > 5) drag.moved = true;
  if (!drag.moved) return;

  const dragEl = document.querySelector(`.page [data-id="${drag.id}"]`);
  const t = resolveDrop(ev.clientX, ev.clientY, drag.id, dragEl);
  if (!t) { drag.stack = null; hideIndicator(); return; }
  drag.stack = t.stack; drag.idx = t.idx;
  showIndicator(t.stack, t.idx, drag.id, ev.clientX);
  $$('.drop-into').forEach(n => n.classList.remove('drop-into'));
  t.stack.classList.add('drop-into');
}

function onDragEnd() {
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  if (!drag) return;
  const d = drag;
  drag = null;
  hideIndicator();
  const node = document.querySelector(`.page [data-id="${d.id}"]`);
  if (node) node.classList.remove('is-dragging');

  if (!d.moved || !d.stack) { renderAll(); return; }

  const target = d.stack.dataset.stack;   // '' = 根
  const li = listOf(d.id);
  if (!li) { renderAll(); return; }
  li.arr.splice(li.i, 1);
  const tList = target ? find(target).el.children : state.doc.elements;
  const at = clamp(d.idx, 0, tList.length);
  tList.splice(at, 0, li.el);
  renderAll();
  pushHist(d.before);
  saveSoon();
}

/* 插入新元素到指定 stack/idx */
function insertAt(el, stack, idx) {
  const target = stack ? stack.dataset.stack : '';
  const tList = target ? find(target).el.children : state.doc.elements;
  // 横向行里的卡片/面板必须有明确宽度，否则 PCL 里会按内容一直撑开
  if (isRowStack(stack) && !el.w && TYPE[el.type] && TYPE[el.type].kid) el.w = 220;
  tList.splice(clamp(idx, 0, tList.length), 0, el);
}

/* --------------------------------------------------------------- 交互绑定 */
function initStage() {
  const stage = $('#stage');

  stage.addEventListener('pointerdown', ev => {
    if (state.preview || ev.button !== 0) return;
    const ae = document.activeElement;
    if (ae && ae.isContentEditable) { ev.preventDefault(); ae.blur(); return; }
    const elDom = ev.target.closest('.el');
    if (!elDom) { select(null); return; }
    if (ev.target.isContentEditable) return;
    const id = elDom.dataset.id;
    select(id);
    const rec = find(id);
    if (rec && !rec.el.locked) startDrag(ev, id);
  });

  stage.addEventListener('dblclick', ev => {
    if (state.preview) return;
    const t = ev.target.closest('[data-edit]');
    if (!t) return;
    const elDom = t.closest('.el');
    if (!elDom) return;
    const rec = find(elDom.dataset.id);
    if (!rec) return;
    const field = t.dataset.edit;
    t.setAttribute('contenteditable', 'plaintext-only');
    t.focus();
    const range = document.createRange();
    range.selectNodeContents(t);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(range);

    const done = () => {
      t.removeAttribute('contenteditable');
      const v = t.innerText.replace(/\u00a0/g, ' ');
      t.removeEventListener('blur', done);
      t.removeEventListener('keydown', onKey);
      const keys = field.split('.');
      const before = JSON.stringify(state.doc);
      if (keys.length > 1) rec.el[keys[0]][keys[1]] = v;
      else rec.el[keys[0]] = v;
      renderAll();
      pushHist(before);
      saveSoon();
    };
    const onKey = ke => {
      if (ke.key === 'Escape') { ke.preventDefault(); t.blur(); }
      if (ke.key === 'Enter' && !ke.shiftKey) { ke.preventDefault(); t.blur(); }
    };
    t.addEventListener('blur', done);
    t.addEventListener('keydown', onKey);
  });
}

function initPalette() {
  const palette = $('#palette');

  palette.addEventListener('pointerdown', ev => {
    const item = ev.target.closest('.pal-item');
    if (!item) return;
    const isBlock = !!item.dataset.block;
    const key = item.dataset.block || item.dataset.type;
    const label = isBlock ? BLOCK_LABEL[key] : TYPE[key].label;
    const build = () => isBlock ? BLOCK_BUILD[key]() : createEl(key);
    ev.preventDefault();

    const sx = ev.clientX, sy = ev.clientY;
    let ghost = null, moved = false;

    const mv = e2 => {
      if (!moved && Math.hypot(e2.clientX - sx, e2.clientY - sy) > 5) {
        moved = true;
        ghost = document.createElement('div');
        ghost.className = 'ghost';
        ghost.textContent = '+ ' + label;
        document.body.appendChild(ghost);
      }
      if (ghost) { ghost.style.left = (e2.clientX + 14) + 'px'; ghost.style.top = (e2.clientY + 12) + 'px'; }
      if (moved) {
        const t = resolveDrop(e2.clientX, e2.clientY, null, null);
        if (t) {
          showIndicator(t.stack, t.idx, null, e2.clientX);
          $$('.drop-into').forEach(n => n.classList.remove('drop-into'));
          t.stack.classList.add('drop-into');
        } else hideIndicator();
      }
    };
    const up = e3 => {
      document.removeEventListener('pointermove', mv);
      document.removeEventListener('pointerup', up);
      if (ghost) ghost.remove();
      hideIndicator();

      const before = JSON.stringify(state.doc);
      const el = build();
      if (!moved) {
        const root = $('.page');
        insertAt(el, root, state.doc.elements.length);
      } else {
        const page = $('#page');
        const r = page ? page.getBoundingClientRect() : null;
        if (!r || e3.clientX < r.left || e3.clientX > r.right || e3.clientY < r.top || e3.clientY > r.bottom) return;
        const t = resolveDrop(e3.clientX, e3.clientY, null, null);
        insertAt(el, t ? t.stack : $('.page'), t ? t.idx : state.doc.elements.length);
      }
      state.sel = el.id;
      renderAll();
      pushHist(before);
      saveSoon();
    };
    document.addEventListener('pointermove', mv);
    document.addEventListener('pointerup', up);
  });

  $('#palSearch').addEventListener('input', renderPalette);
}

function initLayers() {
  $('#layers').addEventListener('click', ev => {
    const act = ev.target.closest('.lay-act');
    if (act) {
      ev.stopPropagation();
      const rec = find(act.dataset.id);
      if (!rec) return;
      mutate(() => {
        if (act.dataset.act === 'vis') rec.el.hidden = !rec.el.hidden;
        if (act.dataset.act === 'lock') rec.el.locked = !rec.el.locked;
      });
      return;
    }
    const row = ev.target.closest('.layer');
    if (row) select(row.dataset.id);
  });
}

/* --------------------------------------------------------------- 属性编辑 */
function setPath(obj, path, val) {
  const parts = path.split('.');
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = val;
}

function moveEl(id, dir) {
  const li = listOf(id);
  if (!li) return;
  const to = li.i + (dir === 'up' ? -1 : 1);
  if (to < 0 || to >= li.arr.length) return;
  mutate(() => {
    const el = li.arr.splice(li.i, 1)[0];
    li.arr.splice(to, 0, el);
  });
}

function initInspector() {
  const host = $('#inspector');

  const readValue = t => {
    if (t.type === 'checkbox') return t.checked;
    if (t.type === 'number') {
      const v = parseFloat(t.value);
      return isNaN(v) ? 0 : v;
    }
    return t.value;
  };

  const apply = (t, field, val) => {
    if (!field) return;
    if (field.startsWith('view:')) {
      const key = field.split(':')[1];
      softChange(() => { state.doc.view[key] = val; });
      if (key === 'theme') {
        const dark = val === 'dark';
        state.doc.view.bg = dark ? '#202226' : '#EFF4FA';
        renderCanvas(); renderInspector();
      }
      return;
    }
    const rec = state.sel ? find(state.sel) : null;
    if (!rec) return;
    const e = rec.el;
    if (field === 'name') { softChange(() => { e.name = val; }); renderLayers(); return; }
    if (field === 'hidden') { softChange(() => { e.hidden = !!val; }); return; }
    if (field === 'w' || field === 'h') val = Math.max(1, val);
    if (field === 'gap') val = Math.max(0, val);
    softChange(() => setPath(e, field, val));
  };

  host.addEventListener('input', ev => {
    const t = ev.target;
    if (t.dataset && t.dataset.colorFor) {
      apply(t, t.dataset.colorFor, t.value);
      const sib = t.parentElement.querySelector('.inp');
      if (sib) sib.value = t.value;
      return;
    }
    if (t.dataset && t.dataset.field) apply(t, t.dataset.field, readValue(t));
  });

  host.addEventListener('change', ev => {
    const t = ev.target;
    if (t.dataset && t.dataset.field === 'p.colorAuto') {
      const rec = state.sel ? find(state.sel) : null;
      if (rec) {
        mutate(() => { rec.el.p.color = t.checked ? 'auto' : '#16181D'; });
        renderInspector();
      }
      return;
    }
    if (t.tagName === 'SELECT' && t.dataset.field) {
      apply(t, t.dataset.field, t.value);
      if (t.dataset.field === 'p.eventType') renderInspector();
    }
  });

  host.addEventListener('click', ev => {
    const seg = ev.target.closest('.seg-b');
    if (seg) {
      const field = seg.dataset.set, val = seg.dataset.val;
      const rec = state.sel ? find(state.sel) : null;
      if (field === 'wmode') {
        if (!rec) return;
        mutate(() => {
          if (val === 'fixed') { if (rec.el.w <= 0) rec.el.w = Math.min(320, state.doc.view.w); }
          else rec.el.w = 0;
        });
        renderInspector();
        return;
      }
      if (field.startsWith('view:')) {
        const key = field.split(':')[1];
        mutate(() => {
          state.doc.view[key] = val;
          if (key === 'theme') state.doc.view.bg = val === 'dark' ? '#202226' : '#EFF4FA';
        });
        renderInspector();
      } else if (rec) {
        mutate(() => setPath(rec.el, field, val));
        renderInspector();
      }
      return;
    }

    const tplBtn = ev.target.closest('[data-tpl]');
    if (tplBtn) { applyTemplate(tplBtn.dataset.tpl); return; }

    const bindBtn = ev.target.closest('[data-bind]');
    if (bindBtn && state.sel) {
      const rec = find(state.sel);
      if (rec) {
        const name = bindBtn.dataset.bind;
        const field = bindBtn.dataset.bindfield;
        // 注意：PCL 的 XAML 解析器不认 StringFormat，只能用最朴素的双向取值
        const expr = `{Binding ElementName=${name},Path=Text}`;
        mutate(() => setPath(rec.el, field, expr));
        renderInspector();
        toast('已绑定「' + name + '」，导出后 PCL 里会实时取值');
      }
      return;
    }

    const fillBtn = ev.target.closest('[data-fill]');
    if (fillBtn && state.sel) {
      const rec = find(state.sel);
      if (rec) {
        const oldVal = String(rec.el.p.eventData || '');
        // data-keep="0"：整串替换，不保留 | 后面的旧值（切换页面换主页面时要用）
        const keep = fillBtn.dataset.keep === '0'
          ? ''
          : (oldVal.includes('|') ? '|' + oldVal.slice(oldVal.indexOf('|') + 1) : '');
        mutate(() => { rec.el.p.eventData = fillBtn.dataset.fill + keep; });
        renderInspector();
      }
      return;
    }

    // 变量标记：点一下把 {user} 这类追加到对应字段末尾
    const insBtn = ev.target.closest('[data-ins]');
    if (insBtn && state.sel) {
      const rec = find(state.sel);
      if (rec) {
        const keys = insBtn.dataset.ins.split('.');
        const val = insBtn.dataset.val || '';
        mutate(() => {
          if (keys.length > 1) {
            const host = rec.el[keys[0]] || (rec.el[keys[0]] = {});
            host[keys[1]] = String(host[keys[1]] || '') + val;
          } else {
            rec.el[keys[0]] = String(rec.el[keys[0]] || '') + val;
          }
        });
        renderInspector();
      }
      return;
    }

    const mv = ev.target.closest('[data-move]');
    if (mv && state.sel) { moveEl(state.sel, mv.dataset.move); return; }

    const act = ev.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'del' && state.sel) {
        const li = listOf(state.sel);
        if (li) {
          mutate(() => li.arr.splice(li.i, 1));
          state.sel = null;
          renderAll();
        }
      }
      if (a === 'dup' && state.sel) {
        const li = listOf(state.sel);
        if (li) {
          const c = cloneEl(li.el);
          mutate(() => li.arr.splice(li.i + 1, 0, c));
          state.sel = c.id;
          renderAll();
        }
      }
    }
  });
}

/* --------------------------------------------------------------- 模板 */
function applyTemplate(key) {
  const fn = TEMPLATES[key];
  if (!fn) return;
  const before = JSON.stringify(state.doc);
  state.doc = fn();
  state.sel = null;
  $('#docName').value = state.doc.name;
  renderAll();
  pushHist(before);
  saveSoon();
  fitZoom();
  toast('已套用「' + (key === 'classic' ? '经典主页' : key === 'dark' ? '深色极简' : '空白') + '」· Ctrl+Z 可还原');
}

/* --------------------------------------------------------------- 缩放 */
function setZoom(s) {
  state.scale = clamp(Math.round(s * 100) / 100, 0.2, 2);
  renderCanvas();
  updateStatus();
}

function fitZoom() {
  const stage = $('#stage');
  const v = state.doc.view;
  const totalW = v.w + (state.chrome ? 32 : 0);
  const availW = stage.clientWidth - 72;
  const s = Math.min(availW / totalW, 1);
  setZoom(Math.max(0.3, Math.round(s * 20) / 20));
}

/* --------------------------------------------------------------- 存储 */
let saveTimer = null;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(save, 600);
}

function save(showMsg = false) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state.doc));
    if (showMsg) toast('工程已保存');
  } catch (e) { /* ignore */ }
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || !d.view || !Array.isArray(d.elements)) return false;
    state.doc = d;
    if (sanitizeDoc(d) > 0) toast('已自动修正工程里不被 PCL 支持的写法');
    return true;
  } catch (e) { return false; }
}

let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* --------------------------------------------------------------- 导出 XAML */
function xamlColor(c) {
  if (!c) return null;
  let s = String(c).trim();
  if (s.startsWith('{')) return s;
  if (/^#[0-9a-f]{3}$/i.test(s)) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  if (/^#[0-9a-f]{6}$/i.test(s)) return '#FF' + s.slice(1).toUpperCase();
  if (/^#[0-9a-f]{8}$/i.test(s)) return s.toUpperCase();
  return null;
}

function xamlText(s) {
  return escH(stripUnsupported(s)).replace(/\r\n/g, '\n').replace(/\n/g, '&#xA;');
}

function geo(e, parent) {
  const mx = Math.round(e.mx || 0), mt = Math.round(e.mt || 0);
  // 横向容器里「下间距」没意义，改成右间距
  let s = parent === 'row'
    ? ` Margin="0,0,${Math.round(e.gap) || 0},0"`
    : ` Margin="${mx},${mt},${mx},${Math.round(e.gap) || 0}"`;
  if (e.w > 0) {
    s += ` Width="${Math.round(e.w)}" HorizontalAlignment="${e.align === 'center' ? 'Center' : e.align === 'right' ? 'Right' : 'Left'}"`;
  }
  if (FIXED_H.has(e.type) && e.h) s += ` Height="${Math.round(e.h)}"`;
  if (e.valign && e.valign !== 'stretch') {
    s += ` VerticalAlignment="${e.valign === 'center' ? 'Center' : e.valign === 'bottom' ? 'Bottom' : 'Top'}"`;
  }
  if (e.noHit) s += ` IsHitTestVisible="False"`;
  // ToolTip 是所有控件通用的，统一在这里出，各分支不再重复写
  if (e.p && e.p.tooltip) s += ` ToolTip="${xamlText(e.p.tooltip)}"`;
  if (e.opacity !== undefined && e.opacity < 1) s += ` Opacity="${e.opacity}"`;
  return s;
}

function xamlEl(e, ind, parent) {
  const pad = '    '.repeat(ind);
  const out = [];
  const p = e.p;
  const g = geo(e, parent);

  switch (e.type) {
    case 'card': {
      const kids = (e.children || []).filter(k => !k.hidden);
      const cardExtra = (p.isSwapped ? ' IsSwapped="True"' : '')
        + (p.useAnim === false ? ' UseAnimation="False"' : '')
        + (p.swapRight ? ' SwapLogoRight="True"' : '')
        + (p.mouseAnim === false ? ' HasMouseAnimation="False"' : '');
      const attrs = `${p.title ? `Title="${xamlText(p.title)}" ` : ''}CanSwap="${p.canSwap ? 'True' : 'False'}"${cardExtra}${g}`;
      if (!kids.length) { out.push(`${pad}<local:MyCard ${attrs} />`); break; }
      // MyCard 的内容区不会自动避开标题，必须用 Margin 留白：左25 上40 右23 下15
      const inner = p.title ? '25,40,23,15' : '25,18,23,15';
      out.push(`${pad}<local:MyCard ${attrs}>`);
      out.push(`${pad}    <StackPanel Margin="${inner}">`);
      kids.forEach(k => out.push(...xamlEl(k, ind + 2, 'card')));
      out.push(`${pad}    </StackPanel>`);
      out.push(`${pad}</local:MyCard>`);
      break;
    }
    case 'panel': {
      const kids = (e.children || []).filter(k => !k.hidden);
      const attrs = `Background="${xamlColor(p.bg) || '#FFFFFFFF'}" BorderBrush="${xamlColor(p.border) || '#00000000'}" BorderThickness="${p.bw}" CornerRadius="${p.radius}"${g}`;
      if (!kids.length) { out.push(`${pad}<Border ${attrs} />`); break; }
      out.push(`${pad}<Border ${attrs}>`);
      out.push(`${pad}    <StackPanel Margin="${p.pad === undefined ? 12 : Math.round(p.pad)}">`);
      kids.forEach(k => out.push(...xamlEl(k, ind + 2, 'panel')));
      out.push(`${pad}    </StackPanel>`);
      out.push(`${pad}</Border>`);
      break;
    }
    case 'row': {
      const kids = (e.children || []).filter(k => !k.hidden);
      if (!kids.length) { out.push(`${pad}<StackPanel Orientation="Horizontal"${g} />`); break; }
      out.push(`${pad}<StackPanel Orientation="Horizontal"${g}>`);
      // StackPanel 没有 spacing，横向间距只能靠每个子元素的右 Margin
      const gx = p.gapx === undefined ? 10 : Number(p.gapx);
      kids.forEach((k, i) => {
        const bak = k.gap;
        k.gap = i === kids.length - 1 ? 0 : gx;
        out.push(...xamlEl(k, ind + 1, 'row'));
        k.gap = bak;
      });
      out.push(`${pad}</StackPanel>`);
      break;
    }
    case 'text': {
      const raw = (p.varName && !isBinding(p.text)) ? `{variable:${p.varName}:${p.text}}` : p.text;
      const fg = p.color === 'auto' ? '' : ` Foreground="${xamlColor(p.color) || '#FF16181D'}"`;
      const fw = p.weight === 'bold' ? ' FontWeight="Bold"' : '';
      const ta = p.align === 'center' ? ' TextAlignment="Center"' : p.align === 'right' ? ' TextAlignment="Right"' : '';
      out.push(`${pad}<TextBlock Text="${xamlText(raw)}" FontSize="${p.size}"${fg}${fw}${ta} TextWrapping="Wrap"${g} />`);
      break;
    }
    case 'button': {
      const ct = p.colorType === 'highlight' ? ' ColorType="Highlight"' : p.colorType === 'red' ? ' ColorType="Red"' : '';
      const ev = p.eventType ? ` EventType="${xamlText(p.eventType)}"` : '';
      const ed = (p.eventType && p.eventData && !NO_DATA_EVENTS.includes(p.eventType)) ? ` EventData="${xamlText(p.eventData)}"` : '';
      const pd = p.padding ? ` Padding="${xamlText(p.padding)}"` : '';
      out.push(`${pad}<local:MyButton Text="${xamlText(p.text)}"${ct}${pd}${ev}${ed}${g} />`);
      break;
    }
    case 'textbutton': {
      const ev = p.eventType ? ` EventType="${xamlText(p.eventType)}"` : '';
      const ed = (p.eventType && p.eventData && !NO_DATA_EVENTS.includes(p.eventType)) ? ` EventData="${xamlText(p.eventData)}"` : '';
      out.push(`${pad}<local:MyTextButton Text="${xamlText(p.text)}"${ev}${ed}${g} />`);
      break;
    }
    case 'hint':
      out.push(`${pad}<local:MyHint Text="${xamlText(p.text)}" Theme="${p.theme || (p.isWarn ? 'Yellow' : 'Blue')}"${g} />`);
      break;
    case 'listitem': {
      const logo = p.logo ? ` Logo="${xamlText(p.logo)}"` : '';
      const ev = p.eventType ? ` EventType="${xamlText(p.eventType)}"` : '';
      const ed = (p.eventType && p.eventData && !NO_DATA_EVENTS.includes(p.eventType)) ? ` EventData="${xamlText(p.eventData)}"` : '';
      const clickable = p.type === undefined ? !!p.eventType : p.type === 'Clickable';
      const tp = clickable ? ' Type="Clickable"' : '';
      out.push(`${pad}<local:MyListItem${logo} Title="${xamlText(p.title)}" Info="${xamlText(p.info)}"${tp}${ev}${ed}${g} />`);
      break;
    }
    case 'image': {
      const src = p.src ? ` Source="${xamlText(p.src)}"` : '';
      const fb = p.fallback ? ` FallbackSource="${xamlText(p.fallback)}"` : '';
      const ld = p.loading ? ` LoadingSource="${xamlText(p.loading)}"` : '';
      const cache = p.cache === false ? ' EnableCache="False"' : '';
      out.push(`${pad}<local:MyImage${src}${fb}${ld}${cache}${g} />`);
      break;
    }
    case 'textbox':
      out.push(`${pad}<local:MyTextBox HintText="${xamlText(p.hint)}" Name="${escH(p.name)}" CornerRadius="${p.radius === undefined ? 3 : p.radius}"${p.hasBg === false ? ' HasBackground="False"' : ''}${g} />`);
      break;
    case 'icontextbutton': {
      const logo = p.logo ? ` Logo="${xamlText(p.logo)}"` : '';
      const ls = (p.logoScale && Number(p.logoScale) !== 1) ? ` LogoScale="${p.logoScale}"` : '';
      const ct = p.colorType === 'highlight' ? ' ColorType="Highlight"' : p.colorType === 'red' ? ' ColorType="Red"' : '';
      const ev = p.eventType ? ` EventType="${xamlText(p.eventType)}"` : '';
      const ed = (p.eventType && p.eventData && !NO_DATA_EVENTS.includes(p.eventType)) ? ` EventData="${xamlText(p.eventData)}"` : '';
      out.push(`${pad}<local:MyIconTextButton Text="${xamlText(p.text)}"${logo}${ls}${ct}${ev}${ed}${g} />`);
      break;
    }
    case 'iconbutton': {
      const logo = p.logo ? ` Logo="${xamlText(p.logo)}"` : '';
      const ls = (p.logoScale && Number(p.logoScale) !== 1) ? ` LogoScale="${p.logoScale}"` : '';
      const th = p.theme && p.theme !== 'Color' ? ` Theme="${p.theme}"` : '';
      const ev = p.eventType ? ` EventType="${xamlText(p.eventType)}"` : '';
      const ed = (p.eventType && p.eventData && !NO_DATA_EVENTS.includes(p.eventType)) ? ` EventData="${xamlText(p.eventData)}"` : '';
      out.push(`${pad}<local:MyIconButton${logo}${ls}${th}${ev}${ed}${g} />`);
      break;
    }
    case 'divider':
      out.push(`${pad}<Rectangle Fill="${xamlColor(p.color) || '#FFDDDDDD'}" Height="1"${g} />`);
      break;
    case 'rect':
      out.push(`${pad}<Rectangle Fill="${xamlColor(p.bg) || '#FF1370B5'}" RadiusX="${p.radius}" RadiusY="${p.radius}"${g} />`);
      break;
  }
  return out;
}

function genXAML() {
  const d = state.doc;
  const out = [];
  out.push('<!-- ========================================================== -->');
  out.push(`<!--  PCL 主页工坊 导出 · ${new Date().toLocaleString('zh-CN')} -->`);
  out.push('<!--  用法：另存为 PCL\\Custom.xaml，放到 PCL 目录的 PCL 文件夹里  -->');
  out.push('<!--        然后在 PCL 中：设置 → 主页 → 选择「自定义主页」        -->');
  out.push('<!--  改坏了直接删掉这个文件即可恢复默认主页                      -->');
  out.push('<!-- ========================================================== -->');
  out.push('<StackPanel xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"');
  out.push('            xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"');
  out.push('            xmlns:local="clr-namespace:PCL;assembly=PCL">');
  out.push('');
  for (const e of d.elements) {
    if (e.hidden) continue;
    out.push(...xamlEl(e, 1, 'root'));
  }
  out.push('</StackPanel>');
  return out.join('\n');
}

function genJSON() {
  return JSON.stringify({ name: state.doc.name, view: state.doc.view, elements: state.doc.elements }, null, 2);
}

function highlightXML(src) {
  let s = escH(src);
  s = s.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="tk-com">$1</span>');
  s = s.replace(/(&lt;\/?)([\w:.]+)/g, '$1<span class="tk-tag">$2</span>');
  s = s.replace(/([\w:.]+)=(&quot;[^&]*?&quot;)/g, '<span class="tk-attr">$1</span>=<span class="tk-val">$2</span>');
  return s;
}

function openModal() {
  $('#modal').hidden = false;
  switchTab('xaml');
}

function switchTab(tab) {
  state.modalTab = tab;
  $$('.mtab').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const code = tab === 'xaml' ? genXAML() : genJSON();
  $('#codeView').innerHTML = tab === 'xaml' ? highlightXML(code) : escH(code);
  $('#modalSub').textContent = tab === 'xaml'
    ? '文件名就用 Custom.xaml，放进 PCL 目录里的 PCL 文件夹'
    : '工程备份，可用「模板 → 从 JSON 导入」恢复';
  const n = (state.doc.elements || []).length;
  let noVer = 0;
  walk(state.doc.elements, e => { if (e.p && e.p.eventType === '启动游戏' && !e.p.eventData) noVer++; });
  const warn = noVer && tab === 'xaml'
    ? `<br><b style="color:#E0A24C">注意：有 ${noVer} 个「启动游戏」按钮没填版本名，点了会报错</b>`
    : '';
  $('#modalNote').innerHTML = tab === 'xaml'
    ? `${n} 个顶层区块 · 纵向流式布局，宽度自适应 PCL 窗口 · 控件全部是 PCL 内置控件${warn}`
    : `${n} 个顶层区块 · 含全部子元素`;
}

function download(name, text, withBOM) {
  const blob = new Blob([withBOM ? '\ufeff' + text : text], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

/* --------------------------------------------------------------- 工具栏 */
function initToolbar() {
  $('#btnUndo').onclick = undo;
  $('#btnRedo').onclick = redo;

  $('#btnChrome').onclick = e => {
    state.chrome = !state.chrome;
    e.currentTarget.classList.toggle('on', state.chrome);
    renderCanvas(); fitZoom();
  };

  $('#btnZoomIn').onclick = () => setZoom(state.scale + 0.1);
  $('#btnZoomOut').onclick = () => setZoom(state.scale - 0.1);
  $('#btnFit').onclick = fitZoom;

  $('#btnPreview').onclick = e => {
    state.preview = !state.preview;
    e.currentTarget.classList.toggle('on', state.preview);
    e.currentTarget.textContent = state.preview ? '退出预览' : '预览';
    renderCanvas(); updateStatus();
  };

  $('#btnSave').onclick = () => save(true);
  $('#btnExport').onclick = openModal;

  $('#docName').addEventListener('input', e => {
    state.doc.name = e.target.value;
    saveSoon();
  });

  const tplSel = $('#tplSelect');
  tplSel.insertAdjacentHTML('beforeend', '<option value="import">从 JSON 导入…</option>');
  tplSel.addEventListener('change', () => {
    const v = tplSel.value;
    tplSel.value = '';
    if (!v) return;
    if (v === 'import') { importJSON(); return; }
    applyTemplate(v);
  });

  $('#modalClose').onclick = () => { $('#modal').hidden = true; };
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') $('#modal').hidden = true; });
  $$('.mtab').forEach(b => b.onclick = () => switchTab(b.dataset.tab));

  $('#btnCopy').onclick = async () => {
    const text = state.modalTab === 'xaml' ? genXAML() : genJSON();
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    $('#btnCopy').textContent = '已复制 ✓';
    setTimeout(() => $('#btnCopy').textContent = '复制', 1400);
  };

  $('#btnDownload').onclick = () => {
    if (state.modalTab === 'xaml') download('Custom.xaml', genXAML(), true);
    else download((state.doc.name || 'Custom') + '.json', genJSON(), false);
  };
}

function importJSON() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = () => {
    const f = input.files && input.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const d = JSON.parse(fr.result);
        if (!d.view || !Array.isArray(d.elements)) throw new Error('bad');
        const before = JSON.stringify(state.doc);
        state.doc = d;
        sanitizeDoc(state.doc);
        state.sel = null;
        $('#docName').value = d.name || 'Custom';
        renderAll(); pushHist(before); saveSoon(); fitZoom();
        toast('已导入工程');
      } catch (err) {
        alert('导入失败：不是本工具导出的 JSON 文件');
      }
    };
    fr.readAsText(f);
  };
  input.click();
}

function initKeys() {
  document.addEventListener('keydown', ev => {
    const t = ev.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

    if (ev.key === 'Escape' && state.preview) {
      state.preview = false;
      const b = $('#btnPreview');
      b.classList.remove('on'); b.textContent = '预览';
      renderCanvas(); updateStatus();
      return;
    }
    if (ev.key === 'Escape' && !$('#modal').hidden) { $('#modal').hidden = true; return; }
    if (typing) return;

    const mod = ev.ctrlKey || ev.metaKey;

    if (mod && ev.key.toLowerCase() === 'z') {
      ev.preventDefault();
      ev.shiftKey ? redo() : undo();
      return;
    }
    if (mod && ev.key.toLowerCase() === 'y') { ev.preventDefault(); redo(); return; }
    if (mod && ev.key.toLowerCase() === 's') { ev.preventDefault(); save(true); return; }
    if (mod && ev.key.toLowerCase() === 'e') { ev.preventDefault(); openModal(); return; }
    if (mod && (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') && state.sel) {
      ev.preventDefault();
      moveEl(state.sel, ev.key === 'ArrowUp' ? 'up' : 'down');
      return;
    }
    if (mod && ev.key.toLowerCase() === 'd' && state.sel) {
      ev.preventDefault();
      const li = listOf(state.sel);
      if (li) {
        const c = cloneEl(li.el);
        const before = JSON.stringify(state.doc);
        li.arr.splice(li.i + 1, 0, c);
        state.sel = c.id;
        renderAll(); pushHist(before); saveSoon();
      }
      return;
    }
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && state.sel) {
      ev.preventDefault();
      const li = listOf(state.sel);
      if (li) {
        const before = JSON.stringify(state.doc);
        li.arr.splice(li.i, 1);
        state.sel = null;
        renderAll(); pushHist(before); saveSoon();
      }
    }
  });
}

/* --------------------------------------------------------------- 启动 */
function readVersionsFromUrl() {
  try {
    const raw = new URLSearchParams(location.search).get('v');
    if (!raw) return [];
    return raw.split('|').map(decodeURIComponent).filter(Boolean);
  } catch (e) { return []; }
}

/* 原生宿主（WebView2）消息桥：无边框窗口拖动 / 最小化最大化关闭 */
const hostBridge = (typeof window !== 'undefined' && window.chrome && window.chrome.webview) ? window.chrome.webview : null;
function hostSend(msg) { if (hostBridge) hostBridge.postMessage(msg); }

function initNativeShell() {
  if (!hostBridge) return;
  document.body.classList.add('native');
  Array.from(document.querySelectorAll('#winBtns button')).forEach(b => {
    b.onclick = () => hostSend({ cmd: b.dataset.win });
  });
  // 宿主会告诉自己当前是不是最大化，用来切换 □ / ⧉ 图标
  hostBridge.addEventListener('message', ev => {
    const d = ev.data;
    if (d && d.cmd === 'state') document.body.classList.toggle('maxed', !!d.max);
  });
  const tb = document.getElementById('titlebar');
  if (tb) {
    tb.addEventListener('mousedown', ev => {
      if (ev.button !== 0) return;
      if (ev.target.closest('button, input')) return;
      hostSend({ cmd: 'drag' });
    });
    tb.addEventListener('dblclick', ev => {
      if (ev.target.closest('button, input')) return;
      hostSend({ cmd: 'max' });
    });
  }
}

function init() {
  initNativeShell();
  state.versions = readVersionsFromUrl();
  if (load()) toast('已恢复上次编辑的内容');
  else state.doc = tplClassic();

  $('#docName').value = state.doc.name || 'Custom';

  renderPalette();
  initPalette();
  initStage();
  initLayers();
  initInspector();
  initToolbar();
  initKeys();
  renderAll();
  fitZoom();

  window.addEventListener('beforeunload', () => save());
  window.addEventListener('resize', () => updateSelection());
  $('#stage').addEventListener('scroll', updateSelection, { passive: true });
}

document.addEventListener('DOMContentLoaded', init);
