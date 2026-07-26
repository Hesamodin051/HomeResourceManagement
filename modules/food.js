// modules/food.js
import { getLoggedInUser } from './auth.js';
import { initDrawer, updateDrawerItems } from './drawer.js';
import { getAverageRating } from './feedback.js';
import { store, setInventory } from './store.js';
import {
    getAllCategories,
    addCategory,
    addFoodItem,
    updateFoodItem,
    deleteFoodItem,
    addHistory,
    getHistory,
    seedDefaultCategories
} from './db.js';

let foodItems = [];
let categories = [];
let foodHistory = [];
let currentEditIndex = null;
let nutritionDataCache = [];

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
// همگام‌سازی foodItems با store.inventory (مهم!)
// ============================================================
function syncToStore() {
    try {
        const user = getLoggedInUser() || 'default';
        const key = `home_inventory_${user}`;
        localStorage.setItem(key, JSON.stringify(foodItems));
        setInventory(foodItems);
        console.log('✅ همگام‌سازی با store انجام شد. تعداد:', foodItems.length);
    } catch (error) {
        console.error('❌ خطا در همگام‌سازی:', error);
    }
}

// ============================================================
// بارگذاری داده‌ها از IndexedDB و همگام‌سازی با store
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
        // ✅ همگام‌سازی با store (برای داشبورد)
        syncToStore();
        renderAll();
        console.log('✅ داده‌ها بارگذاری و همگام شدند.');
    } catch (error) {
        console.error('❌ خطا در بارگذاری:', error);
        categories = ['غلات', 'حبوبات', 'لبنیات', 'پروتئین', 'سبزیجات', 'میوه‌ها', 'چاشنی‌ها', 'نان', 'نوشیدنی', 'سایر'];
        foodItems = [];
        foodHistory = [];
        syncToStore();
        renderAll();
    }
}

// ============================================================
// تحلیل ارزش غذایی (با استفاده از store.inventory)
// ============================================================
export async function analyzeInventoryNutrition() {
    // از store.inventory استفاده کن (نه foodItems)
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

// ... بقیه توابع (رندرها، رویدادها، CRUD) بدون تغییر ...

// در تابع add, edit, delete بعد از تغییر foodItems، syncToStore() را صدا بزنید
// و در init نیز syncToStore() فراخوانی شود
