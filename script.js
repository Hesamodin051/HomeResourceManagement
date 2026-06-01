// ========== بخش قبلی: مدیریت ذخایر ==========
const STORAGE_KEY = 'home_inventory';
let inventory = [];
let crisisMode = false;

// ========== بخش جدید: مدیریت مصرف روزانه ==========
let consumptionData = {
    dates: [],
    water: [],
    electricity: [],
    gas: []
};
let chartInstance = null;

function loadConsumptionData() {
    const stored = localStorage.getItem('daily_consumption');
    if (stored) {
        consumptionData = JSON.parse(stored);
    } else {
        // داده نمونه برای ۷ روز اخیر (برای تست اولیه)
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toISOString().slice(0,10);
            consumptionData.dates.push(dateStr);
            consumptionData.water.push(Math.floor(Math.random() * 200 + 300));
            consumptionData.electricity.push(Math.floor(Math.random() * 15 + 20));
            consumptionData.gas.push(Math.floor(Math.random() * 10 + 15));
        }
        saveConsumptionData();
    }
    renderChart();
}

function saveConsumptionData() {
    localStorage.setItem('daily_consumption', JSON.stringify(consumptionData));
}

function saveTodayConsumption(water, electricity, gas) {
    const today = new Date().toISOString().slice(0,10);
    const index = consumptionData.dates.indexOf(today);
    if (index !== -1) {
        consumptionData.water[index] = water;
        consumptionData.electricity[index] = electricity;
        consumptionData.gas[index] = gas;
    } else {
        consumptionData.dates.push(today);
        consumptionData.water.push(water);
        consumptionData.electricity.push(electricity);
        consumptionData.gas.push(gas);
        if (consumptionData.dates.length > 7) {
            consumptionData.dates.shift();
            consumptionData.water.shift();
            consumptionData.electricity.shift();
            consumptionData.gas.shift();
        }
    }
    saveConsumptionData();
    renderChart();
}

function renderChart() {
    const ctx = document.getElementById('myChart');
    if (!ctx) return;
    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: consumptionData.dates,
            datasets: [
                { label: 'آب (لیتر)', data: consumptionData.water, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.3, fill: true },
                { label: 'برق (کیلووات)', data: consumptionData.electricity, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', tension: 0.3, fill: true },
                { label: 'گاز (مترمکعب)', data: consumptionData.gas, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', tension: 0.3, fill: true }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { position: 'top' } }
        }
    });
}

function bindConsumptionUI() {
    const saveBtn = document.getElementById('saveConsumptionBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const water = parseFloat(document.getElementById('waterConsumption').value);
            const elec = parseFloat(document.getElementById('electricityConsumption').value);
            const gas = parseFloat(document.getElementById('gasConsumption').value);
            if (isNaN(water) || isNaN(elec) || isNaN(gas)) {
                alert('لطفاً هر سه مقدار مصرف را وارد کنید.');
                return;
            }
            saveTodayConsumption(water, elec, gas);
            alert('مصرف امروز ذخیره شد.');
            document.getElementById('waterConsumption').value = '';
            document.getElementById('electricityConsumption').value = '';
            document.getElementById('gasConsumption').value = '';
        });
    }
}

// ========== توابع قبلی ==========
function loadInventory() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        inventory = JSON.parse(stored);
    } else {
        inventory = [
            { id: Date.now() + 1, name: 'آب آشامیدنی', quantity: 24, unit: 'لیتر', expiry: '2025-12-01' },
            { id: Date.now() + 2, name: 'برنج', quantity: 5, unit: 'کیلوگرم', expiry: '2025-10-15' },
            { id: Date.now() + 3, name: 'کنسرو لوبیا', quantity: 8, unit: 'عدد', expiry: '2026-01-20' }
        ];
        saveInventory();
    }
    renderTable();
}

function saveInventory() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
}

function renderTable() {
    const tbody = document.getElementById('inventoryBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    inventory.forEach(item => {
        const row = tbody.insertRow();
        row.insertCell(0).innerText = item.name;
        row.insertCell(1).innerText = item.quantity;
        row.insertCell(2).innerText = item.unit;
        row.insertCell(3).innerText = item.expiry || '—';
        const actionsCell = row.insertCell(4);
        const editBtn = document.createElement('button');
        editBtn.innerText = '✏️';
        editBtn.className = 'edit-btn';
        editBtn.onclick = () => editItem(item.id);
        const delBtn = document.createElement('button');
        delBtn.innerText = '🗑️';
        delBtn.className = 'delete-btn';
        delBtn.onclick = () => deleteItem(item.id);
        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(delBtn);
    });
    generateAlerts();
}

