// modules/food.js
import { getLoggedInUser } from './auth.js';
import { initDrawer, updateDrawerItems } from './drawer.js';
import { getAverageRating } from './feedback.js';

const STORAGE_CATEGORIES = 'food_categories';
const STORAGE_ITEMS = 'food_items';
const STORAGE_HISTORY = 'food_history';

let foodItems = [];
let categories = [];
let foodHistory = [];
let defaultFoodItems = [];

// ============================================================
// بارگذاری داده‌های پیش‌فرض از فایل JSON
// ============================================================
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

// ============================================================
// توابع مدیریت داده‌ها در localStorage
// ============================================================
function getUserKey(baseKey) {
    const user = getLoggedInUser() || 'default';
    return `${baseKey}_${user}`;
}

function getCategoriesKey() { return getUserKey(STORAGE_CATEGORIES); }
function getItemsKey() { return getUserKey(STORAGE_ITEMS); }
function getHistoryKey() { return getUserKey(STORAGE_HISTORY); }

function saveCategories() {
    localStorage.setItem(getCategoriesKey(), JSON.stringify(categories));
}

function saveItems() {
    localStorage.setItem(getItemsKey(), JSON.stringify(foodItems));
}

function saveHistory() {
    localStorage.setItem(getHistoryKey(), JSON.stringify(foodHistory));
}

// ============================================================
// بارگذاری داده‌ها از localStorage (یا ایجاد خالی)
// ============================================================
async function loadData() {
    const categoriesKey = getCategoriesKey();
    const itemsKey = getItemsKey();
    const historyKey = getHistoryKey();

    let storedCategories = localStorage.getItem(categoriesKey);
    let storedItems = localStorage.getItem(itemsKey);
    let storedHistory = localStorage.getItem(historyKey);

    if (storedCategories) {
        categories = JSON.parse(storedCategories);
    } else {
        categories = [];
        saveCategories();
    }

    foodItems = storedItems ? JSON.parse(storedItems) : [];
    foodHistory = storedHistory ? JSON.parse(storedHistory) : [];

    renderCategoryList();
    populateCategoryDropdown();
    renderTable();
    updateNameSuggestions();
}

// ============================================================
// تاریخچه تغییرات
// ============================================================
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

// ============================================================
// رندر دسته‌بندی‌ها
// ============================================================
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
    const category = document.getElementById('foodCategory')?.value;
    const datalist = document.getElementById('foodNamesList');
    if (!datalist || !category) {
        if (datalist) datalist.innerHTML = '';
        return;
    }
    const localNames = foodItems.filter(item => item.category === category).map(item => item.name);
    const defaultNames = defaultFoodItems.filter(item => item.category === category).map(item => item.name);
    const allNames = [...new Set([...localNames, ...defaultNames])];
    datalist.innerHTML = allNames.map(name => `<option value="${name}">`).join('');
}

// ============================================================
// رندر جدول مواد غذایی
// ============================================================
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
        return;
    }
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
        editBtn.className = 'edit-btn';
        editBtn.onclick = () => editItem(index);
        const delBtn = document.createElement('button');
        delBtn.innerText = '🗑️';
        delBtn.className = 'delete-btn';
        delBtn.onclick = () => deleteItem(index);
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);
    });
    updateShoppingSuggestions();
}

// ============================================================
// پیشنهاد خرید
// ============================================================
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

// ============================================================
// ویرایش و حذف
// ============================================================
let currentEditIndex = null;

function editItem(index) {
    const item = foodItems[index];
    if (!item) return;
    const catSelect = document.getElementById('foodCategory');
    const nameInput = document.getElementById('foodName');
    const qtyInput = document.getElementById('foodQty');
    const unitSelect = document.getElementById('foodUnit');
    const expiryInput = document.getElementById('foodExpiry');
    if (catSelect) catSelect.value = item.category;
    if (nameInput) nameInput.value = item.name;
    if (qtyInput) qtyInput.value = item.quantity;
    if (unitSelect) unitSelect.value = item.unit;
    if (expiryInput) expiryInput.value = item.expiry || '';
    currentEditIndex = index;
    updateNameSuggestions();
}

