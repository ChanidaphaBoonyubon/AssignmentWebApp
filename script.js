// ===== CONFIG: ต่อ API Server จริง (Assignment #1) =====
// ไม่มีข้อมูลสำรองในโค้ด ถ้าเชื่อมต่อ server ไม่ได้ จะแจ้งข้อผิดพลาดบนหน้าเว็บ
// เปิดในเครื่อง (localhost หรือดับเบิลคลิกไฟล์) จะต่อ server ในเครื่อง ถ้า deploy แล้วจะต่อ Render
const API_BASE = ['localhost', '127.0.0.1', ''].includes(location.hostname)
    ? 'http://localhost:3000'
    : 'https://assignmentwebapp-dvlr.onrender.com/';
const DRONE_ID = '67010174';
const PER = 12;      // รายการต่อหน้า (ตรงกับ server)
const MAX_C = 80;    // อุณหภูมิสูงสุดที่ส่งได้ (ต่ำสุดคือ 0)

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (c) => { const d = new Date(String(c).replace(' ', 'T')); return isNaN(d) ? String(c) : d.toLocaleString('th-TH'); };

// ---------- API ----------
async function call(path, opt) {
    let r;
    try { r = await fetch(`${API_BASE}${path}`, opt); }
    catch (e) { throw new Error('เชื่อมต่อ Server ไม่ได้ — ตรวจสอบว่า API Server เปิดอยู่'); }
    if (!r.ok) {
        let m = '';
        try { m = (await r.json()).error || ''; } catch (_) { }
        throw new Error(r.status === 404 ? 'ไม่พบข้อมูลโดรนนี้บน Server' : `Server ตอบกลับผิดพลาด (${r.status})${m ? ': ' + m : ''}`);
    }
    return r;
}
const api = {
    async getConfig() { return (await call(`/configs/${DRONE_ID}`)).json(); },
    async getLogs(p = 1) {
        const r = await call(`/logs/${DRONE_ID}?page=${p}`), d = await r.json();
        const tp = parseInt(r.headers.get('X-Total-Pages')), ti = parseInt(r.headers.get('X-Total-Items'));
        return { items: Array.isArray(d) ? d : [], totalPages: isNaN(tp) ? null : tp, totalItems: isNaN(ti) ? null : ti };
    },
    async postLog(b) { await call('/logs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); }
};

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
    if (i === 3) loadLogs(1);
    if (i === 1 && !config) loadConfig();
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

// ---------- Drone Profile: GET /configs/{id} ----------
let config = null;
function renderConfig(c) {
    const on = ['true', 'on', '1'].includes(String(c.light).toLowerCase());
    $('#cfg-body').innerHTML = `
    <div class="flex items-center gap-4"><div class="px text-4xl" style="width:72px;height:72px;flex:none;background:var(--grass);border:4px solid var(--ink);display:grid;place-items:center">${esc(String(c.drone_name || '?')[0])}</div>
    <div><div class="px text-2xl">${esc(c.drone_name)}</div><div class="opacity-70">Drone ID ${esc(c.drone_id)}</div></div></div>
    <div class="flex justify-between border-t-4 border-dashed pt-3" style="border-color:#d9c79a"><span>Light</span><span><i class="led" style="background:${on ? 'var(--gold)' : '#8b8b8b'};${on ? 'box-shadow:0 0 12px 4px #ffd16699' : ''}"></i> ${on ? 'เปิด' : 'ปิด'}</span></div>
    <div class="flex justify-between border-t-4 border-dashed pt-3" style="border-color:#d9c79a"><span>Country</span><b>${esc(c.country)}</b></div>`;
    $('#f-who').textContent = `${c.drone_name} (ID ${c.drone_id})`;
    $('#l-who').textContent = `${c.drone_name} (#${c.drone_id})`;
    $('#submit').disabled = false;
}
async function loadConfig() {
    $('#cfg-body').textContent = 'กำลังโหลด...';
    try {
        config = await api.getConfig();
        $('#f-err').textContent = '';
        renderConfig(config);
    } catch (e) {
        config = null;
        $('#cfg-body').innerHTML = `<p class="text-red-700">⚠️ ${esc(e.message)}</p>`;
        $('#f-err').textContent = 'โหลด Config ไม่สำเร็จ จึงยังส่งข้อมูลไม่ได้';
    }
}
$('#cfg-reload').onclick = loadConfig;

// ---------- Add Temperature Log (0 - 80 °C) ----------
const tf = $('#celsius'), gFill = $('#g-fill'), gLabel = $('#g-label');
const clamp = (n) => Math.min(MAX_C, Math.max(0, n));
function sync() {
    const v = tf.value.trim(), n = Number(v), ok = v !== '' && !Number.isNaN(n);
    gFill.style.height = ok ? `${clamp(n) / MAX_C * 100}%` : '0%';
    gFill.style.background = !ok ? 'var(--grass)' : n < 20 ? '#6ec1ff' : n < 40 ? 'var(--grass)' : n < 60 ? '#ffb347' : '#ff6b5e';
    gLabel.textContent = ok ? `${n} °C` : '— °C';
    document.querySelectorAll('#chips .chip').forEach((b) => b.classList.toggle('on', ok && +b.dataset.v === n));
}
const nudge = (d) => {
    const v = tf.value.trim(), base = v === '' || Number.isNaN(Number(v)) ? 25 : Number(v);
    tf.value = String(clamp(Math.round((base + d) * 10) / 10));
    $('#f-err').textContent = '';
    sync();
};
tf.addEventListener('keydown', (e) => { if (['-', '+', 'e', 'E'].includes(e.key)) e.preventDefault(); });
tf.addEventListener('input', () => {
    const n = parseFloat(tf.value), err = $('#f-err');
    if (!Number.isNaN(n) && n > MAX_C) { tf.value = MAX_C; err.textContent = `สูงสุด ${MAX_C} °C`; }
    else if (!Number.isNaN(n) && n < 0) { tf.value = 0; err.textContent = 'ต่ำสุด 0 °C'; }
    else err.textContent = '';
    sync();
});
$('#t-minus').onclick = () => nudge(-1);
$('#t-plus').onclick = () => nudge(1);
$('#chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (b) { tf.value = b.dataset.v; $('#f-err').textContent = ''; sync(); }
});
sync();

// POST /logs
$('#submit').onclick = async () => {
    const v = tf.value.trim(), err = $('#f-err');
    err.textContent = '';
    if (v === '' || Number.isNaN(Number(v))) return (err.textContent = 'กรอกอุณหภูมิเป็นตัวเลข');
    if (Number(v) < 0 || Number(v) > MAX_C) return (err.textContent = `ใส่ได้เฉพาะ 0 - ${MAX_C} °C`);
    if (!config) await loadConfig();
    if (!config) return (err.textContent = 'ยังโหลด Config ไม่สำเร็จ ลองใหม่อีกครั้ง');
    try {
        $('#submit').disabled = true;
        await api.postLog({ drone_id: Number(config.drone_id), drone_name: config.drone_name, country: config.country, celsius: Number(v) });
        tf.value = '';
        sync();
        toast('บันทึกสำเร็จ');
        setTimeout(() => go(3), 1000); // ไปหน้า Logs (go จะโหลดหน้า 1 ใหม่)
    } catch (e) {
        err.textContent = `ส่งไม่สำเร็จ: ${e.message}`;
    } finally {
        $('#submit').disabled = false;
    }
};

// ---------- View Logs: GET /logs/{id}?page=N (server แบ่งหน้าละ 12 รายการ) ----------
let logsRows = [], logsPage = 1, totalPages = 1, totalItems = null;
const rowHtml = (l) => `<tr>
    <td data-label="Created">${esc(fmtDate(l.created))}</td>
    <td data-label="Country">${esc(l.country)}</td>
    <td data-label="Drone ID">${esc(l.drone_id)}</td>
    <td data-label="Drone Name">${esc(l.drone_name)}</td>
    <td data-label="Celsius" class="text-right sm:text-left"><span class="temp-badge">${esc(l.celsius)} °C</span></td>
</tr>`;

function renderLogs() {
    const pages = Math.max(1, totalPages), start = (logsPage - 1) * PER;
    $('#rows').innerHTML = logsRows.length
        ? logsRows.map(rowHtml).join('')
        : '<tr><td colspan="5" class="empty-cell text-center p-6">ยังไม่มีข้อมูล ลองบันทึกอุณหภูมิที่หน้า Add Temperature Log</td></tr>';
    if (!logsRows.length) { $('#pager').innerHTML = ''; return; }
    const nums = [];
    for (let p = 1; p <= pages; p++) {
        if (p === 1 || p === pages || Math.abs(p - logsPage) <= 1) nums.push(p);
        else if (nums[nums.length - 1] !== '…') nums.push('…');
    }
    const btn = (p, label, off, on, aria) =>
        `<button type="button" class="btn chip${on ? ' on' : ''}" data-p="${p}" ${off ? 'disabled' : ''} ${on ? 'aria-current="page"' : ''} ${aria ? `aria-label="${aria}"` : ''}>${label}</button>`;
    const range = `<b>${start + 1}–${start + logsRows.length}</b>`;
    $('#pager').innerHTML = `
        <span class="pager-info">แสดง ${range}${totalItems !== null ? ` จาก <b>${totalItems}</b> รายการ` : ''} (หน้า ${logsPage}/${pages})</span>
        <div class="pager-btns">
            ${btn(1, '«', logsPage === 1, false, 'หน้าแรก')}
            ${btn(logsPage - 1, 'ก่อนหน้า', logsPage === 1, false, 'หน้าก่อนหน้า')}
            ${nums.map((p) => (p === '…' ? '<span class="pager-dots px">…</span>' : btn(p, p, false, p === logsPage, `หน้า ${p}`))).join('')}
            ${btn(logsPage + 1, 'ถัดไป', logsPage >= pages, false, 'หน้าถัดไป')}
            ${btn(pages, '»', logsPage >= pages, false, 'หน้าสุดท้าย')}
        </div>`;
}
async function loadLogs(p = 1, silent, last) {
    $('#rows').innerHTML = '<tr><td colspan="5" class="empty-cell text-center p-6">กำลังโหลด…</td></tr>';
    try {
        const d = await api.getLogs(p);
        if (!d.items.length && p > 1) {
            toast('ไม่มีข้อมูลหน้าถัดไปแล้ว');
            return loadLogs(p - 1, silent, true);
        }
        logsRows = d.items;
        logsPage = p;
        totalItems = d.totalItems;
        totalPages = last ? p : d.totalPages ?? (p + (d.items.length >= PER ? 1 : 0));
        renderLogs();
    } catch (e) {
        logsRows = [];
        $('#pager').innerHTML = '';
        $('#rows').innerHTML = `<tr><td colspan="5" class="text-center p-6 text-red-700">⚠️ ${esc(e.message)}</td></tr>`;
        if (!silent) toast(e.message, true);
    }
}
$('#pager').addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]');
    if (b && !b.disabled) loadLogs(+b.dataset.p);
});
$('#refresh').onclick = () => loadLogs(logsPage);

// ---------- Minecraft scenery ----------
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
    s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 45}%;opacity:${0.3 + Math.random() * 0.6}`;
    $('#sky').appendChild(s);
}
for (let i = 0; i < 14; i++) {
    const m = document.createElement('i');
    m.className = 'mote';
    m.style.cssText = `left:${Math.random() * 100}%;bottom:-20px;animation-duration:${9 + Math.random() * 10}s;animation-delay:-${Math.random() * 12}s`;
    $('#sky').appendChild(m);
}
const ground = document.createElement('div'); ground.className = 'ground'; $('#sky').appendChild(ground);
const tree = document.createElement('img');
tree.className = 'prop big'; tree.src = 'images/tree.png'; tree.alt = '';
tree.style.cssText = 'left:6%;bottom:36px;height:300px';
$('#sky').appendChild(tree);

// ---------- Init ----------
go(0);
$('#submit').disabled = true;
loadConfig();
loadLogs(1, true);
