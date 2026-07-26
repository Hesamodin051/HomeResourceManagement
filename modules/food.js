// modules/food.js (نسخه نهایی با همگام‌سازی کامل)
import { getLoggedInUser } from './auth.js';
import { initDrawer, updateDrawerItems } from './drawer.js';
import {
    getAllCategories,
    addCategory,
    getAllFoodItems,
    addFoodItem,
    updateFoodItem,
    deleteFoodItem,
    addHistory,
    getHistory,
    seedDefaultCategories
} from './db.js';
import { store, setInventory } from './store.js';

let foodItems = [];
let categories = [];
let foodHistory = [];
let currentEditIndex = null;

// ============================================================
// همگام‌سازی داده‌ها با localStorage (برای داشبورد)
// ============================================================
function syncInventoryToLocalStorage() {
    try {
        const user = getLoggedInUser() || 'default';
        const key = `home_inventory_${user}`;
        
        // تبدیل داده‌های foodItems به فرمت مورد انتظار inventory
        const inventoryData = foodItems.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            expiry: item.expiry || '',
            type: item.type || 'normal',
            category: item.category
        }));
        
        // ذخیره در localStorage
        localStorage.setItem(key, JSON.stringify(inventoryData));
        
        // به‌روزرسانی مستقیم store (برای داشبورد)
        if (typeof setInventory === 'function') {
            setInventory(inventoryData);
        } else if (store) {
            store.inventory = inventoryData;
            // اطلاع‌رسانی به شنونده‌ها
            if (store.listeners) {
                store.listeners.forEach(listener => {
                    if (listener.key === 'inventory') {
                        listener.callback(inventoryData);
                    }
                });
            }
        }
        
        console.log('✅ داده‌ها با localStorage همگام شدند. تعداد:', inventoryData.length);
        return true;
    } catch (error) {
        console.error('❌ خطا در همگام‌سازی با localStorage:', error);
        return false;
    }
}

// ============================================================
// بارگذاری داده‌ها از IndexedDB و همگام‌سازی اولیه
// ============================================================
async function loadData() {
    try {
        // مقداردهی اولیه دسته‌بندی‌ها
        await seedDefaultCategories();

        // دریافت دسته‌بندی‌ها
        const categoriesData = await getAllCategories();
        categories = categoriesData.map(cat => cat.name);
        window.categoryMap = {};
        categoriesData.forEach(cat => {
            window.categoryMap[cat.name] = cat.id;
        });

        // دریافت مواد غذایی
        foodItems = await getAllFoodItems();

        // دریافت تاریخچه
        foodHistory = await getHistory(50);

        // همگام‌سازی با localStorage (برای داشبورد)
        syncInventoryToLocalStorage();

        renderAll();
        console.log('✅ داده‌ها با موفقیت بارگذاری و همگام شدند.');
    } catch (error) {
        console.error('❌ خطا در بارگذاری داده‌ها:', error);
        // در صورت خطا، از داده‌های پیش‌فرض استفاده کنید
        categories = ['غلات', 'حبوبات', 'لبنیات', 'پروتئین', 'سبزیجات', 'میوه‌ها', 'چاشنی‌ها', 'نان', 'نوشیدنی', 'سایر'];
        foodItems = [];
        foodHistory = [];
        renderAll();
    }
}

