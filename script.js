// ---------- تنظیمات اولیه ----------
const STORAGE_KEY = 'home_inventory';
let inventory = [];
let crisisMode = false;
let familySize = 4;         // تعداد اعضای خانواده (پیش‌فرض)
let storageDays = 7;        // مدت ذخیره‌سازی بر حسب روز (3,7,30)

// داده‌های تخصصی (از JSON)
let foodData = [];
let healthData = [];
let scenarioData = [];
let alertMessages = [];

// ---------- توابع کمکی برای بارگذاری JSON ----------
async function loadJSON(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (error) {
        console.warn(`خطا در بارگذاری ${url}:`, error);
        return null; // در صورت خطا، داده خالی برگردان
    }
}

async function loadAllData() {
    foodData = await loadJSON('data/food_items.json') || [];
    healthData = await loadJSON('data/health_medication_items.json') || [];
    scenarioData = await loadJSON('data/crisis_scenarios.json') || [];
    alertMessages = await loadJSON('data/alert_messages.json') || [];
    generateAlerts(); // بعد از بارگذاری، هشدارها را به‌روز کن
}

// ---------- توابع مدیریت ذخایر (مثل قبل) ----------
function loadInventory() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        inventory = JSON.parse(stored);
    } else {
        // داده پیش‌فرض (می‌توانید نمونه بگذارید)
        inventory = [
            { id: Date.now()+1, name: 'آب آشامیدنی', quantity: 24, unit: 'لیتر', expiry: '' },
            { id: Date.now()+2, name: 'برنج', quantity: 5, unit: 'کیلوگرم', expiry: '' }
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
    generateAlerts(); // هر بار تغییر، هشدارها به‌روز شوند
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

// ---------- تولید هشدارهای هوشمند (بر اساس JSON) ----------
function generateAlerts() {
    const alertPanel = document.getElementById('alertPanel');
    if (!alertPanel) return;
    const alerts = [];

    // 1. هشدار کمبود آب (از فایل غذایی)
    const waterItem = inventory.find(i => i.name.includes('آب'));
    if (waterItem) {
        const waterLiters = waterItem.quantity;
        const needPerDay = familySize * 2; // فرض هر نفر ۲ لیتر در روز
        const daysLeft = waterLiters / needPerDay;
        if (daysLeft < 1) alerts.push({ type: 'water_shortage', message: '🔴 آب کمتر از یک روز باقی است! مصرف را فوری کاهش دهید.' });
        else if (daysLeft < 3) alerts.push({ type: 'water_shortage', message: `🟠 آب تنها برای ${Math.floor(daysLeft)} روز باقی است.` });
    } else alerts.push({ type: 'water_shortage', message: '⚠️ آب در لیست ذخایر ثبت نشده!' });

    // 2. هشدار از فایل alert_messages.json (نمونه)
    if (alertMessages.length > 0 && crisisMode) {
        const crisisMsg = alertMessages.find(m => m.type === 'crisis_mode_active');
        if (crisisMsg) alerts.push({ type: crisisMsg.type, message: crisisMsg.message });
    }

    // 3. اگر حالت بحران فعال است، اولویت‌بندی از سناریوها
    if (crisisMode && scenarioData.length > 0) {
        const scenario = scenarioData[0]; // برای سادگی، اولین سناریو را بگیر
        alerts.push({ type: 'scenario_tip', message: `📌 ${scenario.tip}` });
        alerts.push({ type: 'priority', message: `اولویت منابع در این بحران: ${scenario.priority_resources.join(' → ')}` });
    } else if (!crisisMode && alerts.length === 0) {
        alerts.push({ type: 'normal', message: '✅ وضعیت ذخایر مناسب است. به پایش ادامه دهید.' });
    }

    // نمایش در پنل
    alertPanel.innerHTML = alerts.map(a => `<div>${a.message}</div>`).join('');
}

// ---------- مدیریت حالت بحران ----------
function setCrisisMode(active) {
    crisisMode = active;
    if (active) document.body.classList.add('crisis');
    else document.body.classList.remove('crisis');
    generateAlerts();
}

// ---------- دریافت مقادیر از UI ----------
function bindUI() {
    const crisisToggle = document.getElementById('crisisModeToggle');
    if (crisisToggle) {
        crisisToggle.addEventListener('change', (e) => setCrisisMode(e.target.checked));
    }
    const addBtn = document.getElementById('addBtn');
    if (addBtn) addBtn.addEventListener('click', addItem);
    // می‌توانید فیلدهای تعداد اعضا و مدت ذخیره‌سازی را نیز اضافه کنید
}

// ---------- راه‌اندازی اولیه ----------
document.addEventListener('DOMContentLoaded', async () => {
    loadInventory();
    await loadAllData();    // بارگذاری فایل‌های JSON
    bindUI();
    // بازیابی وضعیت بحران از localStorage
    const savedCrisis = localStorage.getItem('crisis_mode');
    const crisisToggle = document.getElementById('crisisModeToggle');
    if (savedCrisis === 'true' && crisisToggle) {
        crisisToggle.checked = true;
        setCrisisMode(true);
    } else setCrisisMode(false);
    if (crisisToggle) {
        crisisToggle.addEventListener('change', (e) => localStorage.setItem('crisis_mode', e.target.checked));
    }
});
