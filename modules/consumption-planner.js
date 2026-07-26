// modules/consumption-planner.js
import { store } from './store.js';
import { generateConsumptionPlanAI, getAlternativeMealAI } from './ai-fallback.js';

function getFamilySize() {
    return store.currentUserProfile?.familySize || 4;
}

function getInventory() {
    return store.inventory || [];
}

function isOnline() {
    return navigator.onLine;
}

// ============================================================
// تولید برنامه مصرف با هوش مصنوعی (با jsllm7)
// ============================================================
export async function generateConsumptionPlan(days = 7, startDate = null) {
    const familySize = getFamilySize();
    const inventory = getInventory();
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

    if (!isOnline()) {
        return generateFallbackPlan(days, familySize);
    }

    const inventoryList = inventory.map(item => 
        `- ${item.name}: ${item.quantity} ${item.unit}${item.expiry ? ' (انقضا: ' + item.expiry + ')' : ''}`
    ).join('\n');

    try {
        const result = await generateConsumptionPlanAI(days, inventoryList, familySize, crisisMode);
        
        if (!result) {
            throw new Error('پاسخی از AI دریافت نشد');
        }

        return processAIResponseToCards(result, days, familySize);

    } catch (error) {
        console.error('❌ خطا در ارتباط با AI:', error);
        return generateFallbackPlan(days, familySize);
    }
}

