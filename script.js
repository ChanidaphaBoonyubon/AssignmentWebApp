// ---------- ENV (เริ่มต้นไฟล์) ----------
// ใช้กับ Vite: ใส่ VITE_DRONE_ID และ VITE_API_URL ในไฟล์ .env
// ถ้าเปิดไฟล์ตรง ๆ หรือไม่ได้ตั้งค่า จะเข้าโหมดสาธิต (ข้อมูลจำลอง)
const ENV = import.meta.env ?? {};
const DEFAULT_ID = ENV.VITE_DRONE_ID || '64010000';
// อยากให้เลือกโดรนได้หลายตัว: ใส่ VITE_DRONE_IDS=64010000,64010001 ใน .env (ไม่บังคับ)
// โหมดสาธิตมีโดรนให้เลือก 3 ตัวอยู่แล้ว
const extra = (ENV.VITE_DRONE_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
const IDS = [...new Set([DEFAULT_ID, ...(ENV.VITE_API_URL ? extra : ['64010001', '3001'])])];
let droneId = DEFAULT_ID;
const API_URL = (ENV.VITE_API_URL || '').replace(/\/$/, '');
const API_TOKEN = ENV.VITE_API_TOKEN || ''; // ไม่บังคับ ห้าม commit .env

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
if (!API_URL) $('#demo').classList.remove('hidden');

// ---------- API ----------
const DEMO = {
    [DEFAULT_ID]: { drone_name: 'Aero-01', country: 'Thailand', light: 'on' },
    '64010001': { drone_name: 'Dot Dot', country: 'India', light: 'off' },
    '3001': { drone_name: 'Cube-X', country: 'Japan', light: 'on' }
};
const demoLogs = Object.entries(DEMO).flatMap(([id, d], k) =>
    Array.from({ length: 30 }, (_, i) => ({
        created_at: new Date(Date.now() - (30 - i) * 18e5 - k * 6e5).toISOString(),
        country: d.country,
        drone_id: id,
        drone_name: d.drone_name,
        celsius: +(26 + k * 1.5 + Math.sin(i / 3) * 3).toFixed(1)
    }))
);

async function mockApi(path, o) {
    await new Promise((r) => setTimeout(r, 350));
    const id = path.split('/')[2];
    if (path.startsWith('/configs/')) {
        if (!DEMO[id]) throw new Error('API 404: ไม่พบโดรนนี้');
        return { drone_id: id, ...DEMO[id] };
    }
    if (path === '/logs' && o.method === 'POST') {
        demoLogs.push({ ...JSON.parse(o.body), created_at: new Date().toISOString() });
        return { ok: true };
    }
    return demoLogs.filter((l) => l.drone_id === id);
}

async function api(path, options = {}) {
    if (!API_URL) return mockApi(path, options);
    const res = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}) },
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 120)}`);
    return res.json();
}
const unwrap = (j) => j?.data ?? j;

// ---------- SPA navigation + hamburger ----------
const menu = $('#menu'), burger = $('#burger');
function toggleMenu(open) {
    menu.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'ปิดเมนู' : 'เปิดเมนู');
}
burger.onclick = () => toggleMenu(!menu.classList.contains('open'));
addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleMenu(false); });

function go(i) {
    $('#pages').style.transform = `translateX(-${i * 25}%)`;
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('on', +a.dataset.go === i));
    document.querySelectorAll('.page').forEach((p, n) => (p.inert = n !== i));
    toggleMenu(false);
    scrollTo(0, 0);
    if (i === 3) loadLogs();
    if (i === 1 && !getConfig()) loadConfig();
}
document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-go]');
    if (t) { e.preventDefault(); go(+t.dataset.go); }
});

function toast(msg, bad) {
    const t = $('#toast');
    t.textContent = msg;
    t.style.background = bad ? '#ffb4a8' : '#c9f5a8';
    t.classList.remove('hidden');
    clearTimeout(toast.id);
    toast.id = setTimeout(() => t.classList.add('hidden'), 3200);
}

// ---------- Page 1: Config ----------
let memCfg = null;
const getConfig = () => {
    let c = memCfg;
    if (!c) { try { c = JSON.parse(localStorage.getItem('droneConfig')); } catch { } }
    return c && String(c.drone_id) === String(droneId) ? c : null;
};

function renderConfig(c) {
    const on = String(c.light).toLowerCase() === 'true' || c.light === 1 || String(c.light).toLowerCase() === 'on';
    $('#cfg-body').innerHTML = `
    <div class="flex items-center gap-4"><div class="px text-4xl" style="width:72px;height:72px;flex:none;background:var(--grass);border:4px solid var(--ink);display:grid;place-items:center">${esc(String(c.drone_name || '?')[0])}</div>
    <div><div class="px text-2xl">${esc(c.drone_name)}</div><div class="opacity-70">Drone ID ${esc(c.drone_id)}</div></div></div>
    <div class="flex justify-between border-t-4 border-dashed pt-3" style="border-color:#d9c79a"><span>Light</span><span><i class="led" style="background:${on ? 'var(--gold)' : '#8b8b8b'};${on ? 'box-shadow:0 0 12px 4px #ffd16699' : ''}"></i> ${on ? 'เปิด' : 'ปิด'}</span></div>
    <div class="flex justify-between border-t-4 border-dashed pt-3" style="border-color:#d9c79a"><span>Country</span><b>${esc(c.country)}</b></div>`;
    $('#h-id').textContent = c.drone_id;
    $('#h-name').textContent = c.drone_name;
    $('#h-light').textContent = on ? 'เปิด' : 'ปิด';
    $('#f-who').textContent = `${c.drone_name} (${c.country})`;
    $('#l-who').textContent = `${c.drone_name} (#${c.drone_id})`;
    $('#drone-select').value = String(c.drone_id);
    $('#submit').disabled = false;
}