function deleteItem(index, silent = false) {
    const deleted = foodItems[index];
    foodItems.splice(index, 1);
    if (!silent && deleted) addToHistory('حذف', deleted);
    saveItems();
    if (currentEditIndex === index) currentEditIndex = null;
    renderTable();
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

// ============================================================
// تحلیل ارزش غذایی
// ============================================================
export function analyzeInventoryNutrition() {
    const inventory = foodItems;
    const defaultItems = defaultFoodItems;

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;
    const vitamins = {};

    inventory.forEach(item => {
        const defaultItem = defaultItems.find(i => i.name === item.name);
        if (defaultItem && defaultItem.nutrition) {
            const qty = item.quantity;
            const n = defaultItem.nutrition;
            totalCalories += (n.calories || 0) * qty;
            totalProtein += (n.protein || 0) * qty;
            totalCarbs += (n.carbs || 0) * qty;
            totalFat += (n.fat || 0) * qty;
            totalFiber += (n.fiber || 0) * qty;
            if (n.vitamins) {
                n.vitamins.forEach(v => {
                    if (!vitamins[v]) vitamins[v] = 0;
                    vitamins[v] += qty;
                });
            }
        }
    });

    return {
        calories: Math.round(totalCalories),
        protein: Math.round(totalProtein * 100) / 100,
        carbs: Math.round(totalCarbs * 100) / 100,
        fat: Math.round(totalFat * 100) / 100,
        fiber: Math.round(totalFiber * 100) / 100,
        vitamins
    };
}

// ============================================================
// راه‌اندازی اولیه
// ============================================================
function setupEventListeners() {
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    if (addCategoryBtn) {
        addCategoryBtn.addEventListener('click', () => {
            const newCat = document.getElementById('newCategoryName')?.value.trim();
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
            const input = document.getElementById('newCategoryName');
            if (input) input.value = '';
            alert(`دسته "${newCat}" اضافه شد.`);
        });
    }

    const saveFoodBtn = document.getElementById('saveFoodBtn');
    if (saveFoodBtn) {
        saveFoodBtn.addEventListener('click', () => {
            const category = document.getElementById('foodCategory')?.value;
            const name = document.getElementById('foodName')?.value?.trim();
            const qty = parseFloat(document.getElementById('foodQty')?.value);
            const unit = document.getElementById('foodUnit')?.value;
            const expiry = document.getElementById('foodExpiry')?.value;

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
            saveItems();
            renderTable();
            updateNameSuggestions();
            const clearBtn = document.getElementById('clearFormBtn');
            if (clearBtn) clearBtn.click();
        });
    }

    const clearFormBtn = document.getElementById('clearFormBtn');
    if (clearFormBtn) {
        clearFormBtn.addEventListener('click', () => {
            const catSelect = document.getElementById('foodCategory');
            const nameInput = document.getElementById('foodName');
            const qtyInput = document.getElementById('foodQty');
            const unitSelect = document.getElementById('foodUnit');
            const expiryInput = document.getElementById('foodExpiry');
            if (catSelect) catSelect.value = '';
            if (nameInput) nameInput.value = '';
            if (qtyInput) qtyInput.value = '';
            if (unitSelect) unitSelect.value = 'کیلوگرم';
            if (expiryInput) expiryInput.value = '';
            currentEditIndex = null;
            updateNameSuggestions();
        });
    }

    const resetBtn = document.getElementById('resetDataBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetOnlyFoodItems);
    }

    const historyBtn = document.getElementById('historyBtn');
    const modal = document.getElementById('historyModal');
    if (historyBtn && modal) {
        historyBtn.addEventListener('click', () => {
            const historyDiv = document.getElementById('historyList');
            if (historyDiv) {
                if (foodHistory.length === 0) historyDiv.innerHTML = '<p>هیچ تغییری ثبت نشده است.</p>';
                else {
                    historyDiv.innerHTML = '<ul>' + foodHistory.map(h => `<li><strong>${h.timestamp}</strong> - ${h.action} : ${h.name} (${h.quantity} ${h.unit}, دسته: ${h.category})</li>`).join('') + '</ul>';
                }
            }
            modal.style.display = 'flex';
        });
        const closeModal = modal.querySelector('.close-modal');
        if (closeModal) closeModal.addEventListener('click', () => modal.style.display = 'none');
        window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    }

    const categorySelect = document.getElementById('foodCategory');
    if (categorySelect) {
        categorySelect.addEventListener('change', updateNameSuggestions);
    }
}

// ============================================================
// مقداردهی اولیه
// ============================================================
async function init() {
    if (!getLoggedInUser()) {
        window.location.href = 'index.html';
        return;
    }
    initDrawer();
    updateDrawerItems();

    await loadDefaultFoodItems();
    await loadData();
    setupEventListeners();

    console.log('✅ صفحه مدیریت مواد غذایی بارگذاری شد.');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