// ============================================================
// پردازش پاسخ AI به کارت‌های تعاملی
// ============================================================
function processAIResponseToCards(aiResponse, days, familySize) {
    const lines = aiResponse.split('\n').filter(line => line.trim() !== '');
    const mealIcons = { صبحانه: '🌅', ناهار: '🌞', شام: '🌙' };
    const daysOfWeek = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
    const start = new Date();
    
    let plan = [];
    let currentDay = null;
    let currentMeals = {};

    for (let line of lines) {
        const dayMatch = line.match(/روز\s*(\d+)\s*\(([^)]+)\)/);
        if (dayMatch) {
            if (currentDay !== null) {
                plan.push({ day: currentDay, meals: { ...currentMeals } });
            }
            currentDay = parseInt(dayMatch[1]);
            currentMeals = {};
            continue;
        }
        const mealMatch = line.match(/(صبحانه|ناهار|شام)\s*:\s*(.+)/);
        if (mealMatch && currentDay !== null) {
            const type = mealMatch[1];
            const name = mealMatch[2].trim();
            currentMeals[type] = { name, cook_time: Math.floor(Math.random() * 30 + 15) };
        }
    }
    if (currentDay !== null && Object.keys(currentMeals).length > 0) {
        plan.push({ day: currentDay, meals: { ...currentMeals } });
    }

    if (plan.length === 0) {
        return generateFallbackPlan(days, familySize);
    }

    window.currentPlanData = { plan, maxDays: plan.length };

    let html = `
        <div class="consumption-plan">
            <div class="flex justify-between items-center mb-4">
                <h4 class="text-lg font-bold text-primary">📅 برنامه مصرف (${plan.length} روز)</h4>
                <span class="text-sm text-gray-500">🤖 هوش مصنوعی</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    `;

    plan.forEach((day, idx) => {
        const date = new Date(start);
        date.setDate(start.getDate() + idx);
        const dayName = daysOfWeek[date.getDay()] || 'روز';
        html += `
            <div class="day-card bg-white rounded-xl p-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-sm text-primary">${dayName}</span>
                    <span class="text-xs text-gray-400">${date.toISOString().slice(0, 10)}</span>
                </div>
                <div class="space-y-1 text-sm">
        `;
        ['صبحانه', 'ناهار', 'شام'].forEach(type => {
            const meal = day.meals[type];
            if (meal) {
                html += `
                    <div class="meal-item flex justify-between items-center p-1 rounded hover:bg-blue-50 transition-colors" 
                         data-day-index="${idx}" data-meal-type="${type}" data-meal-name="${meal.name}">
                        <span><span class="font-medium">${mealIcons[type]} ${type}:</span> ${meal.name}</span>
                        <div class="flex items-center gap-1">
                            <span class="text-xs text-gray-400">⏱️ ${meal.cook_time || '?'} دقیقه</span>
                            <button class="swap-meal-btn text-xs text-blue-500 hover:text-blue-700 ml-1" 
                                    data-day="${idx}" data-meal="${type}" data-current="${meal.name}">
                                <i class="fas fa-exchange-alt"></i>
                            </button>
                        </div>
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

    html += `
            </div>
            <div class="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-600">
                🤖 تولید شده توسط هوش مصنوعی بر اساس موجودی واقعی انبار
            </div>
        </div>
    `;

    return html;
}

// ============================================================
// برنامه پیش‌فرض (در صورت عدم دسترسی به AI)
// ============================================================
function generateFallbackPlan(days, familySize) {
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
        const dayPlan = {
            day: i + 1,
            date: date.toISOString().slice(0, 10),
            dayName: dayName,
            meals: {
                صبحانه: { name: mealOptions.صبحانه[i % mealOptions.صبحانه.length], cook_time: 10 },
                ناهار: { name: mealOptions.ناهار[i % mealOptions.ناهار.length], cook_time: 45 },
                شام: { name: mealOptions.شام[i % mealOptions.شام.length], cook_time: 20 }
            }
        };
        plan.push(dayPlan);
    }

    window.currentPlanData = { plan, maxDays: plan.length };

    const mealIcons = { صبحانه: '🌅', ناهار: '🌞', شام: '🌙' };
    let html = `
        <div class="consumption-plan">
            <div class="flex justify-between items-center mb-4">
                <h4 class="text-lg font-bold text-primary">📅 برنامه مصرف (${plan.length} روز)</h4>
                <span class="text-sm text-gray-500">📋 پیش‌فرض (آفلاین)</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    `;

    plan.forEach((day, idx) => {
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
                <div class="meal-item flex justify-between items-center p-1 rounded hover:bg-blue-50 transition-colors" 
                     data-day-index="${idx}" data-meal-type="${type}" data-meal-name="${meal.name}">
                    <span><span class="font-medium">${mealIcons[type]} ${type}:</span> ${meal.name}</span>
                    <div class="flex items-center gap-1">
                        <span class="text-xs text-gray-400">⏱️ ${meal.cook_time} دقیقه</span>
                        <button class="swap-meal-btn text-xs text-blue-500 hover:text-blue-700 ml-1" 
                                data-day="${idx}" data-meal="${type}" data-current="${meal.name}">
                            <i class="fas fa-exchange-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        html += `
                </div>
            </div>
        `;
    });

    html += `
            </div>
            <div class="mt-3 p-3 bg-yellow-50 rounded-xl border border-yellow-200 text-xs text-yellow-600">
                ⚠️ حالت آفلاین: برنامه بر اساس داده‌های پیش‌فرض است. برای برنامه‌ریزی دقیق‌تر، اتصال اینترنت را برقرار کنید.
            </div>
        </div>
    `;

    return html;
}

// ============================================================
// دریافت پیشنهاد جایگزین از AI (با jsllm7)
// ============================================================
export async function getAlternativeMeal(mealType, dayIndex) {
    const familySize = getFamilySize();
    const inventory = getInventory();
    if (inventory.length === 0) return 'غذای ساده';

    if (!isOnline()) {
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

    try {
        const result = await getAlternativeMealAI(mealType, inventoryList, familySize);
        return result || 'غذای ساده';
    } catch (error) {
        console.error('❌ خطا در دریافت پیشنهاد جایگزین:', error);
        return 'غذای ساده';
    }
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
        ingredients: [{ name: meal.name, quantity: 1, unit: 'واحد' }],
        cook_time: meal.cook_time || 30,
        servings: 1,
        dayIndex: dayIndex
    };
}
