import './style.css';
import { AmbientLight, BoxGeometry, Color, EdgesGeometry, Fog, HemisphereLight, LineBasicMaterial, LineSegments, Scene, WebGLRenderer, DirectionalLight } from 'three';
import { createIcons, Backpack, Pause, Play, RotateCcw, X, Pickaxe, Hand, ArrowUp, SlidersHorizontal, Check } from 'lucide';
import { BLOCKS, Block, inWorld } from './blocks';
import { Player, trace, Hit } from './player';
import { swatch } from './textures';
import { World, defaultHotbar, readSave, writeSave, clearSave, SaveData } from './world';

const app = document.querySelector<HTMLDivElement>('#app')!;
const touch = matchMedia('(pointer: coarse)').matches;
const saved = readSave();
const seed = saved?.seed ?? Math.random().toString(36).slice(2, 10).toUpperCase();
const world = new World(seed, saved?.edits);
const spawn = world.spawn();
const validPosition = saved?.position?.length === 3 && saved.position.every(Number.isFinite) && inWorld(Math.floor(saved.position[0]), Math.floor(saved.position[2])) && saved.position[1] > 1;
const player = new Player(world, validPosition ? saved!.position : spawn);
player.sensitivity = saved?.sensitivity && saved.sensitivity >= .0008 && saved.sensitivity <= .005 ? saved.sensitivity : .0022;
let view = saved?.view && saved.view >= 1 && saved.view <= 4 ? saved.view : (touch ? 2 : 3);
let hotbar = saved?.hotbar?.length === 9 && saved.hotbar.every(b => BLOCKS.some(item => item.id === b)) ? saved.hotbar : [...defaultHotbar];
let selected = 0;
let mode: 'start' | 'playing' | 'pause' | 'inventory' = 'start';
let hasStarted = false;
let target: Hit | null = null;
let saveTimer = 0;
let saveTick = 0;
let resetting = false;
const scene = new Scene();
scene.background = new Color('#b5d9db');
scene.fog = new Fog('#b5d9db', 36, 100);
scene.add(new HemisphereLight('#fff0d2', '#7d9895', 2.2));
scene.add(new AmbientLight('#ffffff', .25));
const sun = new DirectionalLight('#fff3da', 2.2);
sun.position.set(35, 65, 20);
scene.add(sun, world.group);
const renderer = new WebGLRenderer({ antialias: !touch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, touch ? 1.5 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = 'srgb';
renderer.domElement.id = 'game';
renderer.domElement.setAttribute('aria-label', '3D 方块世界');
app.append(renderer.domElement);
const outline = new LineSegments(new EdgesGeometry(new BoxGeometry(1.012, 1.012, 1.012)), new LineBasicMaterial({ color: '#fff5c9', depthTest: false, transparent: true, opacity: .96 }));
outline.renderOrder = 4;
outline.visible = false;
scene.add(outline);
world.update(player.position.x, player.position.z, view);
world.buildNext(9);

const icon = (name: string) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
app.insertAdjacentHTML('beforeend', `
  <div id="hud">
    <div class="top-left"><div class="brand"><span class="brand-mark">▦</span><span>方块漫游</span><span class="edition">CREATIVE</span></div><div class="world-meta">世界 <b>${seed}</b><span class="meta-divider">/</span><span id="coords"></span></div></div>
    <div class="top-right"><button id="inventory-btn" class="icon-button" title="背包 (E)" aria-label="背包">${icon('backpack')}</button><button id="pause-btn" class="icon-button" title="暂停 (Esc)" aria-label="暂停">${icon('pause')}</button></div>
    <div id="crosshair" aria-hidden="true"></div>
    <div class="bottom-ui"><div id="block-label"></div><div id="hotbar" aria-label="快捷栏"></div><div class="footer-line"><span>创造模式 · 无限方块</span><span class="desktop-help">WASD 移动　空格 跳跃　左键 破坏　右键 放置　E 背包</span></div></div>
    <div id="touch-ui"><div id="joystick" aria-label="移动摇杆"><div id="stick"></div></div><div class="touch-actions"><button id="touch-jump" aria-label="跳跃" title="跳跃">${icon('arrow-up')}</button><button id="touch-break" aria-label="破坏" title="破坏">${icon('pickaxe')}</button><button id="touch-place" aria-label="放置" title="放置">${icon('hand')}</button></div></div>
  </div>
  <div id="overlay" class="visible" role="dialog" aria-modal="true"><div id="modal"></div></div>
  <div id="toast" aria-live="polite"></div>
`);
createIcons({ icons: { Backpack, Pause, Play, RotateCcw, X, Pickaxe, Hand, ArrowUp, SlidersHorizontal, Check } });
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const modal = $('modal');
const overlay = $('overlay');
const coords = $('coords');
const hotbarElement = $('hotbar');
const toastElement = $('toast');
const overlayTitle = () => mode === 'start' ? '开始探索' : mode === 'pause' ? '暂停游戏' : '方块背包';
function notify(text: string) { toastElement.textContent = text; toastElement.classList.add('on'); clearTimeout(notifyTimer); notifyTimer = window.setTimeout(() => toastElement.classList.remove('on'), 2100); }
let notifyTimer = 0;
function save() {
  if (resetting) return;
  const data: SaveData = { seed, position: player.position.toArray() as [number, number, number], edits: world.edits, hotbar, sensitivity: player.sensitivity, view };
  writeSave(data);
}
function renderHotbar() {
  hotbarElement.innerHTML = hotbar.map((block, i) => `<button class="slot ${i === selected ? 'active' : ''}" data-slot="${i}" aria-label="${i + 1}: ${BLOCKS.find(b => b.id === block)?.name}" title="${BLOCKS.find(b => b.id === block)?.name}"><span class="slot-number">${i + 1}</span><img src="${swatch(block)}" alt=""><span class="slot-shine"></span></button>`).join('');
  $('block-label').textContent = BLOCKS.find(b => b.id === hotbar[selected])?.name ?? '';
  hotbarElement.querySelectorAll<HTMLButtonElement>('.slot').forEach(button => button.addEventListener('click', () => { selected = Number(button.dataset.slot); renderHotbar(); if (mode === 'playing' && !touch) requestLock(); }));
}
renderHotbar();
function renderModal() {
  overlay.classList.toggle('visible', mode !== 'playing');
  document.body.classList.toggle('is-playing', mode === 'playing');
  if (mode === 'playing') { modal.innerHTML = ''; return; }
  const title = overlayTitle();
  if (mode === 'inventory') {
    modal.innerHTML = `<div class="modal-header"><div><span class="eyebrow">CREATIVE INVENTORY</span><h2>${title}</h2></div><button id="close-modal" class="close-button" aria-label="关闭背包" title="关闭">${icon('x')}</button></div><p class="muted">选择方块放入当前快捷栏第 ${selected + 1} 格</p><div id="inventory-grid">${BLOCKS.map(b => `<button class="inventory-item" data-block="${b.id}" title="${b.name}"><img src="${swatch(b.id)}" alt=""><span>${b.name}</span></button>`).join('')}</div><div class="modal-foot">当前快捷栏 <strong>${selected + 1} / 9</strong><span>点击下方快捷栏可切换目标格</span></div>`;
    modal.querySelectorAll<HTMLButtonElement>('[data-block]').forEach(button => button.onclick = () => { hotbar[selected] = Number(button.dataset.block) as Block; renderHotbar(); save(); renderModal(); notify(`已装备 ${BLOCKS.find(b => b.id === hotbar[selected])?.name}`); });
  } else {
    modal.innerHTML = `<div class="modal-header"><div><span class="eyebrow">${mode === 'start' ? 'A WORLD OF YOUR OWN' : 'TAKE A BREATH'}</span><h2>${mode === 'start' ? '走进方块世界' : title}</h2></div><div class="modal-symbol">▦</div></div><p class="modal-description">${mode === 'start' ? '山丘、树林和水岸已为你生成。' : '你的探索进度已自动保存。'}</p><button id="continue" class="primary-button">${icon('play')}<span>${mode === 'start' ? '开始游戏' : '继续游戏'}</span><span class="button-arrow">↗</span></button><div class="settings"><div class="settings-heading">${icon('sliders-horizontal')}<span>游戏设置</span></div><label class="setting-row"><span>鼠标灵敏度<small>调整视角转动速度</small></span><input type="range" id="sensitivity" min="0.8" max="5" step="0.1" value="${(player.sensitivity * 1000).toFixed(1)}"><output id="sensitivity-value">${(player.sensitivity * 1000).toFixed(1)}</output></label><label class="setting-row"><span>视距<small>影响场景渲染范围</small></span><input type="range" id="view" min="1" max="4" step="1" value="${view}"><output id="view-value">${view} 区块</output></label></div><div class="danger-area"><button id="reset" class="text-button">${icon('rotate-ccw')} 重置世界</button><span>种子 ${seed}</span></div>`;
    $('sensitivity').oninput = (e) => { player.sensitivity = Number((e.target as HTMLInputElement).value) / 1000; $('sensitivity-value').textContent = (player.sensitivity * 1000).toFixed(1); save(); };
    $('view').oninput = (e) => { view = Number((e.target as HTMLInputElement).value); $('view-value').textContent = `${view} 区块`; world.update(player.position.x, player.position.z, view); scene.fog = new Fog('#b5d9db', view * 11, view * 27 + 18); save(); };
    $('continue').onclick = resume;
    $('reset').onclick = () => {
      modal.innerHTML = `<div class="modal-header"><div><span class="eyebrow">RESET WORLD</span><h2>重置这个世界？</h2></div></div><p class="modal-description">这会永久删除当前种子、建筑和玩家位置，并生成一张新地图。</p><div class="confirm-actions"><button id="cancel-reset" class="secondary-button">取消</button><button id="confirm-reset" class="danger-button">确认重置</button></div>`;
      $('cancel-reset').onclick = renderModal;
      $('confirm-reset').onclick = () => { resetting = true; clearSave(); location.reload(); };
    };
  }
  $('close-modal')?.addEventListener('click', resume);
  createIcons({ icons: { Backpack, Pause, Play, RotateCcw, X, Pickaxe, Hand, ArrowUp, SlidersHorizontal, Check }, attrs: { 'stroke-width': 2 } });
}
function requestLock() {
  if (touch) return;
  renderer.domElement.requestPointerLock().catch(() => { pause(); notify('浏览器未允许锁定鼠标，点击继续重试'); });
}
function resume() {
  mode = 'playing'; hasStarted = true;
  renderModal();
  requestLock();
}
function pause() {
  if (mode === 'start' || mode === 'pause') return;
  mode = 'pause'; player.clearInput(); save();
  if (document.pointerLockElement) document.exitPointerLock();
  renderModal();
}
function inventory() {
  if (mode === 'start') return;
  if (mode === 'inventory') { resume(); return; }
  mode = 'inventory'; player.clearInput(); save();
  if (document.pointerLockElement) document.exitPointerLock();
  renderModal();
}
$('pause-btn').onclick = pause;
$('inventory-btn').onclick = inventory;
renderModal();
if (touch) app.classList.add('touch-device');

document.addEventListener('pointerlockchange', () => { if (!touch && !document.pointerLockElement && mode === 'playing') pause(); });
document.addEventListener('mousemove', e => { if (mode === 'playing' && document.pointerLockElement === renderer.domElement) player.look(e.movementX, e.movementY); });
document.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'Escape') { if (mode === 'inventory') pause(); else if (mode === 'playing') pause(); return; }
  if (e.code === 'KeyE' && !e.repeat) { inventory(); return; }
  if (mode !== 'playing') return;
  if (/^Digit[1-9]$/.test(e.code)) { selected = Number(e.code.slice(-1)) - 1; renderHotbar(); }
  player.keys.add(e.code);
});
document.addEventListener('keyup', e => player.keys.delete(e.code));
window.addEventListener('blur', () => { player.clearInput(); if (mode === 'playing') pause(); });
window.addEventListener('beforeunload', save);
renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());
renderer.domElement.addEventListener('mousedown', e => { if (mode !== 'playing') return; if (!touch && document.pointerLockElement !== renderer.domElement) { requestLock(); return; } if (e.button === 0) interact(false); if (e.button === 2) interact(true); });
renderer.domElement.addEventListener('wheel', e => { if (mode !== 'playing') return; e.preventDefault(); selected = (selected + Math.sign(e.deltaY) + 9) % 9; renderHotbar(); }, { passive: false });
function interact(place: boolean) {
  const hit = trace(world, player.position, player.direction);
  if (!hit) return;
  if (place) {
    const block: [number, number, number] = [hit.block[0] + hit.normal[0], hit.block[1] + hit.normal[1], hit.block[2] + hit.normal[2]];
    if (hit.normal.every(v => v === 0) || !inWorld(block[0], block[2]) || player.overlaps(block) || (world.get(...block) !== Block.Air && world.get(...block) !== Block.Water)) return;
    if (world.set(...block, hotbar[selected])) save();
  } else if (world.set(...hit.block, Block.Air)) save();
}

