// modules/consumption-planner.js
import { store } from './store.js';

let recipesCache = [];

// ============================================================
// بارگذاری دستورهای غذایی
// ============================================================
async function loadRecipes() {
    if (recipesCache.length > 0) return recipesCache;
    try {
        const response = await fetch('assets/data/recipes.json');
        const data = await response.json();
        recipesCache = data;
        return data;
    } catch (error) {
        console.warn('⚠️ خطا در بارگذاری recipes.json:', error);
        return getFallbackRecipes();
    }
}

function getFallbackRecipes() {
    return [
        {
            id: 1,
            name: 'عدسی',
            category: 'خورش',
            ingredients: [{ name: 'عدس', quantity: 0.05, unit: 'کیلوگرم' }, { name: 'برنج', quantity: 0.1, unit: 'کیلوگرم' }, { name: 'پیاز', quantity: 0.02, unit: 'کیلوگرم' }, { name: 'روغن', quantity: 0.02, unit: 'لیتر' }],
            servings: 4,
            cook_time: 45,
            difficulty: 'آسان',
            tags: ['گیاهی', 'ارزان', 'سریع'],
            mealType: 'ناهار'
        },
        {
            id: 2,
            name: 'ماکارونی با رب',
            category: 'پاستا',
            ingredients: [{ name: 'ماکارونی', quantity: 0.15, unit: 'کیلوگرم' }, { name: 'رب گوجه', quantity: 0.01, unit: 'کیلوگرم' }, { name: 'روغن', quantity: 0.02, unit: 'لیتر' }],
            servings: 4,
            cook_time: 30,
            difficulty: 'آسان',
            tags: ['سریع', 'ارزان'],
            mealType: 'ناهار'
        },
        {
            id: 3,
            name: 'املت ساده',
            category: 'صبحانه',
            ingredients: [{ name: 'تخم‌مرغ', quantity: 2, unit: 'عدد' }, { name: 'روغن', quantity: 0.02, unit: 'لیتر' }, { name: 'نمک', quantity: 0.002, unit: 'کیلوگرم' }],
            servings: 2,
            cook_time: 10,
            difficulty: 'آسان',
            tags: ['سریع', 'صبحانه'],
            mealType: 'صبحانه'
        },
        {
            id: 4,
            name: 'قورمه سبزی',
            category: 'خورش',
            ingredients: [{ name: 'سبزی قورمه', quantity: 0.5, unit: 'کیلوگرم' }, { name: 'گوشت', quantity: 0.3, unit: 'کیلوگرم' }, { name: 'لوبیا قرمز', quantity: 0.1, unit: 'کیلوگرم' }, { name: 'پیاز', quantity: 0.05, unit: 'کیلوگرم' }, { name: 'روغن', quantity: 0.03, unit: 'لیتر' }],
            servings: 4,
            cook_time: 120,
            difficulty: 'متوسط',
            tags: ['سنتی', 'خورش'],
            mealType: 'ناهار'
        }
    ];
}

// ============================================================
// توابع پایه
// ============================================================
function getFamilySize() {
    return store.currentUserProfile?.familySize || 4;
}

function getInventory() {
    return store.inventory || [];
}

// ============================================================
// محاسبه تعداد دفعات قابل پخت
// ============================================================
function calculateServings(recipe, inventory, familySize) {
    let maxServings = Infinity;
    for (let ingredient of recipe.ingredients) {
        let available = 0;
        const inventoryItem = inventory.find(item => 
            item.name.includes(ingredient.name) || 
            ingredient.name.includes(item.name)
        );
        if (inventoryItem) {
            if (inventoryItem.unit === ingredient.unit) {
                available = inventoryItem.quantity;
            } else {
                const conversion = { 'کیلوگرم': { 'گرم': 1000 }, 'لیتر': { 'میلی‌لیتر': 1000 }, 'عدد': { 'عدد': 1 }, 'بسته': { 'بسته': 1 } };
                if (conversion[inventoryItem.unit] && conversion[inventoryItem.unit][ingredient.unit]) {
                    available = inventoryItem.quantity * conversion[inventoryItem.unit][ingredient.unit];
                } else {
                    available = inventoryItem.quantity;
                }
            }
        }
        const needed = ingredient.quantity * familySize;
        const servings = needed > 0 ? available / needed : Infinity;
        if (servings < maxServings) maxServings = servings;
    }
    return maxServings > 0 ? Math.floor(maxServings) : 0;
}

