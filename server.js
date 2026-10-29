require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors({ exposedHeaders: ['X-Page', 'X-Per-Page', 'X-Total-Items', 'X-Total-Pages'] }));
app.use(express.json());

const PORT = process.env.PORT || 3000;
const CONFIG_URL = (process.env.CONFIG_URL || '').trim();
const LOG_URL = (process.env.LOG_URL || '').trim();
const LOG_API_TOKEN = (process.env.LOG_API_TOKEN || '').trim();
const PER_PAGE = 12;

// Header สำหรับเรียก Drone Log Server (Bearer Token มาจาก .env เท่านั้น)
function logHeaders() {
  const h = { 'Content-Type': 'application/json' };
  if (LOG_API_TOKEN) {
    h.Authorization = LOG_API_TOKEN.startsWith('Bearer ') ? LOG_API_TOKEN : `Bearer ${LOG_API_TOKEN}`;
  }
  return h;
}

const isId = (v) => /^\d+$/.test(String(v));

// ดึงข้อมูลโดรนจาก Drone Config Server (รองรับ response เป็น array, {data:[...]} หรือ object เดี่ยว)
const idOf = (i) => (i && typeof i === 'object' ? (i.drone_id ?? i.droneId ?? i.id ?? i.DroneID) : undefined);

// หา "รายการโดรน" ใน response ของ Config Server ไม่ว่าจะเป็น array, {data:[...]}, หรือซ้อนหลายชั้น
function extractList(data) {
  const arrays = [];
  const objs = [];
  (function walk(v) {
    if (Array.isArray(v)) { arrays.push(v); v.forEach(walk); }
    else if (v && typeof v === 'object') {
      if (idOf(v) !== undefined) objs.push(v);
      Object.values(v).forEach(walk);
    }
  })(data);
  // เลือก array ที่ข้างในเป็นรายการโดรน (object ที่มี id) ไม่ใช่ array ของชื่อคอลัมน์ ฯลฯ
  const good = arrays.filter((a) => a.some((i) => i && typeof i === 'object' && !Array.isArray(i) && idOf(i) !== undefined));
  if (good.length) return good.sort((a, b) => b.length - a.length)[0];
  return objs;
}

async function loadDrone(droneId) {
  if (!CONFIG_URL) throw new Error('CONFIG_URL is not set in .env');
  const { data } = await axios.get(CONFIG_URL, { timeout: 15000 });
  const list = extractList(data);
  return { drone: list.find((i) => String(idOf(i)) === String(droneId)), list };
}

// ตอบ 404 พร้อมข้อมูลช่วยแก้ปัญหา ว่า Config Server ส่งอะไรกลับมา (ไม่มีข้อมูลปลอม)
function notFound(res, droneId, list) {
  console.warn(`Drone ${droneId} not found. Config server returned ${list.length} item(s). First item:`, JSON.stringify(list[0]));
  return res.status(404).json({
    error: `Drone ${droneId} not found`,
    items_from_config_server: list.length,
    sample_keys: list[0] && typeof list[0] === 'object' ? Object.keys(list[0]) : null,
    sample_ids: list.slice(0, 20).map(idOf)
  });
}

app.get('/', (req, res) => res.send('Drone API is running'));

// 1. GET /configs/:droneId
app.get('/configs/:droneId', async (req, res) => {
  const { droneId } = req.params;
  if (!isId(droneId)) return res.status(400).json({ error: 'droneId must be a number' });
  try {
    const { drone: d, list } = await loadDrone(droneId);
    if (!d) return notFound(res, droneId, list);
    res.json({
      drone_id: Number(idOf(d)),
      drone_name: d.drone_name,
      light: d.light,
      country: d.country,
      weight: Number(d.weight)
    });
  } catch (err) {
    console.error('Config fetch error:', err.message);
    res.status(502).json({ error: 'Cannot reach Drone Config Server', details: err.message });
  }
});

// 2. GET /status/:droneId
app.get('/status/:droneId', async (req, res) => {
  const { droneId } = req.params;
  if (!isId(droneId)) return res.status(400).json({ error: 'droneId must be a number' });
  try {
    const { drone: d, list } = await loadDrone(droneId);
    if (!d) return notFound(res, droneId, list);
    res.json({ condition: d.condition });
  } catch (err) {
    console.error('Status fetch error:', err.message);
    res.status(502).json({ error: 'Cannot reach Drone Config Server', details: err.message });
  }
});

// 3. GET /logs/:droneId?page=1  -> ล่าสุดก่อน หน้าละ 12 รายการ
app.get('/logs/:droneId', async (req, res) => {
  const { droneId } = req.params;
  if (!isId(droneId)) return res.status(400).json({ error: 'droneId must be a number' });
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  try {
    if (!LOG_URL) throw new Error('LOG_URL is not set in .env');
    const { data } = await axios.get(LOG_URL, {
      headers: logHeaders(),
      params: { page, perPage: PER_PAGE, sort: '-created', filter: `drone_id=${droneId}` },
      timeout: 15000
    });
    res.set({
      'X-Page': data.page,
      'X-Per-Page': data.perPage,
      'X-Total-Items': data.totalItems,
      'X-Total-Pages': data.totalPages
    });
    res.json(
      data.items.map(({ drone_id, drone_name, created, country, celsius }) => ({
        drone_id, drone_name, created, country, celsius
      }))
    );
  } catch (err) {
    console.error('Logs fetch error:', err.message);
    res.status(502).json({
      error: 'Failed to fetch drone logs',
      details: err.response ? err.response.data : err.message
    });
  }
});

// 4. POST /logs
app.post('/logs', async (req, res) => {
  const { drone_id, drone_name, country, celsius } = req.body || {};
  const id = Number(drone_id);
  const temp = Number(celsius);
  if (Number.isNaN(id) || Number.isNaN(temp) || !drone_name || !country) {
    return res.status(400).json({ error: 'drone_id, drone_name, country, celsius are required (ids/temps must be numbers)' });
  }
  try {
    if (!LOG_URL) throw new Error('LOG_URL is not set in .env');
    const { data } = await axios.post(
      LOG_URL,
      { drone_id: id, drone_name: String(drone_name), country: String(country), celsius: temp },
      { headers: logHeaders(), timeout: 15000 }
    );
    res.status(201).json(data);
  } catch (err) {
    console.error('Create log error:', err.message, err.response ? JSON.stringify(err.response.data) : '');
    res.status(502).json({
      error: 'Failed to create drone log',
      details: err.response ? err.response.data : err.message
    });
  }
});

app.listen(PORT, () => console.log(`API Server is running on port ${PORT}`));