async function loadConfig() {
    $('#cfg-body').textContent = 'กำลังโหลด...';
    try {
        const c = unwrap(await api(`/configs/${droneId}`));
        memCfg = c;
        cfgs[String(c.drone_id)] = c;
        renderFleet();
        try { localStorage.setItem('droneConfig', JSON.stringify(c)); } catch { }
        renderConfig(c);
    } catch (e) {
        $('#cfg-body').innerHTML = `<p class="text-red-700">โหลดไม่สำเร็จ: ${esc(e.message)}<br>ตรวจ VITE_API_URL / VITE_DRONE_ID ในไฟล์ .env</p>`;
        $('#f-err').textContent = 'โหลด Config ของโดรนนี้ไม่สำเร็จ จึงยังส่งข้อมูลไม่ได้';
    }
}
$('#cfg-reload').onclick = loadConfig;

// ---------- Page 2: stepper, quick picks, thermometer ----------
const tf = $('#celsius'), gFill = $('#g-fill'), gLabel = $('#g-label');
function sync() {
    const v = tf.value.trim(), n = Number(v), ok = v !== '' && !Number.isNaN(n);
    gFill.style.height = ok ? `${Math.max(0, Math.min(100, (n / 50) * 100))}%` : '0%';
    gFill.style.background = !ok ? 'var(--grass)' : n < 15 ? '#6ec1ff' : n < 32 ? 'var(--grass)' : n < 40 ? '#ffb347' : '#ff6b5e';
    gLabel.textContent = ok ? `${n} °C` : '— °C';
    document.querySelectorAll('#chips .chip').forEach((b) => b.classList.toggle('on', ok && +b.dataset.v === n));
}
const nudge = (d) => {
    const v = tf.value.trim(), base = v === '' || Number.isNaN(Number(v)) ? 25 : Number(v);
    tf.value = String(Math.round((base + d) * 10) / 10);
    sync();
};
tf.addEventListener('input', sync);
$('#t-minus').onclick = () => nudge(-1);
$('#t-plus').onclick = () => nudge(1);
$('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (b) { tf.value = b.dataset.v; sync(); }
});
sync();

