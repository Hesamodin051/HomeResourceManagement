const STORAGE_KEY = 'home_inventory';
let inventory = [];
let crisisMode = false;

function loadData() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        inventory = JSON.parse(stored);
    } else {
        inventory = [
            { id: Date.now() + 1, name: 'آب آشامیدنی', quantity: 24, unit: 'لیتر', expiry: '2025-12-01' },
            { id: Date.now() + 2, name: 'برنج', quantity: 5, unit: 'کیلوگرم', expiry: '2025-10-15' },
            { id: Date.now() + 3, name: 'کنسرو لوبیا', quantity: 8, unit: 'عدد', expiry: '2026-01-20' },
            { id: Date.now() + 4, name: 'باتری قلمی', quantity: 12, unit: 'عدد', expiry: '' }
        ];
        saveData();
    }
    renderTable();
}

function saveData() {
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
    const newItem = {
        id: Date.now(),
        name: name,
        quantity: quantity,
        unit: unit,
        expiry: expiry || ''
    };
    inventory.push(newItem);
    saveData();
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
        saveData();
        renderTable();
    } else {
        alert('ورودی نامعتبر');
    }
}

function deleteItem(id) {
    if (confirm('آیا از حذف این قلم اطمینان دارید؟')) {
        inventory = inventory.filter(i => i.id !== id);
        saveData();
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
   var htmlString = '';
for (var i = 0; i < alerts.length; i++) {
    htmlString += '<div>' + alerts[i] + '</div>';
}
alertPanel.innerHTML = htmlString;
}

function setCrisisMode(active) {
    crisisMode = active;
    if (active) document.body.classList.add('crisis');
    else document.body.classList.remove('crisis');
    generateAlerts();
}

document.addEventListener('DOMContentLoaded', function() {
    const crisisToggle = document.getElementById('crisisModeToggle');
    const addBtn = document.getElementById('addBtn');
    
    loadData();
    
    const savedCrisis = localStorage.getItem('crisis_mode');
    if (savedCrisis === 'true' && crisisToggle) {
        crisisToggle.checked = true;
        setCrisisMode(true);
    } else {
        setCrisisMode(false);
    }
    
    if (crisisToggle) {
        crisisToggle.addEventListener('change', function(e) {
            setCrisisMode(e.target.checked);
            localStorage.setItem('crisis_mode', e.target.checked);
        });
    }
    
    if (addBtn) {
        addBtn.addEventListener('click', addItem);
    }
});
