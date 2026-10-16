// ข้อมูลโดรนตัวปัจจุบัน
const currentDrone = {
    drone_id: "FAIRY-001",
    drone_name: "Aurora Prime",
    country: "Wonderland"
};

// รายชื่อโดรนตัวอย่างในระบบ
const droneList = [
    { 
        drone_id: "FAIRY-001", 
        drone_name: "Aurora Prime", 
        light: "ON", 
        country: "Wonderland",
        image: "https://images.unsplash.com/photo-1579824228135-4309b4317fdb?auto=format&fit=crop&q=80&w=400&h=250"
    },
    { 
        drone_id: "FAIRY-002", 
        drone_name: "Crystal Glider", 
        light: "OFF", 
        country: "Neverland",
        image: "https://images.unsplash.com/photo-1541873676-a18131494184?auto=format&fit=crop&q=80&w=400&h=250"
    },
    { 
        drone_id: "FAIRY-003", 
        drone_name: "Starweaver", 
        light: "ON", 
        country: "Elvendale",
        image: "https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&q=80&w=400&h=250"
    }
];

// ข้อมูล Log ตัวอย่างในระบบ
let logsData = [
    { created: new Date().toLocaleString('en-GB'), country: "Wonderland", drone_id: "FAIRY-001", drone_name: "Aurora Prime", celsius: 24.5 },
    { created: new Date(Date.now() - 3600000).toLocaleString('en-GB'), country: "Neverland", drone_id: "FAIRY-002", drone_name: "Crystal Glider", celsius: 18.2 },
    { created: new Date(Date.now() - 7200000).toLocaleString('en-GB'), country: "Wonderland", drone_id: "FAIRY-001", drone_name: "Aurora Prime", celsius: 22.1 }
];

// ฟังก์ชันสลับการแสดงผลหน้าต่างๆ (Tab Navigation)
function showTab(tabName) {
    // ซ่อนทุก Section
    const sections = document.querySelectorAll('.tab-content');
    sections.forEach(sec => sec.classList.add('hidden'));

    // เอาสถานะ Active ออกจากปุ่มเมนูก่อนหน้า
    const buttons = document.querySelectorAll('.nav-btn');
    buttons.forEach(btn => btn.classList.remove('active'));

    // แสดง Section ที่เลือก
    const targetSection = document.getElementById('sec-' + tabName);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }

    // ใส่สถานะ Active ให้ปุ่มเมนูที่เลือก
    const targetButton = document.getElementById('btn-' + tabName);
    if (targetButton) {
        targetButton.classList.add('active');
    }

    // สั่งโหลดข้อมูลตามหน้าที่สลับไป
    if (tabName === 'config') {
        loadConfigs();
    } else if (tabName === 'logs') {
        loadLogs();
    }
}

// ฟังก์ชันโหลดข้อมูลการ์ดโดรน (View Config)
function loadConfigs() {
    const container = document.getElementById('config-container');
    container.innerHTML = ''; // ล้างข้อมูลเก่าก่อน

    droneList.forEach(drone => {
        const card = document.createElement('div');
        card.className = 'drone-card';
        card.innerHTML = `
            <img src="${drone.image}" alt="${drone.drone_name}">
            <div class="drone-info">
                <div class="drone-info-row">
                    <strong>Drone ID:</strong>
                    <span>${drone.drone_id}</span>
                </div>
                <div class="drone-info-row">
                    <strong>Name:</strong>
                    <span>${drone.drone_name}</span>
                </div>
                <div class="drone-info-row">
                    <strong>Origin:</strong>
                    <span>${drone.country}</span>
                </div>
                <div class="drone-info-row">
                    <strong>Light Status:</strong>
                    <span class="status-badge">${drone.light}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// ฟังก์ชันบันทึกค่าอุณหภูมิใหม่ (Record Temp)
function submitTemperature(event) {
    event.preventDefault(); // ป้องกันไม่ให้หน้าเว็บ Refresh

    const tempInput = document.getElementById('temp-input');
    const tempValue = parseFloat(tempInput.value);

    // สร้างข้อมูล Log ชุดใหม่
    const newLog = {
        created: new Date().toLocaleString('en-GB'),
        country: currentDrone.country,
        drone_id: currentDrone.drone_id,
        drone_name: currentDrone.drone_name,
        celsius: tempValue
    };

    // แทรก Log ใหม่เข้าไปที่ลำดับแรกสุด
    logsData.unshift(newLog);

    // ล้างค่าในช่องกรอก
    tempInput.value = '';

    // แสดงข้อความแจ้งเตือนบันทึกสำเร็จ
    const msg = document.getElementById('success-msg');
    msg.classList.remove('hidden');

    // ซ่อนข้อความแจ้งเตือนเมื่อผ่านไป 3 วินาที
    setTimeout(() => {
        msg.classList.add('hidden');
    }, 3000);
}

// ฟังก์ชันโหลดข้อมูลตารางประวัติ (View Logs)
function loadLogs() {
    const tbody = document.getElementById('logs-tbody');
    tbody.innerHTML = ''; // ล้างข้อมูลเก่าก่อน

    if (logsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No records found.</td></tr>';
        return;
    }

    logsData.forEach(log => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${log.created}</td>
            <td>${log.country}</td>
            <td><strong>${log.drone_id}</strong></td>
            <td>${log.drone_name}</td>
            <td style="font-weight:bold; color: ${log.celsius > 30 ? 'red' : '#8a3359'};">${log.celsius.toFixed(1)}°C</td>
        `;
        tbody.appendChild(row);
    });
}

// เริ่มต้นโหลดหน้า Home เมื่อเปิดเว็บขึ้นมา
window.onload = function() {
    showTab('home');
};