// ---------- Page 2: POST /logs ----------
$('#submit').onclick = async () => {
    const c = getConfig(), v = $('#celsius').value.trim(), err = $('#f-err');
    err.textContent = '';
    if (!c) return (err.textContent = 'ยังไม่มี Config กรุณาเปิดหน้า View Config ก่อน');
    if (v === '' || Number.isNaN(Number(v))) return (err.textContent = 'กรอกอุณหภูมิเป็นตัวเลข');
    try {
        $('#submit').disabled = true;
        await api('/logs', { method: 'POST', body: JSON.stringify({ drone_id: c.drone_id, drone_name: c.drone_name, country: c.country, celsius: Number(v) }) });
        $('#celsius').value = '';
        sync();
        toast('บันทึกสำเร็จ');
        logsPage = 1;
        loadLogs(true);
    } catch (e) {
        err.textContent = `ส่งไม่สำเร็จ: ${e.message}`;
    } finally {
        $('#submit').disabled = false;
    }
};

// ---------- Page 3: GET /logs/{id} + Responsive Pagination ----------
let pageSize = Number($('#page-size')?.value) || 6;
let logsAll = [], logsPage = 1;

const rowHtml = (l) => `<tr>
    <td data-label="Created">${esc(new Date(l.created_at || l.created).toLocaleString('th-TH'))}</td>
    <td data-label="Country">${esc(l.country)}</td>
    <td data-label="Drone ID">${esc(l.drone_id)}</td>
    <td data-label="Drone Name">${esc(l.drone_name)}</td>
    <td data-label="Celsius" class="text-right sm:text-left"><span class="temp-badge">${esc(l.celsius)} °C</span></td>
</tr>`;

function renderLogs() {
    const total = logsAll.length;
    const pages = Math.max(1, Math.ceil(total / pageSize));
    logsPage = Math.min(Math.max(1, logsPage), pages);
    const start = (logsPage - 1) * pageSize;
    const list = logsAll.slice(start, start + pageSize);

    $('#h-count').textContent = total;
    $('#rows').innerHTML = list.length
        ? list.map(rowHtml).join('')
        : '<tr><td colspan="5" class="empty-cell text-center p-6">ยังไม่มีข้อมูล ลองบันทึกอุณหภูมิที่หน้า Add Temperature Log</td></tr>';

    if (!total) {
        $('#pager').innerHTML = '';
        return;
    }

    const nums = [];
    for (let p = 1; p <= pages; p++) {
        if (p === 1 || p === pages || Math.abs(p - logsPage) <= 1) nums.push(p);
        else if (nums[nums.length - 1] !== '…') nums.push('…');
    }

    const btn = (p, label, off, on, aria) =>
        `<button type="button" class="btn chip${on ? ' on' : ''}" data-p="${p}" ${off ? 'disabled' : ''} ${on ? 'aria-current="page"' : ''} ${aria ? `aria-label="${aria}"` : ''}>${label}</button>`;

    $('#pager').innerHTML = `
        <span class="pager-info">แสดง <b>${start + 1}–${start + list.length}</b> จาก <b>${total}</b> รายการ (หน้า ${logsPage}/${pages})</span>
        <div class="pager-btns">
            ${btn(1, '«', logsPage === 1, false, 'หน้าแรก')}
            ${btn(logsPage - 1, 'ก่อนหน้า', logsPage === 1, false, 'หน้าก่อนหน้า')}
            ${nums.map((p) => (p === '…' ? '<span class="pager-dots px">…</span>' : btn(p, p, false, p === logsPage, `หน้า ${p}`))).join('')}
            ${btn(logsPage + 1, 'ถัดไป', logsPage === pages, false, 'หน้าถัดไป')}
            ${btn(pages, '»', logsPage === pages, false, 'หน้าสุดท้าย')}
        </div>`;
}

