// modules/consumption-planner.js
import { store } from './store.js';

let recipesCache = [];

async function loadRecipes() {
    if (recipesCache.length > 0) return recipesCache;
    try {
        const response = await fetch('assets/data/recipes.json');
        if (!response.ok) throw new Error('recipes.json پیدا نشد');
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
            mealType: 'ناهار',
            ingredients: [
                { name: 'عدس', quantity: 0.05, unit: 'کیلوگرم' },
                { name: 'برنج', quantity: 0.1, unit: 'کیلوگرم' },
                { name: 'پیاز', quantity: 0.02, unit: 'کیلوگرم' },
                { name: 'روغن', quantity: 0.02, unit: 'لیتر' }
            ],
            servings: 4,
            cook_time: 45,
            difficulty: 'آسان',
            tags: ['گیاهی', 'ارزان', 'سریع']
        },
        {
            id: 2,
            name: 'ماکارونی با رب',
            category: 'پاستا',
            mealType: 'ناهار',
            ingredients: [
                { name: 'ماکارونی', quantity: 0.15, unit: 'کیلوگرم' },
                { name: 'رب گوجه', quantity: 0.01, unit: 'کیلوگرم' },
                { name: 'روغن', quantity: 0.02, unit: 'لیتر' }
            ],
            servings: 4,
            cook_time: 30,
            difficulty: 'آسان',
            tags: ['سریع', 'ارزان']
        },
        {
            id: 3,
            name: 'املت ساده',
            category: 'صبحانه',
            mealType: 'صبحانه',
            ingredients: [
                { name: 'تخم‌مرغ', quantity: 2, unit: 'عدد' },
                { name: 'روغن', quantity: 0.02, unit: 'لیتر' },
                { name: 'نمک', quantity: 0.002, unit: 'کیلوگرم' }
            ],
            servings: 2,
            cook_time: 10,
            difficulty: 'آسان',
            tags: ['سریع', 'صبحانه']
        },
        {
            id: 4,
            name: 'نان و پنیر',
            category: 'صبحانه',
            mealType: 'صبحانه',
            ingredients: [
                { name: 'نان', quantity: 0.2, unit: 'کیلوگرم' },
                { name: 'پنیر', quantity: 0.05, unit: 'کیلوگرم' }
            ],
            servings: 4,
            cook_time: 5,
            difficulty: 'آسان',
            tags: ['سریع', 'صبحانه']
        },
        {
            id: 5,
            name: 'سوپ جو',
            category: 'سوپ',
            mealType: 'شام',
            ingredients: [
                { name: 'جو', quantity: 0.05, unit: 'کیلوگرم' },
                { name: 'سبزی', quantity: 0.01, unit: 'کیلوگرم' },
                { name: 'پیاز', quantity: 0.02, unit: 'کیلوگرم' }
            ],
            servings: 4,
            cook_time: 30,
            difficulty: 'آسان',
            tags: ['سبک', 'سریع']
        },
        {
            id: 6,
            name: 'قورمه سبزی',
            category: 'خورش',
            mealType: 'ناهار',  // ✅ فقط ناهار
            ingredients: [
                { name: 'سبزی قورمه', quantity: 0.5, unit: 'کیلوگرم' },
                { name: 'گوشت', quantity: 0.3, unit: 'کیلوگرم' },
                { name: 'لوبیا قرمز', quantity: 0.1, unit: 'کیلوگرم' },
                { name: 'پیاز', quantity: 0.05, unit: 'کیلوگرم' },
                { name: 'روغن', quantity: 0.03, unit: 'لیتر' }
            ],
            servings: 4,
            cook_time: 120,
            difficulty: 'متوسط',
            tags: ['سنتی', 'خورش']
        }
    ];
}

function getFamilySize() {
    return store.currentUserProfile?.familySize || 4;
}

function getInventory() {
    return store.inventory || [];
}

