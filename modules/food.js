// modules/food.js
import { getLoggedInUser } from './auth.js';
import { initDrawer, updateDrawerItems } from './drawer.js';
import { getAverageRating } from './feedback.js';
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
let nutritionDataCache = [];

// ============================================================
// بارگذاری داده‌های تغذیه‌ای از food_items.json
// ============================================================
async function loadNutritionData() {
    if (nutritionDataCache.length > 0) return nutritionDataCache;
    try {
        const response = await fetch('assets/data/food_items.json');
        const data = await response.json();
        nutritionDataCache = data;
        return data;
    } catch (error) {
        console.warn('⚠️ خطا در بارگذاری food_items.json:', error);
        return [];
    }
}

// ============================================================
// همگام‌سازی داده‌ها با localStorage (برای داشبورد)
// ============================================================
function syncInventoryToLocalStorage() {
    try {
        const user = getLoggedInUser() || 'default';
        const key = `home_inventory_${user}`;
        
        const inventoryData = foodItems.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            expiry: item.expiry || '',
            type: item.type || 'normal',
            category: item.category
        }));
        
        localStorage.setItem(key, JSON.stringify(inventoryData));
        
        if (typeof setInventory === 'function') {
            setInventory(inventoryData);
        } else if (store) {
            store.inventory = inventoryData;
            if (store.listeners) {
                store.listeners.forEach(listener => {
                    if (listener.key === 'inventory') {
                        listener.callback(inventoryData);
                    }
                });
            }
        }
        
        console.log('✅ همگام‌سازی با localStorage انجام شد. تعداد:', inventoryData.length);
        return true;
    } catch (error) {
        console.error('❌ خطا در همگام‌سازی:', error);
        return false;
    }
}

// ============================================================
// بارگذاری داده‌ها از IndexedDB
// ============================================================
async function loadData() {
    try {
        await seedDefaultCategories();
        const categoriesData = await getAllCategories();
        categories = categoriesData.map(cat => cat.name);
        window.categoryMap = {};
        categoriesData.forEach(cat => {
            window.categoryMap[cat.name] = cat.id;
        });

        foodItems = await getAllFoodItems();
        foodHistory = await getHistory(50);

        syncInventoryToLocalStorage();
        renderAll();
        console.log('✅ داده‌ها بارگذاری و همگام شدند.');
    } catch (error) {
        console.error('❌ خطا در بارگذاری:', error);
        categories = ['غلات', 'حبوبات', 'لبنیات', 'پروتئین', 'سبزیجات', 'میوه‌ها', 'چاشنی‌ها', 'نان', 'نوشیدنی', 'سایر'];
        foodItems = [];
        foodHistory = [];
        renderAll();
    }
}

// ============================================================
// تحلیل ارزش غذایی (نسخه کامل)
// ============================================================
export async function analyzeInventoryNutrition() {
    const inventory = foodItems;
    if (!inventory || inventory.length === 0) {
        return {
            calories: 0,
            protein: 0,
            carbs: 0,
            fat: 0,
            fiber: 0,
            vitamins: {}
        };
    }

    const nutritionData = await loadNutritionData();
    
    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;
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
// عملیات CRUD با همگام‌سازی
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
        syncInventoryToLocalStorage();
        renderAll();
        console.log('🗑️ حذف و همگام‌سازی شد.');
    } catch (error) {
        console.error('خطا در حذف:', error);
        alert('خطا در حذف ماده غذایی.');
    }
}

async function resetOnlyFoodItems() {
    if (confirm('آیا مطمئن هستید؟ تمام مواد غذایی و تاریخچه حذف می‌شوند.')) {
        try {
            for (const item of foodItems) {
                await deleteFoodItem(item.id);
            }
            foodItems = [];
            foodHistory = [];
            syncInventoryToLocalStorage();
            renderAll();
            alert('تمام مواد غذایی پاک شدند.');
        } catch (error) {
            console.error('خطا در ریست:', error);
            alert('خطا در پاک کردن داده‌ها.');
        }
    }
}

async function addToHistory(action, item) {
    try {
        await addHistory(action, item);
        foodHistory = await getHistory(50);
    } catch (error) {
        console.error('خطا در تاریخچه:', error);
    }
}