async function loadLogs(silent) {
    try {
        const raw = unwrap(await api(`/logs/${droneId}`));
        logsAll = (Array.isArray(raw) ? raw : raw.items || []).sort((a, b) => new Date(b.created_at || b.created) - new Date(a.created_at || a.created));
        renderLogs();
    } catch (e) {
        if (!silent) toast(`โหลด logs ไม่สำเร็จ: ${e.message}`, true);
    }
}

$('#pager').addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]');
    if (b && !b.disabled) {
        logsPage = +b.dataset.p;
        renderLogs();
    }
});

const pageSizeEl = $('#page-size');
if (pageSizeEl) {
    pageSizeEl.onchange = () => {
        pageSize = Number(pageSizeEl.value) || 6;
        logsPage = 1;
        renderLogs();
    };
}

$('#refresh').onclick = () => loadLogs();

// ---------- Minecraft scenery (ไม่มีผึ้งบินลอยผ่านทุกหน้าแล้ว) ----------
function terrain(color, base, amp, seed, z) {
    const W = 64, step = 20;
    let h = base, pts = '';
    for (let i = 0; i < W; i++) {
        h = Math.max(base - amp, Math.min(base + amp, h + (Math.sin(i * seed) * 1.6 | 0) * step));
        pts += `L${i * step},${h}L${(i + 1) * step},${h}`;
    }
    const el = document.createElement('div');
    el.className = 'layer';
    el.dataset.z = z;
    el.innerHTML = `<svg viewBox="0 0 ${W * step} 400" preserveAspectRatio="none" width="100%" height="${z * 55 + 120}"><path d="M0,400${pts}L${W * step},400Z" fill="${color}"/><path d="M0,${base}${pts}" fill="none" stroke="#ffc47a" stroke-opacity="${0.05 * z + 0.05}" stroke-width="5" vector-effect="non-scaling-stroke"/></svg>`;
    $('#sky').appendChild(el);
}
terrain('#6a3a7a', 150, 80, 0.7, 1);
terrain('#3f2a62', 190, 70, 1.3, 2);
terrain('#2c5a2f', 240, 50, 2.1, 3);
terrain('#1f3d22', 280, 40, 0.9, 4);

for (let i = 0; i < 40; i++) {
    const s = document.createElement('i');
    s.className = 'star';
    s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 35}%`;
    $('#sky').prepend(s);
}
for (let i = 0; i < 28; i++) {
    const m = document.createElement('i');
    m.className = 'mote';
    m.style.cssText = `left:${Math.random() * 100}%;top:${60 + Math.random() * 50}%;animation-duration:${9 + Math.random() * 12}s;animation-delay:-${Math.random() * 15}s`;
    $('#sky').appendChild(m);
}

// clouds, ground, tree, tulips (เอาผึ้งที่บินลอยข้ามทุกหน้าออกแล้ว)
const sky = $('#sky');
const cloud = (top, dur, delay, u, rows) => {
    const shadow = [], last = rows.length - 1;
    rows.forEach((r, y) => [...r.p].forEach((ch, x) => {
        if (ch === 'X' && !(y === last && x === 0)) shadow.push(`${x * u}px ${(y - last) * u}px ${r.c}`);
    }));
    sky.insertAdjacentHTML('beforeend', `<i class="cloud" style="top:${top}%;width:${u}px;height:${u}px;background:${rows[last].c};box-shadow:${shadow.join(',')};animation-duration:${dur}s;animation-delay:${delay}s"></i>`);
};
const P = [
    { p: '..XXXX..', c: '#fff0f6cc' },
    { p: '.XXXXXXX', c: '#ffd9ebbb' },
    { p: 'XXXXXXXX', c: '#f6b4d4aa' }
];
cloud(9, 150, -40, 20, P);
cloud(24, 190, -120, 14, P);
cloud(15, 230, -10, 10, P);
sky.insertAdjacentHTML('beforeend', '<div class="ground"></div>');

const prop = (src, css, z, cls = '') => sky.insertAdjacentHTML('beforeend', `<img class="prop ${cls}" data-z="${z}" src="images/${src}.png" alt="" aria-hidden="true" style="${css}">`);
prop('tree', 'left:-2%;bottom:28px;height:min(66vh,452px)', 3, 'big');
[[46, 52], [49, 78], [89, 78], [92, 52]].forEach(([x, h]) => prop('tulip', `left:${x}%;bottom:40px;height:${h}px`, 4));

addEventListener('mousemove', (e) => {
    const x = e.clientX / innerWidth - 0.5;
    document.querySelectorAll('.layer,.prop').forEach((l) => (l.style.transform = `translateX(${-x * l.dataset.z * 24}px)`));
});

// ---------- Drone picker (หน้า Add Temperature Log) ----------
const sel = $('#drone-select');
try {
    const s = localStorage.getItem('droneId');
    if (IDS.includes(s)) droneId = s;
} catch { }
sel.innerHTML = IDS.map((id) => `<option value="${esc(id)}">#${esc(id)}</option>`).join('');
sel.value = droneId;
$('#picker').classList.toggle('hidden', IDS.length < 2);

