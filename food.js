import { getLoggedInUser } from './modules/auth.js';
import { initDrawer, updateDrawerItems } from './drawer.js';

const STORAGE_CATEGORIES = 'food_categories';
const STORAGE_ITEMS = 'food_items';
const STORAGE_HISTORY = 'food_history';

let foodItems = [];
let categories = [];
let foodHistory = [];

let defaultFoodItems = [];

async function loadDefaultFoodItems() {
    if (defaultFoodItems.length > 0) return defaultFoodItems;
    try {
        const response = await fetch('assets/data/food_items.json');
        const data = await response.json();
        defaultFoodItems = data;
        return data;
    } catch (error) {
        console.error('خطا در بارگذاری food_items.json:', error);
        return [];
    }
}

async function loadDefaultCategories() {
    const data = await loadDefaultFoodItems();
    const uniqueCats = [...new Set(data.map(item => item.category))];
    return uniqueCats;
}

async function loadData() {
    let storedCategories = localStorage.getItem(STORAGE_CATEGORIES);
    let storedItems = localStorage.getItem(STORAGE_ITEMS);
    let storedHistory = localStorage.getItem(STORAGE_HISTORY);

    if (storedCategories) {
        categories = JSON.parse(storedCategories);
    } else {
        categories = await loadDefaultCategories();
        saveCategories();
    }

    foodItems = storedItems ? JSON.parse(storedItems) : [];
    foodHistory = storedHistory ? JSON.parse(storedHistory) : [];

    renderCategoryList();
    populateCategoryDropdown();
    renderTable();
    updateNameSuggestions();
}

function saveCategories() {
    localStorage.setItem(STORAGE_CATEGORIES, JSON.stringify(categories));
}

function saveItems() {
    localStorage.setItem(STORAGE_ITEMS, JSON.stringify(foodItems));
}

function saveHistory() {
    localStorage.setItem(STORAGE_HISTORY, JSON.stringify(foodHistory));
}

function addToHistory(action, item) {
    const historyEntry = {
        timestamp: new Date().toLocaleString('fa-IR'),
        action,
        category: item.category,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        expiry: item.expiry || 'بدون تاریخ'
    };
    foodHistory.unshift(historyEntry);
    saveHistory();
}

function renderCategoryList() {
    const container = document.getElementById('categoryList');
    if (!container) return;
    if (categories.length === 0) {
        container.innerHTML = '<span style="color: gray;">هنوز دسته‌ای اضافه نشده است.</span>';
        return;
    }
    container.innerHTML = categories.map(cat => `<span class="category-tag">${cat}</span>`).join('');
}

function populateCategoryDropdown() {
    const select = document.getElementById('foodCategory');
    if (!select) return;
    select.innerHTML = '<option value="">-- انتخاب دسته --</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        select.appendChild(option);
    });
}

function updateNameSuggestions() {
    const category = document.getElementById('foodCategory').value;
    const datalist = document.getElementById('foodNamesList');
    if (!datalist) return;
    if (!category) {
        datalist.innerHTML = '';
        return;
    }
    const localNames = foodItems.filter(item => item.category === category).map(item => item.name);
    const defaultNames = defaultFoodItems.filter(item => item.category === category).map(item => item.name);
    const allNames = [...new Set([...localNames, ...defaultNames])];
    datalist.innerHTML = allNames.map(name => `<option value="${name}">`).join('');
}

function renderTable() {
    const tbody = document.getElementById('foodTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (foodItems.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell(0);
        cell.colSpan = 6;
        cell.textContent = 'هیچ ماده غذایی ثبت نشده است. لطفاً ماده غذایی جدید اضافه کنید.';
        cell.style.textAlign = 'center';
    } else {
        foodItems.forEach((item, index) => {
            const row = tbody.insertRow();
            row.insertCell(0).innerText = item.category;
            row.insertCell(1).innerText = item.name;
            row.insertCell(2).innerText = item.quantity;
            row.insertCell(3).innerText = item.unit;
            row.insertCell(4).innerText = item.expiry || '—';
            const actions = row.insertCell(5);
            const editBtn = document.createElement('button');
            editBtn.innerText = '✏️';
            editBtn.onclick = () => editItem(index);
            const delBtn = document.createElement('button');
            delBtn.innerText = '🗑️';
            delBtn.onclick = () => deleteItem(index);
            actions.appendChild(editBtn);
            actions.appendChild(delBtn);
        });
    }
    updateShoppingSuggestions();
}