function addItem() {
    const nameInp = document.getElementById('itemName');
    const qtyInp = document.getElementById('itemQuantity');
    const unitInp = document.getElementById('itemUnit');
    const expiryInp = document.getElementById('itemExpiry');
    const name = nameInp.value.trim();
    const quantity = parseFloat(qtyInp.value);
    const unit = unitInp.value.trim();
    const expiry = expiryInp.value;
    if (!name || isNaN(quantity) || quantity <= 0 || !unit) {
        alert('لطفاً نام، مقدار معتبر و واحد را وارد کنید.');
        return;
    }
    const newItem = { id: Date.now(), name, quantity, unit, expiry: expiry || '' };
    inventory.push(newItem);
    saveInventory();
    renderTable();
    nameInp.value = '';
    qtyInp.value = '';
    unitInp.value = '';
    expiryInp.value = '';
}

function editItem(id) {
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    const newName = prompt('نام جدید:', item.name);
    const newQty = parseFloat(prompt('مقدار جدید:', item.quantity));
    const newUnit = prompt('واحد جدید:', item.unit);
    const newExpiry = prompt('تاریخ انقضا (YYYY-MM-DD):', item.expiry);
    if (newName && !isNaN(newQty) && newQty > 0 && newUnit) {
        item.name = newName.trim();
        item.quantity = newQty;
        item.unit = newUnit.trim();
        item.expiry = newExpiry || '';
        saveInventory();
        renderTable();
    } else alert('ورودی نامعتبر');
}

function deleteItem(id) {
    if (confirm('آیا از حذف این قلم اطمینان دارید؟')) {
        inventory = inventory.filter(i => i.id !== id);
        saveInventory();
        renderTable();
    }
}

function generateAlerts() {
    const alertPanel = document.getElementById('alertPanel');
    if (!alertPanel) return;
    const alerts = [];
    const familySize = 4;
    const waterItem = inventory.find(i => i.name.includes('آب'));
    if (waterItem) {
        const waterLiters = waterItem.quantity;
        const daysLeft = waterLiters / (familySize * 2);
        if (daysLeft < 1) alerts.push('🔴 بحرانی: آب کمتر از یک روز!');
        else if (daysLeft < 3) alerts.push('🟠 هشدار: آب تنها برای ' + Math.floor(daysLeft) + ' روز');
        else if (daysLeft < 7) alerts.push('🟡 توجه: آب کمتر از یک هفته');
    } else {
        alerts.push('⚠️ آب در لیست ذخایر ثبت نشده!');
    }
    if (crisisMode) {
        alerts.push('⚠️ حالت بحران فعال است. مصرف را به حداقل برسانید.');
    } else if (alerts.length === 0) {
        alerts.push('✅ وضعیت ذخایر مناسب است.');
    }
    alertPanel.innerHTML = alerts.map(a => `<div>${a}</div>`).join('');
}

function setCrisisMode(active) {
    crisisMode = active;
    if (active) document.body.classList.add('crisis');
    else document.body.classList.remove('crisis');
    generateAlerts();
}

function bindUI() {
    const crisisToggle = document.getElementById('crisisModeToggle');
    if (crisisToggle) {
        crisisToggle.addEventListener('change', (e) => {
            setCrisisMode(e.target.checked);
            localStorage.setItem('crisis_mode', e.target.checked);
        });
    }
    const addBtn = document.getElementById('addBtn');
    if (addBtn) addBtn.addEventListener('click', addItem);
}

document.addEventListener('DOMContentLoaded', () => {
    loadInventory();
    loadConsumptionData();   // بارگذاری داده مصرف و رسم نمودار
    bindUI();
    bindConsumptionUI();     // اتصال رویداد دکمه ذخیره مصرف
    const savedCrisis = localStorage.getItem('crisis_mode');
    const crisisToggle = document.getElementById('crisisModeToggle');
    if (savedCrisis === 'true' && crisisToggle) {
        crisisToggle.checked = true;
        setCrisisMode(true);
    } else setCrisisMode(false);
});