function calculateServings(recipe, inventory, familySize) {
    let maxServings = Infinity;
    for (let ingredient of recipe.ingredients) {
        let available = 0;
        const inventoryItem = inventory.find(item => 
            item.name.includes(ingredient.name) || ingredient.name.includes(item.name)
        );
        if (inventoryItem) {
            if (inventoryItem.unit === ingredient.unit) {
                available = inventoryItem.quantity;
            } else {
                const conversion = { 
                    'کیلوگرم': { 'گرم': 1000 }, 
                    'لیتر': { 'میلی‌لیتر': 1000 }, 
                    'عدد': { 'عدد': 1 }, 
                    'بسته': { 'بسته': 1 } 
                };
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

export async function getAlternativeMeal(mealType, dayIndex) {
    const familySize = getFamilySize();
    const inventory = getInventory();
    if (inventory.length === 0) return 'غذای ساده';
    if (typeof puter === 'undefined' || !navigator.onLine) {
        const fallback = {
            'صبحانه': ['نان و پنیر', 'تخم‌مرغ', 'حلیم'],
            'ناهار': ['عدسی', 'ماکارونی', 'کتلت'],
            'شام': ['سوپ', 'املت', 'نان و کره']
        };
        const options = fallback[mealType] || ['غذای ساده'];
        return options[dayIndex % options.length];
    }
    const inventoryList = inventory.map(item => 
        `- ${item.name}: ${item.quantity} ${item.unit}`
    ).join('\n');
    const prompt = `
بر اساس موجودی زیر، یک غذای مناسب برای وعده ${mealType} پیشنهاد بده.
موجودی: ${inventoryList}
تعداد اعضای خانواده: ${familySize} نفر
فقط نام غذا را بگو، بدون توضیح.
`;
    try {
        const response = await puter.ai.chat(prompt, { model: "gpt-4o-mini", temperature: 0.7 });
        let result = '';
        if (typeof response === 'string') result = response;
        else if (response?.message?.content) result = response.message.content;
        else result = 'غذای ساده';
        return result.trim();
    } catch (error) {
        console.error('❌ خطا:', error);
        return 'غذای ساده';
    }
}

export async function generateWeeklyPlan(days = 7, startDate = null) {
    const familySize = getFamilySize();
    const inventory = getInventory();
    const crisisMode = store.crisisMode;
    const recipes = await loadRecipes();

    const recipeAvailability = recipes.map(recipe => ({
        ...recipe,
        servings: calculateServings(recipe, inventory, familySize),
        isAvailable: calculateServings(recipe, inventory, familySize) > 0
    }));

    let availableRecipes = recipeAvailability.filter(r => r.isAvailable);
    if (availableRecipes.length === 0) {
        availableRecipes = recipeAvailability.slice(0, 5).map(r => ({ ...r, servings: 1, isAvailable: true }));
    }

    // دسته‌بندی بر اساس وعده با اولویت mealType
    const breakfastOptions = availableRecipes.filter(r => r.mealType === 'صبحانه');
    const lunchOptions = availableRecipes.filter(r => r.mealType === 'ناهار' || r.category === 'خورش' || r.category === 'پلو' || r.category === 'پاستا');
    const dinnerOptions = availableRecipes.filter(r => r.mealType === 'شام' || r.category === 'سوپ' || r.category === 'نان' || (r.tags && r.tags.includes('سریع')));

    // اگر گزینه خاصی نبود، از همه غذاها استفاده کن
    const allMeals = availableRecipes;

    function selectMeal(mealType, dayIndex, usedMeals) {
        let pool;
        if (mealType === 'صبحانه') pool = breakfastOptions.length > 0 ? breakfastOptions : allMeals;
        else if (mealType === 'ناهار') pool = lunchOptions.length > 0 ? lunchOptions : allMeals;
        else pool = dinnerOptions.length > 0 ? dinnerOptions : allMeals;

        // جلوگیری از تکرار غذا در روزهای مختلف
        const availablePool = pool.filter(recipe => !usedMeals.includes(recipe.id));
        if (availablePool.length === 0) {
            // اگر همه غذاها استفاده شدند، دوباره از اول شروع کن
            return pool[dayIndex % pool.length];
        }
        return availablePool[dayIndex % availablePool.length];
    }

    const start = startDate ? new Date(startDate) : new Date();
    const daysOfWeek = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
    let plan = [];
    let usedMeals = [];

    // محاسبه حداکثر روزهای ممکن بر اساس حداقل تعداد سروینگ در بین غذاهای موجود
    let maxPossibleDays = Infinity;
    availableRecipes.forEach(r => {
        if (r.servings < maxPossibleDays) maxPossibleDays = r.servings;
    });
    const maxDays = Math.min(days, maxPossibleDays || 7);

    for (let i = 0; i < maxDays; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const dayName = daysOfWeek[date.getDay()] || 'روز';
        const dayPlan = {
            day: i + 1,
            date: date.toISOString().slice(0, 10),
            dayName: dayName,
            meals: {}
        };
        ['صبحانه', 'ناهار', 'شام'].forEach(type => {
            const meal = selectMeal(type, i, usedMeals);
            dayPlan.meals[type] = meal;
            usedMeals.push(meal.id);
        });
        plan.push(dayPlan);
    }

    // نکات بهینه‌سازی
    const tips = [];
    const expiringItems = inventory.filter(item => {
        if (!item.expiry) return false;
        const daysLeft = (new Date(item.expiry) - new Date()) / (1000 * 60 * 60 * 24);
        return daysLeft >= 0 && daysLeft <= 3;
    });
    if (expiringItems.length > 0) {
        tips.push(`⏰ مواد در حال انقضا: ${expiringItems.map(i => i.name).join('، ')}`);
    }
    const waterItem = inventory.find(i => i.name.includes('آب'));
    if (waterItem) {
        const daysLeft = waterItem.quantity / (familySize * 2);
        if (daysLeft < 7) tips.push(`💧 آب برای ${Math.floor(daysLeft)} روز کافی است.`);
    }
    if (crisisMode) tips.push('⚠️ حالت بحران فعال است.');
    if (tips.length === 0) tips.push('✅ وضعیت ذخایر مناسب است.');

    // استخراج کلیدهای اصلی موجودی
    const keyItems = {
        water: waterItem ? { quantity: waterItem.quantity, unit: waterItem.unit } : null,
        rice: inventory.find(i => i.name.includes('برنج')),
        legumes: inventory.find(i => i.name.includes('عدس') || i.name.includes('لوبیا') || i.name.includes('نخود')),
        canned: inventory.find(i => i.name.includes('کنسرو'))
    };

    return { plan, maxDays, totalDays: maxDays, tips, keyItems, crisisMode, availableRecipes };
}

export async function generateConsumptionPlan(days = 7, startDate = null) {
    try {
        const result = await generateWeeklyPlan(days, startDate);
        const { plan, maxDays, tips, keyItems, crisisMode } = result;
        window.currentPlanData = result;

        const mealIcons = { صبحانه: '🌅', ناهار: '🌞', شام: '🌙' };

        let html = `
            <div class="consumption-plan">
                <div class="flex justify-between items-center mb-4">
                    <h4 class="text-lg font-bold text-primary">📅 برنامه مصرف (${maxDays} روز)</h4>
                    <span class="text-sm text-gray-500">${crisisMode ? '⚠️ بحران' : '🌿 عادی'}</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        `;

        plan.forEach((day, idx) => {
            html += `
                <div class="day-card bg-white rounded-xl p-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-bold text-sm text-primary">${day.dayName}</span>
                        <span class="text-xs text-gray-400">${day.date}</span>
                    </div>
                    <div class="space-y-1 text-sm">
            `;
            ['صبحانه', 'ناهار', 'شام'].forEach(type => {
                const meal = day.meals[type];
                if (meal) {
                    html += `
                        <div class="meal-item cursor-pointer hover:bg-blue-50 p-1 rounded transition-colors flex justify-between items-center" 
                             data-day-index="${idx}" data-meal-type="${type}" data-meal-name="${meal.name}">
                            <span><span class="font-medium">${mealIcons[type]} ${type}:</span> ${meal.name}</span>
                            <span class="text-xs text-gray-400">⏱️ ${meal.cook_time || '?'} دقیقه</span>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="text-gray-400 text-xs">${mealIcons[type]} ${type}: —</div>
                    `;
                }
            });
            html += `
                    </div>
                </div>
            `;
        });

        html += `</div>`;

        // خلاصه ذخایر کلیدی (حتی اگر خالی باشد، پیام نمایش دهد)
        html += `
            <div class="mt-4 p-3 bg-gray-50 rounded-xl">
                <h5 class="text-sm font-bold text-gray-700 mb-2">📊 خلاصه ذخایر کلیدی</h5>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    ${keyItems.water ? `<div>💧 آب: ${keyItems.water.quantity} ${keyItems.water.unit}</div>` : '<div>💧 آب: ثبت نشده</div>'}
                    ${keyItems.rice ? `<div>🍚 برنج: ${keyItems.rice.quantity} ${keyItems.rice.unit}</div>` : '<div>🍚 برنج: ثبت نشده</div>'}
                    ${keyItems.legumes ? `<div>🫘 حبوبات: ${keyItems.legumes.quantity} ${keyItems.legumes.unit}</div>` : '<div>🫘 حبوبات: ثبت نشده</div>'}
                    ${keyItems.canned ? `<div>🥫 کنسرو: ${keyItems.canned.quantity} ${keyItems.canned.unit}</div>` : '<div>🥫 کنسرو: ثبت نشده</div>'}
                </div>
            </div>
        `;

        if (tips && tips.length > 0) {
            html += `
                <div class="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                    <h5 class="text-sm font-bold text-blue-700 mb-1">💡 نکات هوشمند</h5>
                    <ul class="text-xs text-blue-600 space-y-1">
                        ${tips.map(t => `<li>${t}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        if (crisisMode) {
            html += `
                <div class="mt-3 p-3 bg-red-50 rounded-xl border border-red-200">
                    <p class="text-sm text-red-700">⚠️ حالت بحران فعال است.</p>
                </div>
            `;
        }

        html += `</div>`;
        return html;
    } catch (error) {
        console.error('❌ خطا:', error);
        return `
            <div class="text-center text-red-400 py-8">
                <i class="fas fa-exclamation-triangle text-3xl block mb-2"></i>
                خطا در تولید برنامه مصرف.
            </div>
        `;
    }
}

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