// ============================================================
// تولید برنامه هوشمند با دسته‌بندی صحیح وعده‌ها
// ============================================================
export async function generateWeeklyPlan(days = 7, startDate = null) {
    const familySize = getFamilySize();
    const inventory = getInventory();
    const crisisMode = store.crisisMode;
    const recipes = await loadRecipes();

    // محاسبه دفعات قابل پخت برای هر غذا
    const recipeAvailability = recipes.map(recipe => ({
        ...recipe,
        servings: calculateServings(recipe, inventory, familySize),
        isAvailable: calculateServings(recipe, inventory, familySize) > 0
    }));

    let availableRecipes = recipeAvailability.filter(r => r.isAvailable);

    // اگر هیچ غذایی قابل پخت نبود، یک لیست پیش‌فرض با غذاهای ساده بساز
    if (availableRecipes.length === 0) {
        availableRecipes = recipeAvailability.slice(0, 5).map(r => ({ ...r, servings: 1, isAvailable: true }));
    }

    // ===== دسته‌بندی غذاها بر اساس وعده =====
    const breakfastOptions = availableRecipes.filter(r => r.mealType === 'صبحانه' || (r.tags && r.tags.includes('صبحانه')));
    const lunchOptions = availableRecipes.filter(r => r.mealType === 'ناهار' || r.category === 'خورش' || r.category === 'پلو' || r.category === 'پاستا');
    const dinnerOptions = availableRecipes.filter(r => r.mealType === 'شام' || r.category === 'سوپ' || r.category === 'نان' || (r.tags && r.tags.includes('سریع')));

    // اگر گزینه‌های کافی نبود، از همه غذاها استفاده کن
    const allMeals = availableRecipes;

    function selectMeal(mealType, dayIndex, usedMeals) {
        let pool;
        if (mealType === 'صبحانه') pool = breakfastOptions.length > 0 ? breakfastOptions : allMeals;
        else if (mealType === 'ناهار') pool = lunchOptions.length > 0 ? lunchOptions : allMeals;
        else pool = dinnerOptions.length > 0 ? dinnerOptions : allMeals;

        // حذف غذاهای استفاده‌شده برای تنوع
        const availablePool = pool.filter(recipe => !usedMeals.includes(recipe.id));
        if (availablePool.length === 0) {
            return pool[dayIndex % pool.length];
        }
        const index = dayIndex % availablePool.length;
        return availablePool[index];
    }

    // ساخت برنامه
    const start = startDate ? new Date(startDate) : new Date();
    const daysOfWeek = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
    let plan = [];
    let usedMeals = [];

    const minServings = Math.min(...availableRecipes.map(r => r.servings));
    const maxDays = Math.min(days, minServings || 7);

    for (let i = 0; i < maxDays; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const dayName = daysOfWeek[date.getDay()] || 'روز';
        const dayPlan = {
            day: i + 1,
            date: date.toISOString().slice(0, 10),
            dayName: dayName,
            meals: {
                صبحانه: selectMeal('صبحانه', i, usedMeals),
                ناهار: selectMeal('ناهار', i, usedMeals),
                شام: selectMeal('شام', i, usedMeals)
            }
        };
        // ثبت غذاهای استفاده‌شده
        ['صبحانه', 'ناهار', 'شام'].forEach(type => {
            usedMeals.push(dayPlan.meals[type].id);
        });
        plan.push(dayPlan);
    }

    // ===== نکات بهینه‌سازی =====
    const tips = [];
    const expiringItems = inventory.filter(item => {
        if (!item.expiry) return false;
        const daysLeft = (new Date(item.expiry) - new Date()) / (1000 * 60 * 60 * 24);
        return daysLeft >= 0 && daysLeft <= 3;
    });
    if (expiringItems.length > 0) {
        tips.push(`⏰ مواد زیر در حال انقضا هستند: ${expiringItems.map(i => i.name).join('، ')}. در برنامه گنجانده شده‌اند.`);
    }
    const waterItem = inventory.find(i => i.name.includes('آب'));
    if (waterItem) {
        const daysLeft = waterItem.quantity / (familySize * 2);
        if (daysLeft < 7) tips.push(`💧 آب تنها برای ${Math.floor(daysLeft)} روز کافی است. مصرف را مدیریت کنید.`);
    }
    if (crisisMode) tips.push('⚠️ حالت بحران فعال است. مصرف را به حداقل برسانید و اولویت با آب و کنسروها باشد.');
    if (tips.length === 0) tips.push('✅ وضعیت ذخایر مناسب است. برنامه بر اساس موجودی و تاریخ انقضا تنظیم شده است.');

    const keyItems = {
        water: waterItem ? { quantity: waterItem.quantity, unit: waterItem.unit } : null,
        rice: inventory.find(i => i.name.includes('برنج')),
        legumes: inventory.find(i => i.name.includes('عدس') || i.name.includes('لوبیا') || i.name.includes('نخود')),
        canned: inventory.find(i => i.name.includes('کنسرو'))
    };

    return { plan, maxDays, totalDays: maxDays, tips, keyItems, crisisMode, availableRecipes };
}