// ============================================================
// راه‌اندازی رویدادها
// ============================================================
function setupEventListeners() {
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
            
            syncInventoryToLocalStorage();
            renderAll();
            document.getElementById('clearFormBtn')?.click();
            
            if (window.updateNutritionAnalysis) {
                window.updateNutritionAnalysis();
            }
            console.log('✅ ماده غذایی ذخیره و همگام شد.');
        } catch (error) {
            alert(error.message);
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

    document.getElementById('foodCategory')?.addEventListener('change', updateNameSuggestions);
}
// modules/food.js (افزودن توابع جدید)

// ============================================================
// دریافت اطلاعات تغذیه‌ای از هوش مصنوعی
// ============================================================
export async function fetchNutritionFromAI(foodName) {
    try {
        if (typeof puter === 'undefined') {
            console.warn('⚠️ Puter.js بارگذاری نشده است.');
            return null;
        }

        const prompt = `
به عنوان یک متخصص تغذیه، اطلاعات کامل تغذیه‌ای برای ماده غذایی "${foodName}" را به صورت JSON تولید کن.

فرمت خروجی:
{
  "name": "${foodName}",
  "barcode": "یک کد ۱۳ رقمی ساختگی",
  "quantity_per_person_per_day": عدد (مقدار مصرف روزانه برای هر نفر بر حسب واحد),
  "unit": "واحد اندازه‌گیری (کیلوگرم، لیتر، عدد، بسته)",
  "shelf_life_days": عدد (مدت ماندگاری به روز),
  "storage_condition": "شرایط نگهداری (dry_cool, refrigerator, freezer, dark_dry, room_temperature, dark_cool)",
  "category": "دسته‌بندی (غلات، حبوبات، لبنیات، پروتئین، سبزیجات، میوه‌ها، چاشنی‌ها، نان، نوشیدنی، سایر)",
  "priority_level": 1 یا 2 یا 3,
  "nutrition": {
    "calories": عدد (کالری),
    "protein": عدد (پروتئین به گرم),
    "carbs": عدد (کربوهیدرات به گرم),
    "fat": عدد (چربی به گرم),
    "fiber": عدد (فیبر به گرم),
    "vitamins": ["لیست ویتامین‌ها و مواد معدنی"]
  }
}

اطمینان حاصل کن که خروجی فقط JSON معتبر باشد و توضیح اضافی نداشته باشد.
`;

        const response = await puter.ai.chat(prompt, {
            model: "gpt-4o-mini",
            temperature: 0.1
        });

        // استخراج JSON از پاسخ
        let jsonText = response;
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonText = jsonMatch[0];
        }

        const data = JSON.parse(jsonText);
        console.log(`✅ اطلاعات تغذیه‌ای برای "${foodName}" دریافت شد.`);
        return data;
    } catch (error) {
        console.error(`❌ خطا در دریافت اطلاعات برای "${foodName}":`, error);
        return null;
    }
}

// ============================================================
// افزودن یا به‌روزرسانی اطلاعات تغذیه‌ای در food_items.json
// ============================================================
export async function updateNutritionData(foodName) {
    // بارگذاری data فعلی
    const currentData = await loadNutritionData();
    
    // بررسی وجود ماده در data
    const existing = currentData.find(item => item.name === foodName);
    if (existing) {
        console.log(`ℹ️ "${foodName}" قبلاً در food_items.json وجود دارد.`);
        return existing;
    }

    // دریافت از AI
    const newData = await fetchNutritionFromAI(foodName);
    if (!newData) {
        console.warn(`⚠️ اطلاعات "${foodName}" دریافت نشد.`);
        return null;
    }

    // افزودن به آرایه و ذخیره در localStorage (برای کش)
    currentData.push(newData);
    nutritionDataCache = currentData;
    
    // ذخیره در localStorage برای دسترسی سریع‌تر
    localStorage.setItem('food_nutrition_cache', JSON.stringify(currentData));
    
    // همچنین می‌توانیم به سرور ارسال کنیم (در صورت وجود بک‌اند)
    console.log(`✅ "${foodName}" به لیست تغذیه اضافه شد.`);
    return newData;
}

// ============================================================
// بارگذاری داده‌های تغذیه‌ای با کش
// ============================================================
async function loadNutritionData() {
    // ابتدا از کش (localStorage) تلاش کن
    const cached = localStorage.getItem('food_nutrition_cache');
    if (cached) {
        try {
            nutritionDataCache = JSON.parse(cached);
            return nutritionDataCache;
        } catch (e) {}
    }

    // اگر در کش نبود، از فایل بخوان
    if (nutritionDataCache.length > 0) return nutritionDataCache;
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
