// modules/consumption-planner.js
import { store } from './store.js';

function getFamilySize() {
    return store.currentUserProfile?.familySize || 4;
}

function getInventory() {
    return store.inventory || [];
}

function isOnline() {
    return navigator.onLine && typeof puter !== 'undefined';
}

export async function generateConsumptionPlan(days = 7, startDate = null) {
    const familySize = getFamilySize();
    const inventory = getInventory();
    const crisisMode = store.crisisMode;

    if (inventory.length === 0) {
        return `<div class="text-center text-gray-400 py-8"><i class="fas fa-utensils text-5xl block mb-3"></i><p>هیچ ماده غذایی ثبت نشده است.</p><p class="text-sm mt-2">لطفاً ابتدا مواد غذایی خود را ثبت کنید.</p></div>`;
    }

    if (!isOnline()) {
        return generateFallbackPlan(days, familySize);
    }

    const inventoryList = inventory.map(item => 
        `- ${item.name}: ${item.quantity} ${item.unit}${item.expiry ? ' (انقضا: ' + item.expiry + ')' : ''}`
    ).join('\n');

    const prompt = `
بر اساس موجودی زیر، یک برنامه مصرف ${days} روزه برای خانواده ${familySize} نفره تهیه کن.

موجودی:
${inventoryList}

${crisisMode ? '⚠️ حالت بحران فعال است.' : ''}

برنامه شامل ۳ وعده در روز (صبحانه، ناهار، شام) باشد.
فقط از مواد موجود استفاده کن.

فرمت خروجی:
روز ۱ (شنبه):
صبحانه: [نام غذا]
ناهار: [نام غذا]
شام: [نام غذا]

... تا روز ${days}
`;

    try {
        const response = await puter.ai.chat(prompt, { model: "gpt-4o-mini", temperature: 0.7 });
        let result = typeof response === 'string' ? response : response.message?.content || '';
        if (!result) return generateFallbackPlan(days, familySize);
        return processAIResponse(result, days);
    } catch (error) {
        console.error('❌ خطا:', error);
        return generateFallbackPlan(days, familySize);
    }
}

