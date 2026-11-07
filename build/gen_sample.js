const fs = require('fs');
const vm = require('vm');

const stub = () => ({
  style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  addEventListener() {}, setAttribute() {}, getAttribute() { return null; },
  querySelector() { return null; }, querySelectorAll() { return []; },
  appendChild() {}, insertAdjacentHTML() {}, remove() {}, focus() {},
  closest() { return null; }, contains() { return false; },
  innerHTML: '', textContent: '', value: '', hidden: false,
  clientWidth: 1200, clientHeight: 700,
  getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 })
});

const ctx = {
  console,
  document: {
    querySelector: () => stub(), querySelectorAll: () => [],
    createElement: () => stub(), addEventListener() {}, body: stub(),
    activeElement: null
  },
  window: { addEventListener() {}, getSelection: () => ({ removeAllRanges() {}, addRange() {} }) },
  localStorage: { getItem: () => null, setItem() {} },
  navigator: {},
  setTimeout, clearTimeout,
  Blob: function () {}, URL: { createObjectURL: () => '', revokeObjectURL() {} },
  alert() {}, confirm: () => true
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('app.js', 'utf8'), ctx, { filename: 'app.js' });

vm.runInContext('state.doc = tplClassic();', ctx);
const xaml = vm.runInContext('genXAML()', ctx);
// 示例里给启动按钮填上版本名，避免在 PCL 里点了报「尚未安装该版本」
const fixed = xaml.replace('EventType="启动游戏"', 'EventType="启动游戏" EventData="26.2"');
fs.writeFileSync('sample/Custom.xaml', '\ufeff' + fixed, 'utf8');

// 标签配对校验
const re = /<\/?([A-Za-z_][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
const stack = [];
let m, n = 0, bad = null;
while ((m = re.exec(xaml))) {
  n++;
  if (m[0].startsWith('</')) {
    const top = stack.pop();
    if (top !== m[1]) { bad = `不匹配 </${m[1]}> (期望 </${top}>)`; break; }
  } else if (!m[3]) stack.push(m[1]);
}
console.log('标签数', n, '| 未闭合:', stack.length, '|', bad || '结构 OK');
console.log(xaml.split('\n').slice(0, 14).join('\n'));
