// modules/recipe-planner.js
import { store } from './store.js';

function getFamilySize() {
    return store.currentUserProfile?.familySize || 4;
}

function getInventory() {
    return store.inventory || [];
}

let recipes = [];

// ============================================================
// بارگذاری دستور پخت‌ها از فایل JSON
// ============================================================
export async function loadRecipes() {
    try {
        const response = await fetch('assets/data/recipes.json');
        if (!response.ok) {
            throw new Error('فایل recipes.json پیدا نشد');
        }
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
// بررسی اینکه آیا یک دستور پخت با موجودی قابل تهیه است
// ============================================================
function canMakeRecipe(recipe) {
    const inventory = getInventory();
    
    for (let ing of recipe.ingredients) {
        // پیدا کردن ماده در انبار
        const inventoryItem = inventory.find(item => 
            item.name.toLowerCase().includes(ing.name.toLowerCase()) ||
            ing.name.toLowerCase().includes(item.name.toLowerCase())
        );
        
        if (!inventoryItem) {
            return false; // ماده در انبار نیست
        }
        
        // بررسی مقدار کافی
        if (inventoryItem.quantity < ing.quantity) {
            return false; // مقدار کافی نیست
        }
    }
    return true;
}

// ============================================================
// دریافت دستور پخت‌های قابل تهیه بر اساس دسته‌بندی
// ============================================================
function getAvailableRecipesByCategory(category = null) {
    if (recipes.length === 0) {
        console.warn('⚠️ هیچ دستور پختی بارگذاری نشده است.');
        return [];
    }
    
    let available = recipes.filter(recipe => canMakeRecipe(recipe));
    
    if (category) {
        available = available.filter(recipe => recipe.category === category);
    }
    
    return available;
}

// ============================================================
// تولید برنامه مصرف بر اساس Recipe
// ============================================================
export async function generateConsumptionPlan(days = 7, startDate = null) {
    // اطمینان از بارگذاری دستور پخت‌ها
    if (recipes.length === 0) {
        await loadRecipes();
    }

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

    // ===== تولید برنامه =====
    const plan = generatePlanFromRecipes(days, familySize, crisisMode);
    
    if (plan.length === 0) {
        return `
            <div class="text-center text-gray-400 py-8">
                <i class="fas fa-exclamation-triangle text-3xl block mb-3 opacity-50"></i>
                <p>با موجودی فعلی، هیچ دستور پختی قابل تهیه نیست.</p>
                <p class="text-sm mt-2">لطفاً مواد غذایی بیشتری اضافه کنید.</p>
            </div>
        `;
    }

    return renderPlanCards(plan, days);
}

// ============================================================
// تولید برنامه از دستور پخت‌ها
// ============================================================
function generatePlanFromRecipes(days, familySize, crisisMode) {
    const daysOfWeek = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
    const start = new Date();
    
    // ===== دسته‌بندی دستور پخت‌های قابل تهیه =====
    const breakfastRecipes = getAvailableRecipesByCategory('صبحانه');
    const lunchRecipes = getAvailableRecipesByCategory('ناهار');
    const dinnerRecipes = getAvailableRecipesByCategory('شام');
    
    // اگر دستور پختی در دسته‌بندی نبود، از همه استفاده کن
    const allRecipes = getAvailableRecipesByCategory();
    
    const getMeal = (category) => {
        let recipesList = [];
        if (category === 'صبحانه') recipesList = breakfastRecipes.length > 0 ? breakfastRecipes : allRecipes;
        else if (category === 'ناهار') recipesList = lunchRecipes.length > 0 ? lunchRecipes : allRecipes;
        else if (category === 'شام') recipesList = dinnerRecipes.length > 0 ? dinnerRecipes : allRecipes;
        
        if (recipesList.length === 0) {
            return { name: 'غذای ساده', ingredients: [], cook_time: 15 };
        }
        
        // انتخاب تصادفی از لیست
        const randomIndex = Math.floor(Math.random() * recipesList.length);
        const recipe = recipesList[randomIndex];
        return {
            name: recipe.name,
            ingredients: recipe.ingredients || [],
            cook_time: recipe.cook_time || 30
        };
    };

    // ===== ساخت برنامه =====
    let plan = [];
    const maxDays = Math.min(days, 30);

    for (let i = 0; i < maxDays; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const dayName = daysOfWeek[date.getDay()] || 'روز';
        
        // در حالت بحران، غذاها را ساده‌تر می‌کنیم (فقط از اولین گزینه استفاده کن)
        let breakfast, lunch, dinner;
        if (crisisMode) {
            const crisisRecipes = allRecipes.slice(0, 3);
            breakfast = {
                name: crisisRecipes[0]?.name || 'نان و پنیر',
                ingredients: [],
                cook_time: 10
            };
            lunch = {
                name: crisisRecipes[1]?.name || 'سوپ',
                ingredients: [],
                cook_time: 20
            };
            dinner = {
                name: crisisRecipes[2]?.name || 'املت',
                ingredients: [],
                cook_time: 15
            };
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
                صبحانه: { name: breakfast.name, ingredients: breakfast.ingredients, cook_time: breakfast.cook_time },
                ناهار: { name: lunch.name, ingredients: lunch.ingredients, cook_time: lunch.cook_time },
                شام: { name: dinner.name, ingredients: dinner.ingredients, cook_time: dinner.cook_time }
            }
        });
    }

    return plan;
}

// ============================================================
// رندر کارت‌های برنامه
// ============================================================
function renderPlanCards(plan, days) {
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
                const ingredientList = meal.ingredients && meal.ingredients.length > 0 
                    ? meal.ingredients.map(i => i.name).join('، ')
                    : '';
                html += `
                    <div class="meal-item flex justify-between items-center p-1 rounded hover:bg-blue-50 transition-colors cursor-pointer" 
                         data-day-index="${idx}" data-meal-type="${type}" data-meal-name="${meal.name}"
                         onclick="window.showMealDetails(${idx}, '${type}')">
                        <span>
                            <span class="font-medium">${mealIcons[type]} ${type}:</span> 
                            ${meal.name}
                            ${ingredientList ? `<span class="text-xs text-gray-400"> (${ingredientList})</span>` : ''}
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
            <div class="mt-3 p-3 bg-green-50 rounded-xl border border-green-200 text-xs text-green-600">
                ✅ برنامه بر اساس دستور پخت‌های موجود و موجودی انبار تولید شده است.
            </div>
        </div>
    `;

    return html;
}

// ============================================================
// دریافت پیشنهاد جایگزین (با استفاده از Recipe)
// ============================================================
export async function getAlternativeMeal(mealType, dayIndex) {
    const allRecipes = getAvailableRecipesByCategory();
    const categoryRecipes = getAvailableRecipesByCategory(mealType === 'صبحانه' ? 'صبحانه' : 
                                                         mealType === 'ناهار' ? 'ناهار' : 'شام');
    
    const options = categoryRecipes.length > 0 ? categoryRecipes : allRecipes;
    
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
        dayIndex: dayIndex
    };
}
