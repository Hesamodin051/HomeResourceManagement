// modules/recipe-planner.js
import { store } from './store.js';

function getFamilySize() {
    return store.currentUserProfile?.familySize || 4;
}

function getInventory() {
    return store.inventory || [];
}

let recipes = [];
let shoppingList = [];

// ============================================================
// بارگذاری دستور پخت‌ها
// ============================================================
export async function loadRecipes() {
    try {
        const response = await fetch('assets/data/recipes.json');
        if (!response.ok) throw new Error('فایل recipes.json پیدا نشد');
        recipes = await response.json();
        console.log('✅ دستور پخت‌ها بارگذاری شدند:', recipes.length);
        return recipes;
    } catch (error) {
        console.error('❌ خطا در بارگذاری recipes.json:', error);
        recipes = [];
        return [];
    }
}

// ============================================================
// نرمال‌سازی نام
// ============================================================
function normalizeName(name) {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isIngredientAvailable(ingredientName) {
    const inventory = getInventory();
    const normalizedIng = normalizeName(ingredientName);
    return inventory.some(item => {
        const normalizedItem = normalizeName(item.name);
        return normalizedItem.includes(normalizedIng) || normalizedIng.includes(normalizedItem);
    });
}

function analyzeRecipe(recipe) {
    if (!recipe.ingredients || recipe.ingredients.length === 0) {
        return { available: false, missing: [], hasAll: false };
    }
    const missing = [];
    for (let ing of recipe.ingredients) {
        if (!isIngredientAvailable(ing.name)) {
            missing.push(ing.name);
        }
    }
    const hasAll = missing.length === 0;
    const available = missing.length <= 2;
    return { available, missing, hasAll };
}

function getAvailableRecipesByCategory(category = null) {
    if (recipes.length === 0) return [];
    const analyzed = recipes.map(recipe => ({ ...recipe, ...analyzeRecipe(recipe) }));
    let filtered = analyzed;
    if (category) filtered = filtered.filter(r => r.category === category);
    const available = filtered.filter(r => r.available);
    console.log(`📋 رسپی‌های قابل تهیه (دسته ${category || 'همه'}):`, available.map(r => r.name).join(', '));
    return available;
}

// ============================================================
// تولید برنامه جدید (فقط در صورت نیاز)
// ============================================================
export async function generateConsumptionPlan(days = 7, startDate = null, existingPlan = null) {
    if (recipes.length === 0) await loadRecipes();

    const inventory = getInventory();
    const familySize = getFamilySize();
    const crisisMode = store.crisisMode;

    if (inventory.length === 0) {
        return `
            <div class="text-center text-gray-400 py-8">
                <i class="fas fa-utensils text-5xl block mb-3 opacity-50"></i>
                <p>هیچ ماده غذایی ثبت نشده است.</p>
                <p class="text-sm mt-2">لطفاً ابتدا مواد غذایی خود را ثبت کنید.</p>
            </div>
        `;
    }

    if (recipes.length === 0) {
        return `
            <div class="text-center text-yellow-400 py-8">
                <i class="fas fa-exclamation-triangle text-5xl block mb-3 opacity-50"></i>
                <p>هیچ دستور پختی در سیستم ثبت نشده است.</p>
                <p class="text-sm mt-2">لطفاً فایل recipes.json را بررسی کنید.</p>
            </div>
        `;
    }

    let plan;
    if (existingPlan && Array.isArray(existingPlan) && existingPlan.length > 0) {
        // استفاده از برنامه‌ی موجود
        plan = existingPlan;
        console.log('♻️ بازرندر با برنامه‌ی موجود');
    } else {
        // تولید برنامه‌ی جدید
        plan = generatePlanFromRecipes(days, familySize, crisisMode);
        if (plan.length === 0 || plan.every(day => day.meals.صبحانه.name === 'غذای ساده')) {
            console.warn('⚠️ هیچ برنامه‌ای با رسپی تولید نشد، استفاده از Rule-Based');
            plan = generateFallbackPlanData(days, familySize);
        }
        // فقط در تولید جدید، لیست خرید ساخته شود
        shoppingList = generateShoppingList(plan);
    }

    return renderPlanCards(plan, days);
}

// ============================================================
// تولید برنامه از دستور پخت‌ها
// ============================================================
function generatePlanFromRecipes(days, familySize, crisisMode) {
    const daysOfWeek = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
    const start = new Date();
    const allAvailable = getAvailableRecipesByCategory();
    const breakfastAvailable = getAvailableRecipesByCategory('صبحانه');
    const lunchAvailable = getAvailableRecipesByCategory('ناهار');
    const dinnerAvailable = getAvailableRecipesByCategory('شام');
    if (allAvailable.length === 0) return generateFallbackPlanData(days, familySize);

    const getMeal = (category) => {
        let recipesList = [];
        if (category === 'صبحانه') recipesList = breakfastAvailable.length > 0 ? breakfastAvailable : allAvailable;
        else if (category === 'ناهار') recipesList = lunchAvailable.length > 0 ? lunchAvailable : allAvailable;
        else if (category === 'شام') recipesList = dinnerAvailable.length > 0 ? dinnerAvailable : allAvailable;
        if (recipesList.length === 0) recipesList = allAvailable;
        const randomIndex = Math.floor(Math.random() * recipesList.length);
        const recipe = recipesList[randomIndex];
        return {
            name: recipe.name,
            ingredients: recipe.ingredients || [],
            cook_time: recipe.cook_time || 30,
            missing: recipe.missing || [],
            hasAll: recipe.hasAll || false
        };
    };

    let plan = [];
    const maxDays = Math.min(days, 30);
    for (let i = 0; i < maxDays; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const dayName = daysOfWeek[date.getDay()] || 'روز';
        let breakfast, lunch, dinner;
        if (crisisMode) {
            const crisisRecipes = allAvailable.sort((a, b) => a.missing.length - b.missing.length).slice(0, 3);
            breakfast = crisisRecipes[0] || { name: 'غذای ساده', ingredients: [], cook_time: 10, missing: [], hasAll: true };
            lunch = crisisRecipes[1] || { name: 'غذای ساده', ingredients: [], cook_time: 20, missing: [], hasAll: true };
            dinner = crisisRecipes[2] || { name: 'غذای ساده', ingredients: [], cook_time: 15, missing: [], hasAll: true };
        } else {
            breakfast = getMeal('صبحانه');
            lunch = getMeal('ناهار');
            dinner = getMeal('شام');
        }
        plan.push({
            day: i + 1,
            date: date.toISOString().slice(0, 10),
            dayName: dayName,
            meals: {
                صبحانه: { name: breakfast.name, ingredients: breakfast.ingredients, cook_time: breakfast.cook_time, missing: breakfast.missing || [], hasAll: breakfast.hasAll },
                ناهار: { name: lunch.name, ingredients: lunch.ingredients, cook_time: lunch.cook_time, missing: lunch.missing || [], hasAll: lunch.hasAll },
                شام: { name: dinner.name, ingredients: dinner.ingredients, cook_time: dinner.cook_time, missing: dinner.missing || [], hasAll: dinner.hasAll }
            }
        });
    }
    return plan;
}

// ============================================================
// داده‌های Rule-Based برای مواقع ضروری
// ============================================================
function generateFallbackPlanData(days, familySize) {
    const daysOfWeek = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
    const start = new Date();
    const mealOptions = {
        صبحانه: ['نان و پنیر', 'تخم‌مرغ', 'حلیم', 'فرنی'],
        ناهار: ['برنج و خورش', 'ماکارونی', 'کتلت', 'عدسی'],
        شام: ['سوپ', 'املت', 'نان و کره', 'شیر']
    };
    let plan = [];
    for (let i = 0; i < Math.min(days, 7); i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const dayName = daysOfWeek[date.getDay()] || 'روز';
        plan.push({
            day: i + 1,
            date: date.toISOString().slice(0, 10),
            dayName: dayName,
            meals: {
                صبحانه: { name: mealOptions.صبحانه[i % mealOptions.صبحانه.length], ingredients: [], cook_time: 10, missing: [], hasAll: true },
                ناهار: { name: mealOptions.ناهار[i % mealOptions.ناهار.length], ingredients: [], cook_time: 45, missing: [], hasAll: true },
                شام: { name: mealOptions.شام[i % mealOptions.شام.length], ingredients: [], cook_time: 20, missing: [], hasAll: true }
            }
        });
    }
    return plan;
}

// ============================================================
// تولید لیست خرید
// ============================================================
function generateShoppingList(plan) {
    const allMissing = {};
    plan.forEach(day => {
        ['صبحانه', 'ناهار', 'شام'].forEach(mealType => {
            const meal = day.meals[mealType];
            if (meal && meal.missing && meal.missing.length > 0) {
                meal.missing.forEach(item => {
                    allMissing[item] = (allMissing[item] || 0) + 1;
                });
            }
        });
    });
    return Object.entries(allMissing).map(([name, count]) => ({ name, count }));
}

// ============================================================
// رندر کارت‌های برنامه (صادر شده برای استفاده در app.js)
// ============================================================
export function renderPlanCards(plan, days) {
    const mealIcons = { صبحانه: '🌅', ناهار: '🌞', شام: '🌙' };
    const daysOfWeek = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

    window.currentPlanData = { plan, maxDays: plan.length };

    let html = `
        <div class="consumption-plan">
            <div class="flex justify-between items-center mb-4">
                <h4 class="text-lg font-bold text-primary">📅 برنامه مصرف (${plan.length} روز)</h4>
                <span class="text-sm text-gray-500">🍽️ بر اساس دستور پخت</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    `;

    plan.forEach((day, idx) => {
        const date = new Date(day.date);
        const dayName = daysOfWeek[date.getDay()] || 'روز';
        html += `
            <div class="day-card bg-white rounded-xl p-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-sm text-primary">${dayName}</span>
                    <span class="text-xs text-gray-400">${day.date}</span>
                </div>
                <div class="space-y-1 text-sm">
        `;
        ['صبحانه', 'ناهار', 'شام'].forEach(type => {
            const meal = day.meals[type];
            if (meal) {
                const isComplete = meal.hasAll || meal.missing?.length === 0;
                const missingText = (meal.missing && meal.missing.length > 0) 
                    ? `<span class="text-xs text-red-500"> (کمبود: ${meal.missing.join('، ')})</span>` 
                    : '';
                html += `
                    <div class="meal-item flex justify-between items-center p-1 rounded hover:bg-blue-50 transition-colors cursor-pointer" 
                         data-day-index="${idx}" data-meal-type="${type}" data-meal-name="${meal.name}"
                         onclick="window.showMealDetails(${idx}, '${type}')">
                        <span>
                            <span class="font-medium">${mealIcons[type]} ${type}:</span> 
                            ${meal.name}
                            ${!isComplete ? '⚠️' : '✅'}
                            ${missingText}
                        </span>
                        <span class="text-xs text-gray-400">⏱️ ${meal.cook_time || '?'} دقیقه</span>
                    </div>
                `;
            }
        });
        html += `
                </div>
            </div>
        `;
    });

    html += `
            </div>
    `;

    if (shoppingList && shoppingList.length > 0) {
        html += `
            <div class="mt-4 p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                <h5 class="text-sm font-bold text-yellow-700 mb-2">🛒 لیست خرید پیشنهادی:</h5>
                <ul class="text-xs text-yellow-700 list-disc list-inside">
                    ${shoppingList.map(item => `<li>${item.name} (${item.count} بار نیاز است)</li>`).join('')}
                </ul>
                <p class="text-xs text-yellow-600 mt-1">این مواد برای تکمیل غذاهای پیشنهادی نیاز است.</p>
            </div>
        `;
    }

    html += `
            <div class="mt-3 p-3 bg-green-50 rounded-xl border border-green-200 text-xs text-green-600">
                ✅ برنامه بر اساس دستور پخت‌های موجود و موجودی انبار تولید شده است.
                ${shoppingList && shoppingList.length > 0 ? ' ⚠️ برخی مواد کمبود دارند، لیست خرید در بالا نمایش داده شده است.' : ''}
            </div>
        </div>
    `;

    return html;
}

// ============================================================
// دریافت پیشنهاد جایگزین (برای یک وعده)
// ============================================================
export async function getAlternativeMeal(mealType, dayIndex) {
    const allAvailable = getAvailableRecipesByCategory();
    const category = mealType === 'صبحانه' ? 'صبحانه' : mealType === 'ناهار' ? 'ناهار' : 'شام';
    const categoryRecipes = getAvailableRecipesByCategory(category);
    const options = categoryRecipes.length > 0 ? categoryRecipes : allAvailable;
    if (options.length === 0) {
        const fallback = {
            'صبحانه': ['نان و پنیر', 'تخم‌مرغ', 'حلیم'],
            'ناهار': ['عدسی', 'ماکارونی', 'کتلت'],
            'شام': ['سوپ', 'املت', 'نان و کره']
        };
        return fallback[mealType]?.[dayIndex % 3] || 'غذای ساده';
    }
    const selected = options[dayIndex % options.length];
    return selected.name;
}

// ============================================================
// دریافت جزئیات یک وعده (برای مدال)
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
        ingredients: meal.ingredients || [{ name: meal.name, quantity: 1, unit: 'واحد' }],
        cook_time: meal.cook_time || 30,
        servings: getFamilySize(),
        dayIndex: dayIndex,
        missing: meal.missing || [],
        hasAll: meal.hasAll !== undefined ? meal.hasAll : true
    };
}