function processAIResponse(text, days) {
    const lines = text.split('\n').filter(line => line.trim());
    const mealIcons = { صبحانه: '🌅', ناهار: '🌞', شام: '🌙' };
    const daysOfWeek = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
    const start = new Date();
    let plan = [];
    let currentDay = null;
    let meals = {};

    for (const line of lines) {
        const dayMatch = line.match(/روز\s*(\d+)\s*\(([^)]+)\)/);
        if (dayMatch) {
            if (currentDay !== null) plan.push({ day: currentDay, meals: { ...meals } });
            currentDay = parseInt(dayMatch[1]);
            meals = {};
            continue;
        }
        const mealMatch = line.match(/(صبحانه|ناهار|شام)\s*:\s*(.+)/);
        if (mealMatch && currentDay !== null) {
            meals[mealMatch[1]] = { name: mealMatch[2].trim(), cook_time: Math.floor(Math.random() * 30 + 15) };
        }
    }
    if (currentDay !== null && Object.keys(meals).length > 0) {
        plan.push({ day: currentDay, meals: { ...meals } });
    }

    if (plan.length === 0) return generateFallbackPlan(days, getFamilySize());

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
            <div class="day-card bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
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
                    <div class="meal-item cursor-pointer hover:bg-blue-50 p-1 rounded flex justify-between items-center" 
                         data-day-index="${idx}" data-meal-type="${type}" data-meal-name="${meal.name}">
                        <span><span class="font-medium">${mealIcons[type]} ${type}:</span> ${meal.name}</span>
                        <span class="text-xs text-gray-400">⏱️ ${meal.cook_time || '?'} دقیقه</span>
                    </div>
                `;
            } else {
                html += `<div class="text-gray-400 text-xs">${mealIcons[type]} ${type}: —</div>`;
            }
        });
        html += `</div></div>`;
    });

    html += `</div></div>`;
    return html;
}

function generateFallbackPlan(days, familySize) {
    const daysOfWeek = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
    const start = new Date();
    const meals = {
        صبحانه: ['نان و پنیر', 'تخم‌مرغ', 'حلیم'],
        ناهار: ['عدسی', 'ماکارونی', 'کتلت'],
        شام: ['سوپ', 'املت', 'نان و کره']
    };
    let plan = [];
    for (let i = 0; i < Math.min(days, 7); i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        plan.push({
            day: i + 1,
            date: date.toISOString().slice(0, 10),
            dayName: daysOfWeek[date.getDay()] || 'روز',
            meals: {
                صبحانه: { name: meals.صبحانه[i % meals.صبحانه.length], cook_time: 10 },
                ناهار: { name: meals.ناهار[i % meals.ناهار.length], cook_time: 45 },
                شام: { name: meals.شام[i % meals.شام.length], cook_time: 20 }
            }
        });
    }
    window.currentPlanData = { plan, maxDays: plan.length };
    const mealIcons = { صبحانه: '🌅', ناهار: '🌞', شام: '🌙' };
    let html = `<div class="consumption-plan"><div class="flex justify-between items-center mb-4"><h4 class="text-lg font-bold text-primary">📅 برنامه مصرف (${plan.length} روز)</h4><span class="text-sm text-gray-500">📋 آفلاین</span></div><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">`;
    plan.forEach((day, idx) => {
        html += `<div class="day-card bg-white rounded-xl p-3 border border-gray-200 shadow-sm"><div class="flex justify-between items-center mb-2"><span class="font-bold text-sm text-primary">${day.dayName}</span><span class="text-xs text-gray-400">${day.date}</span></div><div class="space-y-1 text-sm">`;
        ['صبحانه', 'ناهار', 'شام'].forEach(type => {
            const meal = day.meals[type];
            html += `<div class="meal-item cursor-pointer hover:bg-blue-50 p-1 rounded flex justify-between items-center" data-day-index="${idx}" data-meal-type="${type}" data-meal-name="${meal.name}"><span><span class="font-medium">${mealIcons[type]} ${type}:</span> ${meal.name}</span><span class="text-xs text-gray-400">⏱️ ${meal.cook_time} دقیقه</span></div>`;
        });
        html += `</div></div>`;
    });
    html += `</div><div class="mt-3 p-3 bg-yellow-50 rounded-xl border border-yellow-200 text-xs text-yellow-600">⚠️ حالت آفلاین: برنامه پیش‌فرض</div></div>`;
    return html;
}

export async function getAlternativeMeal(mealType, dayIndex) {
    const inventory = getInventory();
    if (inventory.length === 0) return 'غذای ساده';
    if (!isOnline()) {
        const fallback = { 'صبحانه': ['نان و پنیر', 'تخم‌مرغ'], 'ناهار': ['عدسی', 'ماکارونی'], 'شام': ['سوپ', 'املت'] };
        const options = fallback[mealType] || ['غذای ساده'];
        return options[dayIndex % options.length];
    }
    const inventoryList = inventory.map(i => `- ${i.name}: ${i.quantity} ${i.unit}`).join('\n');
    const prompt = `بر اساس موجودی زیر، یک غذای مناسب برای وعده ${mealType} پیشنهاد بده.\nموجودی:\n${inventoryList}\nفقط نام غذا را بگو.`;
    try {
        const response = await puter.ai.chat(prompt, { model: "gpt-4o-mini", temperature: 0.7 });
        let result = typeof response === 'string' ? response : response.message?.content || '';
        return result.trim() || 'غذای ساده';
    } catch { return 'غذای ساده'; }
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
        ingredients: [{ name: meal.name, quantity: 1, unit: 'واحد' }],
        cook_time: meal.cook_time || 30,
        servings: 1,
        dayIndex: dayIndex
    };
}
