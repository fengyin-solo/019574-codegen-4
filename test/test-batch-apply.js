/**
 * 批量套用功能逻辑测试（Node + DOM mock）
 * 运行: node test-batch-apply.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

/* ---------- DOM Mock ---------- */
function makeClassList() {
    const set = new Set();
    return {
        add: (...cs) => cs.forEach(c => set.add(c)),
        remove: (...cs) => cs.forEach(c => set.delete(c)),
        toggle: (c, force) => {
            const shouldAdd = force === undefined ? !set.has(c) : force;
            if (shouldAdd) set.add(c); else set.delete(c);
            return shouldAdd;
        },
        contains: (c) => set.has(c)
    };
}

function makeCtx() {
    return new Proxy({}, {
        get: (t, prop) => (prop in t ? t[prop] : () => {}),
        set: (t, prop, v) => { t[prop] = v; return true; }
    });
}

function makeElement(id = '') {
    return {
        id,
        classList: makeClassList(),
        style: {},
        dataset: {},
        children: [],
        textContent: '',
        innerHTML: '',
        value: '',
        disabled: false,
        listeners: {},
        addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
        removeEventListener() {},
        appendChild(c) { this.children.push(c); },
        remove() {},
        querySelector() { return makeElement(); },
        querySelectorAll() { return []; },
        getBoundingClientRect() { return { width: 800, height: 600, left: 0, top: 0 }; },
        click() { (this.listeners.click || []).forEach(fn => fn({ target: this })); }
    };
}

const elements = {};
// HTML 中初始带 hidden 类的元素
const INIT_HIDDEN = new Set(['batch-apply-modal', 'batch-result', 'panel-params']);
global.document = {
    readyState: 'complete',
    getElementById(id) {
        if (!elements[id]) {
            const el = makeElement(id);
            if (id === 'optics-canvas') {
                el.getContext = () => makeCtx();
                el.parentElement = makeElement('canvas-wrapper');
            }
            if (INIT_HIDDEN.has(id)) {
                el.classList.add('hidden');
            }
            elements[id] = el;
        }
        return elements[id];
    },
    querySelectorAll() { return []; },
    querySelector() { return makeElement(); },
    createElement() { return makeElement(); },
    addEventListener() {}
};

global.window = new EventTarget();
global.window.devicePixelRatio = 1;
global.window.innerWidth = 1280;
global.navigator = { maxTouchPoints: 0 };
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };

/* ---------- 按浏览器顺序加载脚本 ---------- */
const jsDir = path.join(__dirname, '..', 'frontend-user', 'js');
['config.js', 'utils.js', 'storage.js', 'physics.js', 'lens.js', 'renderer.js', 'canvas.js', 'interaction.js']
    .forEach(f => vm.runInThisContext(fs.readFileSync(path.join(jsDir, f), 'utf8'), { filename: f }));

/* ---------- 测试 ---------- */
let passed = 0, failed = 0;
function assert(cond, name) {
    if (cond) { passed++; console.log('  ✓ ' + name); }
    else { failed++; console.error('  ✗ ' + name); }
}

const cm = new CanvasManager();
const im = new InteractionManager(cm);
const btnBatch = document.getElementById('btn-batch-apply');
const modal = document.getElementById('batch-apply-modal');
const btnConfirm = document.getElementById('btn-batch-confirm');
const resultEl = document.getElementById('batch-result');

console.log('【1】按钮启用/禁用');
assert(btnBatch.disabled === true, '无透镜时按钮禁用');
cm.addLens(new Lens({ type: 'convex', x: 200, y: 300 }));
assert(btnBatch.disabled === true, '只有 1 个透镜时按钮禁用');
cm.addLens(new Lens({ type: 'concave', x: 400, y: 300, curvature: 30 }));
assert(btnBatch.disabled === false, '2 个透镜时按钮启用');

