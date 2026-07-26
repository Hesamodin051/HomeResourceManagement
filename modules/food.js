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
// بارگذاری داده‌های تغذیه‌ای
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
// نیاز روزانه استاندارد برای یک فرد
// ============================================================
function getDailyNeeds() {
    return {
        calories: 2000,
        protein: 50,  // گرم
        carbs: 250,   // گرم
        fat: 70,      // گرم
        fiber: 25,    // گرم
        vitamins: {
            'A': 900,
            'C': 90,
            'D': 15,
            'E': 15,
            'K': 120,
            'B1': 1.2,
            'B2': 1.3,
            'B3': 16,
            'B6': 1.3,
            'B9': 400,
            'B12': 2.4,
            'Calcium': 1000,
            'Iron': 8,
            'Potassium': 3500,
            'Magnesium': 420,
            'Zinc': 11,
            'Choline': 550,
            'Omega-3': 1.6,
            'Selenium': 55,
            'Phosphorus': 700,
            'Manganese': 2.3
        }
    };
}

// ============================================================
// تحلیل ارزش غذایی هوشمند (نسخه جدید)
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
            vitamins: {},
            deficiencies: [],
            suggestions: [],
            status: 'empty',
            message: 'هیچ ماده غذایی ثبت نشده است.'
        };
    }

    const nutritionData = await loadNutritionData();
    const dailyNeeds = getDailyNeeds();
    const familySize = store.currentUserProfile?.familySize || 4;

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

    // محاسبه نیاز کل خانواده
    const familyNeeds = {
        calories: dailyNeeds.calories * familySize,
        protein: dailyNeeds.protein * familySize,
        carbs: dailyNeeds.carbs * familySize,
        fat: dailyNeeds.fat * familySize,
        fiber: dailyNeeds.fiber * familySize
    };

    // محاسبه درصد تأمین نیاز
    const percentages = {
        calories: Math.round((totalCalories / familyNeeds.calories) * 100),
        protein: Math.round((totalProtein / familyNeeds.protein) * 100),
        carbs: Math.round((totalCarbs / familyNeeds.carbs) * 100),
        fat: Math.round((totalFat / familyNeeds.fat) * 100),
        fiber: Math.round((totalFiber / familyNeeds.fiber) * 100)
    };

    // شناسایی کمبودها
    const deficiencies = [];
    const suggestions = [];

    if (percentages.calories < 70) {
        deficiencies.push('کالری');
        suggestions.push('🍚 مواد پرکالری مانند برنج، روغن، نان و شیرینی بیشتر مصرف کنید.');
    }
    if (percentages.protein < 70) {
        deficiencies.push('پروتئین');
        suggestions.push('🥩 پروتئین کم است. گوشت، مرغ، تخم‌مرغ، حبوبات و لبنیات بیشتری تهیه کنید.');
    }
    if (percentages.carbs < 70) {
        deficiencies.push('کربوهیدرات');
        suggestions.push('🍞 کربوهیدرات کم است. نان، برنج، ماکارونی و سیب‌زمینی را افزایش دهید.');
    }
    if (percentages.fat < 70) {
        deficiencies.push('چربی');
        suggestions.push('🧈 چربی کم است. روغن، کره، آجیل و لبنیات پرچرب را اضافه کنید.');
    }
    if (percentages.fiber < 70) {
        deficiencies.push('فیبر');
        suggestions.push('🌾 فیبر کم است. سبزیجات، میوه‌ها، حبوبات و غلات کامل مصرف کنید.');
    }

    // بررسی ویتامین‌ها و مواد معدنی
    const vitaminNeeds = dailyNeeds.vitamins;
    Object.keys(vitaminNeeds).forEach(v => {
        const current = vitamins[v] || 0;
        const need = vitaminNeeds[v] * familySize;
        const pct = Math.round((current / need) * 100);
        if (pct < 50) {
            deficiencies.push(v);
            suggestions.push(`💊 ویتامین ${v} کم است. منابع آن را بررسی کنید.`);
        }
    });

    // وضعیت کلی
    let status = 'good';
    let statusMessage = '✅ وضعیت تغذیه‌ای مناسب است.';
    if (deficiencies.length > 3) {
        status = 'critical';
        statusMessage = `🔴 کمبود شدید: ${deficiencies.slice(0, 3).join('، ')} و ${deficiencies.length - 3} مورد دیگر.`;
    } else if (deficiencies.length > 0) {
        status = 'warning';
        statusMessage = `🟠 کمبود: ${deficiencies.join('، ')}.`;
    }

    return {
        calories: Math.round(totalCalories),
        protein: Math.round(totalProtein * 100) / 100,
        carbs: Math.round(totalCarbs * 100) / 100,
        fat: Math.round(totalFat * 100) / 100,
        fiber: Math.round(totalFiber * 100) / 100,
        vitamins,
        percentages,
        deficiencies,
        suggestions,
        status,
        statusMessage,
        familyNeeds,
        totalItems: inventory.length
    };
}

// ============================================================
// همگام‌سازی با localStorage (برای داشبورد)
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
// دریافت اطلاعات تغذیه‌ای از AI (اگر نیاز باشد)
// ============================================================
export async function fetchNutritionFromAI(foodName) {
    try {
        if (typeof puter === 'undefined') return null;
        const prompt = `
به عنوان یک متخصص تغذیه، اطلاعات کامل تغذیه‌ای برای "${foodName}" را به صورت JSON تولید کن.
فرمت: { "name": "${foodName}", "nutrition": { "calories": عدد, "protein": عدد, "carbs": عدد, "fat": عدد, "fiber": عدد, "vitamins": ["لیست"] } }
فقط JSON برگردان.
`;
        const response = await puter.ai.chat(prompt, { model: "gpt-4o-mini", temperature: 0.1 });
        let text = '';
        if (typeof response === 'string') text = response;
        else if (response?.message?.content) text = response.message.content;
        else text = JSON.stringify(response);
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return null;
        const data = JSON.parse(match[0]);
        return data;
    } catch (error) {
        console.error(`❌ خطا در دریافت اطلاعات برای "${foodName}":`, error);
        return null;
    }
}

export async function updateNutritionData(foodName) {
    const currentData = await loadNutritionData();
    const existing = currentData.find(item => item.name === foodName);
    if (existing) return existing;
    const newData = await fetchNutritionFromAI(foodName);
    if (!newData) return null;
    currentData.push(newData);
    nutritionDataCache = currentData;
    localStorage.setItem('food_nutrition_cache', JSON.stringify(currentData));
    return newData;
}

// ============================================================
// رندرها (بقیه کد بدون تغییر)
// ============================================================
function renderAll() { /* ... کدهای قبلی ... */ }
function renderCategoryList() { /* ... */ }
function populateCategoryDropdown() { /* ... */ }
function updateNameSuggestions() { /* ... */ }
function renderTable() { /* ... */ }
function updateShoppingSuggestions() { /* ... */ }
function editItem(index) { /* ... */ }
async function deleteItem(index, silent = false) { /* ... */ }
async function resetOnlyFoodItems() { /* ... */ }
async function addToHistory(action, item) { /* ... */ }
function setupEventListeners() { /* ... */ }
async function init() { /* ... */ }

// بقیه کدها همانند قبل