function updateShoppingSuggestions() {
    const container = document.getElementById('shoppingSuggestions');
    if (!container) return;
    const lowStockItems = foodItems.filter(item => item.quantity < 2);
    if (lowStockItems.length === 0) {
        container.innerHTML = '<p>✅ همه اقلام به اندازه کافی موجود هستند.</p>';
        return;
    }
    const suggestions = lowStockItems.map(item => 
        `<div>🔴 ${item.name} (${item.category}) – فقط ${item.quantity} ${item.unit} باقی مانده است. پیشنهاد خرید حداقل ۲ واحد.</div>`
    ).join('');
    container.innerHTML = `<div class="suggestion-list">${suggestions}</div>`;
}

let currentEditIndex = null;
function editItem(index) {
    const item = foodItems[index];
    document.getElementById('foodCategory').value = item.category;
    document.getElementById('foodName').value = item.name;
    document.getElementById('foodQty').value = item.quantity;
    document.getElementById('foodUnit').value = item.unit;
    document.getElementById('foodExpiry').value = item.expiry || '';
    currentEditIndex = index;
    updateNameSuggestions();
}

function deleteItem(index, silent = false) {
    const deleted = foodItems[index];
    foodItems.splice(index, 1);
    if (!silent) addToHistory('حذف', deleted);
    renderTable();
    saveItems();
    if (currentEditIndex === index) currentEditIndex = null;
    updateNameSuggestions();
}

function resetOnlyFoodItems() {
    if (confirm('آیا مطمئن هستید؟ تمام مواد غذایی ثبت شده و تاریخچه حذف خواهند شد، اما دسته‌بندی‌ها باقی می‌مانند.')) {
        foodItems = [];
        foodHistory = [];
        saveItems();
        saveHistory();
        renderTable();
        updateNameSuggestions();
        alert('تمام مواد غذایی و تاریخچه پاک شدند.');
    }
}

function addResetButton() {
    const foodListTitle = document.getElementById('foodListTitle');
    if (foodListTitle && !document.getElementById('resetDataBtn')) {
        const resetBtn = document.createElement('button');
        resetBtn.id = 'resetDataBtn';
        resetBtn.textContent = '🗑️ پاک کردن مواد غذایی (ریست)';
        resetBtn.style.background = '#dc2626';
        resetBtn.style.marginRight = '1rem';
        resetBtn.style.padding = '0.3rem 0.8rem';
        resetBtn.style.borderRadius = '2rem';
        resetBtn.style.fontSize = '0.8rem';
        resetBtn.onclick = resetOnlyFoodItems;
        foodListTitle.appendChild(resetBtn);
    }
}

// ---------- تابع جستجو بر اساس بارکد ----------
function searchByBarcode(barcode) {
    const foundItem = defaultFoodItems.find(item => item.barcode === barcode);
    if (foundItem) {
        document.getElementById('foodCategory').value = foundItem.category;
        document.getElementById('foodName').value = foundItem.name;
        document.getElementById('foodUnit').value = foundItem.unit;
        document.getElementById('foodQty').focus();
        alert(`محصول "${foundItem.name}" یافت شد! لطفاً مقدار را وارد کنید.`);
    } else {
        alert(`کد "${barcode}" در پایگاه داده یافت نشد. لطفاً اطلاعات را دستی وارد کنید.`);
        document.getElementById('foodName').focus();
    }
}

// ---------- راه‌اندازی اسکنر بارکد با BarcodeDetector ----------
function setupBarcodeScanner() {
    const startBtn = document.getElementById('startBarcodeScannerBtn');
    const scannerContainer = document.getElementById('barcodeScannerContainer');
    const closeBtn = document.getElementById('closeScannerBtn');
    const scanResultPara = document.getElementById('scanResult');
    const scannerVideo = document.getElementById('scannerVideo');

    if (!startBtn || !scannerContainer || !scannerVideo) {
        console.warn('المان‌های اسکنر پیدا نشدند.');
        return;
    }

    let stream = null;
    let videoElement = null;
    let scanningInterval = null;

    const stopScanner = () => {
        if (scanningInterval) {
            clearInterval(scanningInterval);
            scanningInterval = null;
        }
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        if (videoElement && videoElement.srcObject) {
            videoElement.srcObject = null;
        }
        if (scannerVideo) scannerVideo.innerHTML = '';
        if (scanResultPara) scanResultPara.innerText = '';
        scannerContainer.style.display = 'none';
    };

    startBtn.addEventListener('click', async () => {
        stopScanner(); // بستن اسکنر قبلی
        scannerContainer.style.display = 'block';

        try {
            // درخواست دسترسی به دوربین عقب
            stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            videoElement = document.createElement('video');
            videoElement.srcObject = stream;
            videoElement.setAttribute('playsinline', '');
            videoElement.style.width = '100%';
            videoElement.style.maxWidth = '500px';
            scannerVideo.innerHTML = '';
            scannerVideo.appendChild(videoElement);
            await videoElement.play();

            // بررسی پشتیبانی از BarcodeDetector
            if (!window.BarcodeDetector) {
                alert('مرورگر شما از اسکن بارکد پشتیبانی نمی‌کند. لطفاً از نسخه جدید کروم، اج یا سافاری استفاده کنید.');
                stopScanner();
                return;
            }
            const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e'] });
            
            // اسکن هر 500 میلی‌ثانیه
            scanningInterval = setInterval(async () => {
                if (!videoElement || videoElement.paused || videoElement.ended) return;
                try {
                    const barcodes = await detector.detect(videoElement);
                    if (barcodes.length > 0) {
                        const scannedCode = barcodes[0].rawValue;
                        if (scanResultPara) scanResultPara.innerText = `کد اسکن شده: ${scannedCode}`;
                        searchByBarcode(scannedCode);
                        stopScanner();
                    }
                } catch (err) {
                    console.warn('خطا در تشخیص بارکد:', err);
                }
            }, 500);
            
        } catch (err) {
            console.error('خطا در دسترسی به دوربین:', err);
            alert('اجازه دسترسی به دوربین داده نشد یا دوربین در دسترس نیست.');
            stopScanner();
        }
    });

    if (closeBtn) {
        closeBtn.addEventListener('click', stopScanner);
    }
}