// ============================================================
// رندر همه بخش‌ها
// ============================================================
function renderAll() {
    renderCategoryList();
    populateCategoryDropdown();
    renderTable();
    updateNameSuggestions();
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
    container.innerHTML = categories.map(cat => 
        `<span class="category-tag inline-block bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm mr-1 mb-1">${cat}</span>`
    ).join('');
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
    const allNames = [...new Set(localNames)];
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
        cell.textContent = 'هیچ ماده غذایی ثبت نشده است.';
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
// ویرایش، حذف، افزودن (با همگام‌سازی)
// ============================================================
function editItem(index) {
    const item = foodItems[index];
    if (!item) return;
    document.getElementById('foodCategory').value = item.category;
    document.getElementById('foodName').value = item.name;
    document.getElementById('foodQty').value = item.quantity;
    document.getElementById('foodUnit').value = item.unit;
    document.getElementById('foodExpiry').value = item.expiry || '';
    currentEditIndex = index;
    updateNameSuggestions();
}

async function deleteItem(index, silent = false) {
    const deleted = foodItems[index];
    if (!deleted) return;
    
    try {
        await deleteFoodItem(deleted.id);
        foodItems.splice(index, 1);
        if (!silent) await addToHistory('حذف', deleted);
        if (currentEditIndex === index) currentEditIndex = null;
        
        // همگام‌سازی با localStorage
        syncInventoryToLocalStorage();
        
        renderAll();
        console.log('🗑️ ماده غذایی حذف شد و همگام‌سازی انجام شد.');
    } catch (error) {
        console.error('خطا در حذف:', error);
        alert('خطا در حذف ماده غذایی.');
    }
}

async function resetOnlyFoodItems() {
    if (confirm('آیا مطمئن هستید؟ تمام مواد غذایی ثبت شده و تاریخچه حذف خواهند شد.')) {
        try {
            for (const item of foodItems) {
                await deleteFoodItem(item.id);
            }
            foodItems = [];
            foodHistory = [];
            
            // همگام‌سازی با localStorage
            syncInventoryToLocalStorage();
            
            renderAll();
            alert('تمام مواد غذایی و تاریخچه پاک شدند.');
        } catch (error) {
            console.error('خطا در ریست:', error);
            alert('خطا در پاک کردن داده‌ها.');
        }
    }
}

// ============================================================
// تاریخچه تغییرات
// ============================================================
async function addToHistory(action, item) {
    try {
        await addHistory(action, item);
        foodHistory = await getHistory(50);
    } catch (error) {
        console.error('خطا در ثبت تاریخچه:', error);
    }
}

// ============================================================
// راه‌اندازی رویدادها
// ============================================================
function setupEventListeners() {
    // دکمه افزودن دسته
    document.getElementById('addCategoryBtn')?.addEventListener('click', async () => {
        const newCat = document.getElementById('newCategoryName')?.value.trim();
        if (!newCat) {
            alert('لطفاً نام دسته را وارد کنید.');
            return;
        }
        if (categories.includes(newCat)) {
            alert('این دسته قبلاً وجود دارد.');
            return;
        }
        try {
            await addCategory(newCat);
            categories.push(newCat);
            const categoriesData = await getAllCategories();
            window.categoryMap = {};
            categoriesData.forEach(cat => {
                window.categoryMap[cat.name] = cat.id;
            });
            renderAll();
            document.getElementById('newCategoryName').value = '';
            alert(`دسته "${newCat}" اضافه شد.`);
        } catch (error) {
            alert('خطا در افزودن دسته: ' + error.message);
        }
    });

    // دکمه ذخیره ماده غذایی
    document.getElementById('saveFoodBtn')?.addEventListener('click', async () => {
        const category = document.getElementById('foodCategory')?.value;
        const name = document.getElementById('foodName')?.value?.trim();
        const qty = parseFloat(document.getElementById('foodQty')?.value);
        const unit = document.getElementById('foodUnit')?.value;
        const expiry = document.getElementById('foodExpiry')?.value;

        if (!category) { alert('لطفاً دسته را انتخاب کنید.'); return; }
        if (!name || isNaN(qty) || qty <= 0 || !unit) { alert('نام، مقدار معتبر و واحد را وارد کنید.'); return; }

        try {
            const categoryId = window.categoryMap[category];
            const itemData = { name, quantity: qty, unit, expiry, category, categoryId };
            
            if (currentEditIndex !== null) {
                const oldItem = foodItems[currentEditIndex];
                await updateFoodItem(oldItem.id, itemData);
                foodItems[currentEditIndex] = { ...oldItem, ...itemData };
                await addToHistory('ویرایش', { ...oldItem, ...itemData });
                currentEditIndex = null;
            } else {
                const newId = await addFoodItem(itemData);
                const newItem = { id: newId, ...itemData };
                foodItems.push(newItem);
                await addToHistory('افزودن', newItem);
            }
            
            // همگام‌سازی با localStorage
            syncInventoryToLocalStorage();
            
            renderAll();
            document.getElementById('clearFormBtn')?.click();
            
            // به‌روزرسانی داشبورد (اگر باز باشد)
            if (window.updateNutritionAnalysis) {
                window.updateNutritionAnalysis();
            }
            console.log('✅ ماده غذایی ذخیره شد و همگام‌سازی انجام شد.');
        } catch (error) {
            alert(error.message);
        }
    });

    // دکمه پاک کردن فرم
    document.getElementById('clearFormBtn')?.addEventListener('click', () => {
        document.getElementById('foodCategory').value = '';
        document.getElementById('foodName').value = '';
        document.getElementById('foodQty').value = '';
        document.getElementById('foodUnit').value = 'کیلوگرم';
        document.getElementById('foodExpiry').value = '';
        currentEditIndex = null;
        updateNameSuggestions();
    });

    // دکمه ریست
    document.getElementById('resetDataBtn')?.addEventListener('click', resetOnlyFoodItems);

    // دکمه تاریخچه
    const modal = document.getElementById('historyModal');
    document.getElementById('historyBtn')?.addEventListener('click', async () => {
        const historyDiv = document.getElementById('historyList');
        if (historyDiv) {
            const history = await getHistory(50);
            if (history.length === 0) {
                historyDiv.innerHTML = '<p>هیچ تغییری ثبت نشده است.</p>';
            } else {
                historyDiv.innerHTML = '<ul>' + history.map(h => 
                    `<li><strong>${new Date(h.timestamp).toLocaleString('fa-IR')}</strong> - ${h.action} : ${h.name} (${h.quantity} ${h.unit}, دسته: ${h.category})</li>`
                ).join('') + '</ul>';
            }
        }
        if (modal) modal.style.display = 'flex';
    });
    if (modal) {
        modal.querySelector('.close-modal')?.addEventListener('click', () => modal.style.display = 'none');
        window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    }

    // تغییر دسته برای پیشنهاد نام
    document.getElementById('foodCategory')?.addEventListener('change', updateNameSuggestions);
}

// ============================================================
// تحلیل ارزش غذایی
// ============================================================
export function analyzeInventoryNutrition() {
    // این تابع برای داشبورد است و داده‌ها را از localStorage می‌خواند
    // فعلاً یک خروجی ساده برمی‌گردانیم
    return {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        vitamins: {}
    };
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

    await loadData();
    setupEventListeners();
    console.log('✅ صفحه مدیریت مواد غذایی با IndexedDB بارگذاری شد.');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
