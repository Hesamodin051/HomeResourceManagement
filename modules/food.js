// modules/food.js
import { getLoggedInUser } from './auth.js';
import { initDrawer, updateDrawerItems } from './drawer.js';
import { store, setInventory } from './store.js';

// ===== کلیدهای ذخیره‌سازی در localStorage =====
function getInventoryKey() {
    const user = getLoggedInUser() || 'default';
    return `home_inventory_${user}`;
}

function getCategoriesKey() {
    const user = getLoggedInUser() || 'default';
    return `food_categories_${user}`;
}

function getHistoryKey() {
    const user = getLoggedInUser() || 'default';
    return `food_history_${user}`;
}

// ===== دسته‌بندی‌های پیش‌فرض =====
const DEFAULT_CATEGORIES = [
    'غلات', 'حبوبات', 'لبنیات', 'پروتئین', 
    'سبزیجات', 'میوه‌ها', 'چاشنی‌ها', 'نان', 
    'نوشیدنی', 'سایر'
];

let foodItems = [];
let categories = [];
let foodHistory = [];
let currentEditIndex = null;
let nutritionDataCache = [];

// ============================================================
// مدیریت دسته‌بندی‌ها در localStorage
// ============================================================
function loadCategories() {
    const key = getCategoriesKey();
    const stored = localStorage.getItem(key);
    if (stored) {
        categories = JSON.parse(stored);
    } else {
        categories = [...DEFAULT_CATEGORIES];
        localStorage.setItem(key, JSON.stringify(categories));
    }
    return categories;
}

function saveCategories() {
    const key = getCategoriesKey();
    localStorage.setItem(key, JSON.stringify(categories));
}

// ============================================================
// مدیریت تاریخچه در localStorage
// ============================================================
function loadHistory() {
    const key = getHistoryKey();
    const stored = localStorage.getItem(key);
    foodHistory = stored ? JSON.parse(stored) : [];
    return foodHistory;
}

function saveHistory() {
    const key = getHistoryKey();
    localStorage.setItem(key, JSON.stringify(foodHistory));
}

function addToHistory(action, item) {
    const entry = {
        timestamp: new Date().toLocaleString('fa-IR'),
        action,
        category: item.category || 'سایر',
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        expiry: item.expiry || 'بدون تاریخ'
    };
    foodHistory.unshift(entry);
    if (foodHistory.length > 100) foodHistory.pop();
    saveHistory();
}

// ============================================================
// مدیریت مواد غذایی در localStorage
// ============================================================
function loadFoodItems() {
    const key = getInventoryKey();
    const stored = localStorage.getItem(key);
    foodItems = stored ? JSON.parse(stored) : [];
    setInventory(foodItems);
    return foodItems;
}

function saveFoodItems() {
    const key = getInventoryKey();
    localStorage.setItem(key, JSON.stringify(foodItems));
    setInventory(foodItems);
    console.log('✅ مواد غذایی ذخیره شدند. تعداد:', foodItems.length);
}

// ============================================================
// بارگذاری داده‌های تغذیه‌ای از food_items.json
// ============================================================
async function loadNutritionData() {
    const cached = localStorage.getItem('food_nutrition_cache');
    if (cached) {
        try {
            nutritionDataCache = JSON.parse(cached);
            if (nutritionDataCache.length > 0) return nutritionDataCache;
        } catch (e) {}
    }
    try {
        const response = await fetch('assets/data/food_items.json');
        const data = await response.json();
        nutritionDataCache = data;
        localStorage.setItem('food_nutrition_cache', JSON.stringify(data));
        return data;
    } catch (error) {
        console.warn('⚠️ خطا در بارگذاری food_items.json:', error);
        return [];
    }
}