// ============================================================
// تابع نمایش در داشبورد
// ============================================================
export async function generateConsumptionPlan(days = 7, startDate = null) {
    const result = await generateWeeklyPlan(days, startDate);
    const { plan, maxDays, tips, keyItems, crisisMode } = result;
    window.currentPlanData = result;

    let html = `
        <div class="consumption-plan">
            <div class="flex justify-between items-center mb-4">
                <h4 class="text-lg font-bold text-primary">📅 برنامه مصرف (${maxDays} روز)</h4>
                <span class="text-sm text-gray-500">${crisisMode ? '⚠️ بحران' : '🌿 عادی'}</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    `;

    plan.forEach((day, idx) => {
        const mealIcons = { صبحانه: '🌅', ناهار: '🌞', شام: '🌙' };
        html += `
            <div class="day-card bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-sm text-primary">${day.dayName}</span>
                    <span class="text-xs text-gray-400">${day.date}</span>
                </div>
                <div class="space-y-1 text-sm">
        `;
        ['صبحانه', 'ناهار', 'شام'].forEach(type => {
            const meal = day.meals[type];
            html += `
                <div class="meal-item cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors" 
                     data-day-index="${idx}" data-meal-type="${type}">
                    <span class="font-medium">${mealIcons[type]} ${type}:</span> ${meal.name}
                    <span class="text-xs text-gray-400">(⏱️ ${meal.cook_time || '?'} دقیقه)</span>
                </div>
            `;
        });
        html += `
                </div>
            </div>
        `;
    });

    html += `</div>`;

    // خلاصه ذخایر
    html += `
        <div class="mt-4 p-3 bg-gray-50 rounded-xl">
            <h5 class="text-sm font-bold text-gray-700 mb-2">📊 خلاصه ذخایر کلیدی</h5>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                ${keyItems.water ? `<div>💧 آب: ${keyItems.water.quantity} ${keyItems.water.unit}</div>` : ''}
                ${keyItems.rice ? `<div>🍚 برنج: ${keyItems.rice.quantity} ${keyItems.rice.unit}</div>` : ''}
                ${keyItems.legumes ? `<div>🫘 حبوبات: ${keyItems.legumes.quantity} ${keyItems.legumes.unit}</div>` : ''}
                ${keyItems.canned ? `<div>🥫 کنسرو: ${keyItems.canned.quantity} ${keyItems.canned.unit}</div>` : ''}
            </div>
        </div>
    `;

    // نکات
    html += `
        <div class="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
            <h5 class="text-sm font-bold text-blue-700 mb-1">💡 نکات هوشمند</h5>
            <ul class="text-xs text-blue-600 space-y-1">
                ${tips.map(t => `<li>${t}</li>`).join('')}
            </ul>
        </div>
    `;

    if (crisisMode) {
        html += `
            <div class="mt-3 p-3 bg-red-50 rounded-xl border border-red-200">
                <p class="text-sm text-red-700">⚠️ حالت بحران: اولویت با آب، کنسرو و مواد خشک است.</p>
            </div>
        `;
    }

    html += `</div>`;
    return html;
}

// ============================================================
// دریافت جزئیات یک وعده
// ============================================================
export function getMealDetails(dayIndex, mealType, plan) {
    if (!plan || !plan[dayIndex]) return null;
    const day = plan[dayIndex];
    const meal = day.meals[mealType];
    if (!meal) return null;
    return {
        dayName: day.dayName,
        date: day.date,
        mealType: mealType,
        mealName: meal.name,
        ingredients: meal.ingredients,
        cook_time: meal.cook_time,
        servings: meal.servings,
        dayIndex: dayIndex
    };
}