console.log('【2】触摸设备点击添加的透镜参与批量套用');
// 触摸点击添加走的就是 addLens + selectLens 这条路径
const touchLens = new Lens({ type: 'aspheric', x: 600, y: 300, size: 120 });
cm.addLens(touchLens);
cm.selectLens(touchLens);
assert(cm.lenses.includes(touchLens), '触摸添加的透镜在透镜列表中');
cm.selectLens(cm.lenses[0]);
let plan = im.buildBatchPlan(cm.lenses[0]);
assert(plan.changed.some(item => item.lens === touchLens), '批量计划包含触摸添加的透镜');

console.log('【3】无选中透镜时给出提示');
cm.deselectLens();
let toastMsg = null;
const origToast = Utils.showToast;
Utils.showToast = (msg, type) => { toastMsg = { msg, type }; };
im.openBatchApplyModal();
assert(toastMsg && toastMsg.type === 'warning', '无选中透镜时弹出 warning 提示');
assert(modal.classList.contains('hidden'), '未选中时确认框不打开');
Utils.showToast = origToast;

console.log('【4】套用前逐条列出改动与跳过');
const source = cm.lenses[0];
source.refractiveIndex = 1.7; source.size = 130; source.curvature = 70; source.applyMaterial('highIndex');
// 让第三个透镜与源参数完全一致 -> 应被跳过
touchLens.applyMaterial('highIndex');
touchLens.refractiveIndex = 1.7; touchLens.size = 130; touchLens.curvature = 70;
cm.selectLens(source);
plan = im.buildBatchPlan(source);
assert(plan.changed.length === 1 && plan.changed[0].lens === cm.lenses[1], '1 个透镜将改动');
assert(plan.changed[0].diffs.length === 4, '改动透镜列出 4 项参数差异(折射率/尺寸/弧度/材料)');
assert(plan.skipped.length === 2, '2 个透镜被跳过(源透镜 + 参数已相同)');
assert(plan.skipped[0].reason.includes('源透镜'), '源透镜跳过原因正确');
assert(plan.skipped[1].reason.includes('参数已相同'), '参数相同透镜跳过原因正确');
im.openBatchApplyModal();
assert(!modal.classList.contains('hidden'), '确认框已打开');
assert(btnConfirm.disabled === false, '有改动透镜时确认按钮可用');

console.log('【5】确认套用');
im.confirmBatchApply();
const target = cm.lenses[1];
assert(target.refractiveIndex === 1.7 && target.size === 130 && target.curvature === 70 && target.material === 'highIndex',
    '目标透镜四项参数已套用');
assert(target.dispersion === CONFIG.MATERIALS.HIGH_INDEX.dispersion, '目标透镜色散系数随材料更新');
assert(modal.classList.contains('hidden'), '套用后确认框关闭');
assert(!resultEl.classList.contains('hidden'), '参数面板显示批量套用结果');
assert(document.getElementById('batch-result-list').innerHTML.includes('已更新 4 项参数'), '结果逐条列出改动');
assert(document.getElementById('batch-result-list').innerHTML.includes('已跳过'), '结果逐条列出跳过');
assert(document.getElementById('param-ri').value == 1.7, '套用后参数面板已刷新');

console.log('【6】全部参数相同时确认按钮禁用');
plan = im.buildBatchPlan(source); // 现在所有透镜参数一致
assert(plan.changed.length === 0, '无透镜需要改动');
im.openBatchApplyModal();
assert(btnConfirm.disabled === true, '确认按钮禁用');
im.closeBatchApplyModal();

console.log('【7】重置透镜后批量结果清除');
im.showBatchResult(im.buildBatchPlan(source));
assert(!resultEl.classList.contains('hidden'), '结果已显示');
document.getElementById('btn-reset-lens').click();
assert(resultEl.classList.contains('hidden'), '重置透镜后结果被清除');

console.log('【8】重置画布后批量结果清除 + 按钮禁用');
im.showBatchResult({ changed: [{ label: 'X', diffs: [1] }], skipped: [] });
document.getElementById('btn-reset-canvas').click();
assert(resultEl.classList.contains('hidden'), '重置画布后结果被清除');
assert(btnBatch.disabled === true, '重置画布后按钮禁用');
assert(cm.lenses.length === 0, '画布已清空');

console.log(`\n结果: ${passed} 通过, ${failed} 失败`);
process.exit(failed > 0 ? 1 : 0);