// ============================================================
// تحلیل ارزش غذایی (با استفاده از store.inventory)
// ============================================================
export async function analyzeInventoryNutrition() {
    const inventory = store.inventory || [];
    if (!inventory || inventory.length === 0) {
        return {
            calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0,
            vitamins: {}, deficiencies: [], suggestions: [],
            status: 'empty', message: 'هیچ ماده غذایی ثبت نشده است.'
        };
    }

    const nutritionData = await loadNutritionData();
    const dailyNeeds = { calories: 2000, protein: 50, carbs: 250, fat: 70, fiber: 25 };
    const familySize = store.currentUserProfile?.familySize || 4;

    let totalCalories = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0, totalFiber = 0;
    const vitamins = {};

    inventory.forEach(item => {
        const defaultItem = nutritionData.find(n => n.name === item.name);
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

    const familyNeeds = {
        calories: dailyNeeds.calories * familySize,
        protein: dailyNeeds.protein * familySize,
        carbs: dailyNeeds.carbs * familySize,
        fat: dailyNeeds.fat * familySize,
        fiber: dailyNeeds.fiber * familySize
    };

    const percentages = {
        calories: Math.round((totalCalories / familyNeeds.calories) * 100),
        protein: Math.round((totalProtein / familyNeeds.protein) * 100),
        carbs: Math.round((totalCarbs / familyNeeds.carbs) * 100),
        fat: Math.round((totalFat / familyNeeds.fat) * 100),
        fiber: Math.round((totalFiber / familyNeeds.fiber) * 100)
    };

    const deficiencies = [];
    const suggestions = [];
    if (percentages.calories < 70) deficiencies.push('کالری');
    if (percentages.protein < 70) deficiencies.push('پروتئین');
    if (percentages.carbs < 70) deficiencies.push('کربوهیدرات');
    if (percentages.fat < 70) deficiencies.push('چربی');
    if (percentages.fiber < 70) deficiencies.push('فیبر');

    if (deficiencies.length > 0) {
        suggestions.push('🛒 برای رفع کمبودها، مواد زیر را خریداری کنید:');
        if (deficiencies.includes('پروتئین')) suggestions.push('🥩 گوشت، مرغ، تخم‌مرغ یا حبوبات');
        if (deficiencies.includes('کربوهیدرات')) suggestions.push('🍞 نان، برنج، ماکارونی یا سیب‌زمینی');
        if (deficiencies.includes('چربی')) suggestions.push('🧈 روغن، کره، آجیل یا لبنیات پرچرب');
        if (deficiencies.includes('فیبر')) suggestions.push('🌾 سبزیجات، میوه‌ها، حبوبات یا غلات کامل');
        if (deficiencies.includes('کالری')) suggestions.push('🍚 مواد پرکالری مانند برنج، روغن یا شیرینی');
    }

    let status = 'good';
    let statusMessage = '✅ وضعیت تغذیه‌ای مناسب است.';
    if (deficiencies.length > 3) { status = 'critical'; statusMessage = '🔴 کمبود شدید تغذیه‌ای'; }
    else if (deficiencies.length > 0) { status = 'warning'; statusMessage = '🟠 کمبود تغذیه‌ای'; }

    return {
        calories: Math.round(totalCalories),
        protein: Math.round(totalProtein * 100) / 100,
        carbs: Math.round(totalCarbs * 100) / 100,
        fat: Math.round(totalFat * 100) / 100,
        fiber: Math.round(totalFiber * 100) / 100,
        vitamins, percentages, deficiencies, suggestions,
        status, statusMessage, familyNeeds, totalItems: inventory.length
    };
}

// ============================================================
// رندرها
// ============================================================
function renderAll() {
    renderCategoryList();
    populateCategoryDropdown();
    renderTable();
    updateNameSuggestions();
}

function renderCategoryList() {
    const container = document.getElementById('categoryList');
    if (!container) return;
    if (!categories || categories.length === 0) {
        container.innerHTML = '<span style="color: gray;">هنوز دسته‌ای اضافه نشده است.</span>';
        return;
    }
    container.innerHTML = categories.map(cat => 
        `<span class="category-tag inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm mr-1 mb-1">${cat}</span>`
    ).join('');
}

function populateCategoryDropdown() {
    const select = document.getElementById('foodCategory');
    if (!select) return;
    select.innerHTML = '<option value="">-- انتخاب دسته --</option>';
    if (categories && categories.length > 0) {
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            select.appendChild(option);
        });
    }
}

function updateNameSuggestions() {
    const category = document.getElementById('foodCategory')?.value;
    const datalist = document.getElementById('foodNamesList');
    if (!datalist || !category) {
        if (datalist) datalist.innerHTML = '';
        return;
    }
    const localNames = foodItems.filter(item => item.category === category).map(item => item.name);
    const allNames = [...new Set(localNames)];
    datalist.innerHTML = allNames.map(name => `<option value="${name}">`).join('');
}