const cfgs = {};
function renderFleet() {
    if (IDS.length < 2) return;
    $('#fleet').classList.remove('hidden');
    $('#fleet-count').textContent = IDS.length;
    $('#fleet-grid').innerHTML = IDS.map((id) => {
        const c = cfgs[String(id)], on = String(id) === String(droneId);
        const lit = c && ['true', '1', 'on'].includes(String(c.light).toLowerCase());
        return `<button type="button" class="fleet-card${on ? ' on' : ''}" data-id="${esc(id)}" aria-pressed="${on}"><span class="fleet-av">${esc(String(c?.drone_name || '?')[0])}</span><span class="min-w-0"><b class="block">${esc(c?.drone_name || 'กำลังโหลด...')}</b><span class="block opacity-70 text-sm">#${esc(id)} · ${esc(c?.country || '-')}</span></span><span class="fleet-state">${on ? 'ใช้งานอยู่' : c ? (lit ? 'ไฟเปิด' : 'ไฟปิด') : ''}</span></button>`;
    }).join('');
}

function selectDrone(id) {
    if (String(id) === String(droneId)) return;
    droneId = String(id);
    memCfg = null;
    logsPage = 1;
    logsAll = [];
    try { localStorage.setItem('droneId', droneId); } catch { }
    sel.value = droneId;
    renderFleet();
    $('#f-who').textContent = 'กำลังโหลด...';
    $('#f-err').textContent = '';
    $('#submit').disabled = true;
    $('#cfg-body').textContent = 'กำลังโหลด...';
    $('#rows').innerHTML = '';
    $('#pager').innerHTML = '';
    loadConfig();
    loadLogs(true);
}
sel.onchange = () => selectDrone(sel.value);
$('#fleet-grid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (b) selectDrone(b.dataset.id);
});
if (IDS.length > 1) $('#cfg-card').classList.replace('max-w-lg', 'max-w-3xl');
IDS.forEach(async (id) => {
    try {
        const c = unwrap(await api(`/configs/${id}`));
        cfgs[String(id)] = c;
        const o = [...sel.options].find((x) => x.value === id);
        if (o) o.textContent = `${c.drone_name} (#${c.drone_id}) · ${c.country}`;
        renderFleet();
    } catch { }
});
renderFleet();

// ---------- Init ----------
const cached = getConfig();
if (cached) renderConfig(cached);
go(0);
loadConfig();
loadLogs(true);