// ---------- رویدادهای فرم ----------
document.getElementById('addCategoryBtn').addEventListener('click', () => {
    const newCat = document.getElementById('newCategoryName').value.trim();
    if (!newCat) {
        alert('لطفاً نام دسته را وارد کنید.');
        return;
    }
    if (categories.includes(newCat)) {
        alert('این دسته قبلاً وجود دارد.');
        return;
    }
    categories.push(newCat);
    saveCategories();
    renderCategoryList();
    populateCategoryDropdown();
    document.getElementById('newCategoryName').value = '';
    alert(`دسته "${newCat}" اضافه شد.`);
});

document.getElementById('saveFoodBtn').addEventListener('click', () => {
    const category = document.getElementById('foodCategory').value;
    let name = document.getElementById('foodName').value.trim();
    const qty = parseFloat(document.getElementById('foodQty').value);
    const unit = document.getElementById('foodUnit').value;
    const expiry = document.getElementById('foodExpiry').value;

    if (!category) { alert('لطفاً دسته را انتخاب کنید.'); return; }
    if (!name || isNaN(qty) || qty <= 0 || !unit) { alert('نام، مقدار معتبر و واحد را وارد کنید.'); return; }

    const newItem = { id: Date.now(), name, quantity: qty, unit, expiry, category };
    if (currentEditIndex !== null) {
        const oldItem = foodItems[currentEditIndex];
        foodItems[currentEditIndex] = newItem;
        addToHistory('ویرایش', { ...oldItem, ...newItem, note: `به ${newItem.name} تغییر یافت` });
        currentEditIndex = null;
    } else {
        foodItems.push(newItem);
        addToHistory('افزودن', newItem);
    }
    renderTable();
    saveItems();
    updateNameSuggestions();
    document.getElementById('clearFormBtn').click();
});

document.getElementById('clearFormBtn').addEventListener('click', () => {
    document.getElementById('foodCategory').value = '';
    document.getElementById('foodName').value = '';
    document.getElementById('foodQty').value = '';
    document.getElementById('foodUnit').value = 'کیلوگرم';
    document.getElementById('foodExpiry').value = '';
    currentEditIndex = null;
    updateNameSuggestions();
});

// تاریخچه
const modal = document.getElementById('historyModal');
document.getElementById('historyBtn').addEventListener('click', () => {
    const historyDiv = document.getElementById('historyList');
    if (foodHistory.length === 0) historyDiv.innerHTML = '<p>هیچ تغییری ثبت نشده است.</p>';
    else {
        historyDiv.innerHTML = '<ul>' + foodHistory.map(h => `<li><strong>${h.timestamp}</strong> - ${h.action} : ${h.name} (${h.quantity} ${h.unit}, دسته: ${h.category})</li>`).join('') + '</ul>';
    }
    modal.style.display = 'flex';
});
document.querySelector('.close-modal').addEventListener('click', () => modal.style.display = 'none');
window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

// راه‌اندازی اولیه
async function init() {
    await loadDefaultFoodItems();
    if (!getLoggedInUser()) window.location.href = 'index.html';
    initDrawer();
    updateDrawerItems();
    await loadData();
    addResetButton();
    setupBarcodeScanner(); // راه‌اندازی اسکنر
    document.getElementById('foodCategory').addEventListener('change', () => updateNameSuggestions());
}