const joystick = $('joystick'), stick = $('stick');
let joyId: number | null = null;
joystick.addEventListener('pointerdown', e => { if (mode !== 'playing') return; joyId = e.pointerId; joystick.setPointerCapture(e.pointerId); updateJoystick(e); });
joystick.addEventListener('pointermove', e => { if (joyId === e.pointerId) updateJoystick(e); });
function updateJoystick(e: PointerEvent) { const r = joystick.getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2, len = Math.max(1, Math.hypot(dx, dy)), reach = Math.min(1, len / (r.width * .32)); player.mobileX = dx / len * reach; player.mobileY = dy / len * reach; stick.style.transform = `translate(${player.mobileX * 27}px, ${player.mobileY * 27}px)`; }
function releaseJoystick(e: PointerEvent) { if (joyId !== e.pointerId) return; joyId = null; player.mobileX = player.mobileY = 0; stick.style.transform = ''; }
joystick.addEventListener('pointerup', releaseJoystick);
joystick.addEventListener('pointercancel', releaseJoystick);
let lookId: number | null = null, lastX = 0, lastY = 0;
renderer.domElement.addEventListener('pointerdown', e => { if (!touch || mode !== 'playing' || e.clientX < innerWidth * .3) return; lookId = e.pointerId; lastX = e.clientX; lastY = e.clientY; renderer.domElement.setPointerCapture(e.pointerId); });
renderer.domElement.addEventListener('pointermove', e => { if (lookId !== e.pointerId || mode !== 'playing') return; player.look(e.clientX - lastX, e.clientY - lastY, 1.5); lastX = e.clientX; lastY = e.clientY; });
for (const event of ['pointerup', 'pointercancel'] as const) renderer.domElement.addEventListener(event, e => { if (lookId === e.pointerId) lookId = null; });
$('touch-jump').addEventListener('pointerdown', e => { e.preventDefault(); player.jumpHeld = true; });
for (const event of ['pointerup', 'pointercancel', 'pointerleave']) $('touch-jump').addEventListener(event, () => { player.jumpHeld = false; });
$('touch-break').onclick = () => { if (mode === 'playing') interact(false); };
$('touch-place').onclick = () => { if (mode === 'playing') interact(true); };
window.addEventListener('resize', () => { player.camera.aspect = innerWidth / innerHeight; player.camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

let previous = performance.now();
function frame(time: number) {
  requestAnimationFrame(frame);
  const dt = Math.min((time - previous) / 1000, .05); previous = time;
  world.buildNext(touch ? 1 : 2);
  if (mode === 'playing') {
    player.update(dt);
    saveTick += dt;
    if (saveTick > 7) { saveTick = 0; save(); }
  }
  world.update(player.position.x, player.position.z, view);
  const hit = trace(world, player.position, player.direction);
  const same = target && hit && target.block.every((v, i) => v === hit.block[i]);
  if (!same) target = hit;
  outline.visible = !!hit && mode === 'playing';
  if (hit) outline.position.set(hit.block[0] + .5, hit.block[1] + .5, hit.block[2] + .5);
  if (time - saveTimer > 350) { coords.textContent = `${Math.floor(player.position.x)}, ${Math.floor(player.position.y)}, ${Math.floor(player.position.z)}`; saveTimer = time; }
  renderer.render(scene, player.camera);
}
requestAnimationFrame(frame);

// Kept read-only for local smoke tests and debugging.
Object.defineProperty(window, '__voxel', { value: { world, player, get mode() { return mode; }, get selected() { return selected; }, interact, save, trace: () => trace(world, player.position, player.direction), get pending() { return world.pending; }, get hasStarted() { return hasStarted; } } });