function renderTable() {
    const tbody = document.getElementById('foodTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!foodItems || foodItems.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell(0);
        cell.colSpan = 6;
        cell.textContent = 'هیچ ماده غذایی ثبت نشده است.';
        cell.style.textAlign = 'center';
        return;
    }
    foodItems.forEach((item, index) => {
        const row = tbody.insertRow();
        row.insertCell(0).innerText = item.category || 'سایر';
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
// عملیات CRUD
// ============================================================
function editItem(index) {
    const item = foodItems[index];
    if (!item) return;
    document.getElementById('foodCategory').value = item.category || '';
    document.getElementById('foodName').value = item.name;
    document.getElementById('foodQty').value = item.quantity;
    document.getElementById('foodUnit').value = item.unit;
    document.getElementById('foodExpiry').value = item.expiry || '';
    currentEditIndex = index;
    updateNameSuggestions();
}

function deleteItem(index, silent = false) {
    const deleted = foodItems[index];
    if (!deleted) return;
    foodItems.splice(index, 1);
    if (!silent) addToHistory('حذف', deleted);
    if (currentEditIndex === index) currentEditIndex = null;
    saveFoodItems();
    renderAll();
}

function resetOnlyFoodItems() {
    if (confirm('آیا مطمئن هستید؟ تمام مواد غذایی و تاریخچه حذف می‌شوند.')) {
        foodItems = [];
        foodHistory = [];
        saveFoodItems();
        saveHistory();
        renderAll();
        alert('تمام مواد غذایی پاک شدند.');
    }
}

// ============================================================
// رویدادهای فرم
// ============================================================
function setupEventListeners() {
    // دکمه افزودن دسته
    document.getElementById('addCategoryBtn')?.addEventListener('click', () => {
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
        renderAll();
        document.getElementById('newCategoryName').value = '';
        alert(`دسته "${newCat}" اضافه شد.`);
    });

    // دکمه ذخیره ماده غذایی
    document.getElementById('saveFoodBtn')?.addEventListener('click', () => {
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
        saveFoodItems();
        renderAll();
        document.getElementById('clearFormBtn')?.click();
        // به‌روزرسانی داشبورد
        if (window.updateNutritionAnalysis) {
            window.updateNutritionAnalysis();
        }
        if (window.updateConsumptionPlan) {
            window.updateConsumptionPlan();
        }
    });

    document.getElementById('clearFormBtn')?.addEventListener('click', () => {
        document.getElementById('foodCategory').value = '';
        document.getElementById('foodName').value = '';
        document.getElementById('foodQty').value = '';
        document.getElementById('foodUnit').value = 'کیلوگرم';
        document.getElementById('foodExpiry').value = '';
        currentEditIndex = null;
        updateNameSuggestions();
    });

    document.getElementById('resetDataBtn')?.addEventListener('click', resetOnlyFoodItems);

    const modal = document.getElementById('historyModal');
    document.getElementById('historyBtn')?.addEventListener('click', () => {
        const historyDiv = document.getElementById('historyList');
        if (historyDiv) {
            loadHistory();
            if (!foodHistory || foodHistory.length === 0) {
                historyDiv.innerHTML = '<p>هیچ تغییری ثبت نشده است.</p>';
            } else {
                historyDiv.innerHTML = '<ul>' + foodHistory.map(h => 
                    `<li><strong>${h.timestamp}</strong> - ${h.action} : ${h.name} (${h.quantity} ${h.unit}, دسته: ${h.category})</li>`
                ).join('') + '</ul>';
            }
        }
        if (modal) modal.style.display = 'flex';
    });
    if (modal) {
        modal.querySelector('.close-modal')?.addEventListener('click', () => modal.style.display = 'none');
        window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    }

    document.getElementById('foodCategory')?.addEventListener('change', updateNameSuggestions);
}

// ============================================================
// مقداردهی اولیه
// ============================================================
async function init() {
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) {
        window.location.href = 'index.html';
        return;
    }
    initDrawer();
    updateDrawerItems();

    // بارگذاری همه داده‌ها از localStorage
    loadCategories();
    loadFoodItems();
    loadHistory();
    
    renderAll();
    setupEventListeners();
    console.log('✅ صفحه مدیریت مواد غذایی بارگذاری شد. دسته‌بندی‌ها:', categories.length, 'مواد:', foodItems.length);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
