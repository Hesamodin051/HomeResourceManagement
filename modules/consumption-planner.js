// modules/consumption-planner.js
import { store } from './store.js';

// ============================================================
// دریافت اطلاعات پایه
// ============================================================
function getFamilySize() {
    return store.currentUserProfile?.familySize || 4;
}

function getInventory() {
    return store.inventory || [];
}

// ============================================================
// محاسبه روزهای باقی‌مانده برای هر قلم
// ============================================================
function calculateDays(quantity, unit, dailyNeedPerPerson, familySize) {
    if (unit === 'کیلوگرم' || unit === 'لیتر') {
        const need = dailyNeedPerPerson * familySize;
        return need > 0 ? quantity / need : Infinity;
    } else if (unit === 'عدد' || unit === 'بسته') {
        return quantity / (dailyNeedPerPerson * familySize);
    }
    return Infinity;
}

function getKeyItems(inventory, familySize) {
    const items = {
        water: { name: 'آب', quantity: 0, unit: 'لیتر', dailyPerPerson: 2, category: 'نوشیدنی' },
        rice: { name: 'برنج', quantity: 0, unit: 'کیلوگرم', dailyPerPerson: 0.15, category: 'غلات' },
        pasta: { name: 'ماکارونی', quantity: 0, unit: 'کیلوگرم', dailyPerPerson: 0.15, category: 'غلات' },
        legumes: { name: 'حبوبات', quantity: 0, unit: 'کیلوگرم', dailyPerPerson: 0.05, category: 'حبوبات' },
        canned: { name: 'کنسرو', quantity: 0, unit: 'عدد', dailyPerPerson: 0.5, category: 'پروتئین' },
        bread: { name: 'نان', quantity: 0, unit: 'کیلوگرم', dailyPerPerson: 0.2, category: 'نان' },
        eggs: { name: 'تخم‌مرغ', quantity: 0, unit: 'عدد', dailyPerPerson: 1, category: 'پروتئین' },
        meat: { name: 'گوشت', quantity: 0, unit: 'کیلوگرم', dailyPerPerson: 0.1, category: 'پروتئین' },
        dairy: { name: 'لبنیات', quantity: 0, unit: 'لیتر', dailyPerPerson: 0.2, category: 'لبنیات' },
        oil: { name: 'روغن', quantity: 0, unit: 'لیتر', dailyPerPerson: 0.03, category: 'چاشنی' }
    };

    inventory.forEach(item => {
        const name = item.name.toLowerCase();
        if (name.includes('آب')) items.water.quantity += item.quantity;
        if (name.includes('برنج')) items.rice.quantity += item.quantity;
        if (name.includes('ماکارونی')) items.pasta.quantity += item.quantity;
        if (name.includes('عدس') || name.includes('لوبیا') || name.includes('نخود')) items.legumes.quantity += item.quantity;
        if (name.includes('کنسرو')) items.canned.quantity += item.quantity;
        if (name.includes('نان')) items.bread.quantity += item.quantity;
        if (name.includes('تخم‌مرغ')) items.eggs.quantity += item.quantity;
        if (name.includes('گوشت') || name.includes('مرغ')) items.meat.quantity += item.quantity;
        if (name.includes('شیر') || name.includes('ماست')) items.dairy.quantity += item.quantity;
        if (name.includes('روغن')) items.oil.quantity += item.quantity;
    });

    const result = {};
    for (let [key, val] of Object.entries(items)) {
        result[key] = {
            ...val,
            daysLeft: calculateDays(val.quantity, val.unit, val.dailyPerPerson, familySize)
        };
    }
    return result;
}

// ============================================================
// تولید برنامه هفتگی (یا ماهانه) با سه وعده
// ============================================================
export function generateWeeklyPlan(days = 7, startDate = null) {
    const familySize = getFamilySize();
    const inventory = getInventory();
    const keyItems = getKeyItems(inventory, familySize);
    const crisisMode = store.crisisMode;

    // محاسبه حداقل روزهای ممکن
    let minDays = Infinity;
    for (let key of ['water', 'rice', 'legumes', 'canned']) {
        if (keyItems[key] && keyItems[key].daysLeft < minDays) {
            minDays = keyItems[key].daysLeft;
        }
    }
    const maxDays = Math.min(days, Math.floor(minDays) || 7);

    // تاریخ شروع
    const start = startDate ? new Date(startDate) : new Date();
    const daysOfWeek = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

    // برنامه وعده‌ها
    const mealTypes = ['صبحانه', 'ناهار', 'شام'];
    const mealSuggestions = {
        'صبحانه': ['نان و پنیر', 'تخم‌مرغ', 'حلیم', 'فرنی', 'نان و کره', 'عدسی'],
        'ناهار': ['برنج و خورش', 'ماکارونی', 'کباب', 'کتلت', 'سوپ', 'خورشت'],
        'شام': ['نان و پنیر', 'تخم‌مرغ', 'سوپ', 'شیرینی', 'عدسی', 'ماکارونی']
    };

    // تابع انتخاب غذا بر اساس موجودی
    function selectMeal(mealType, dayIndex) {
        const options = mealSuggestions[mealType] || [];
        // ساده: چرخشی انتخاب کن
        return options[dayIndex % options.length];
    }

    let plan = [];
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
        mealTypes.forEach(type => {
            dayPlan.meals[type] = selectMeal(type, i);
        });
        plan.push(dayPlan);
    }

    // نکات بهینه‌سازی
    const tips = [];
    if (keyItems.water.daysLeft < 7) {
        tips.push('💧 مصرف آب را مدیریت کنید. روزانه کمتر از ۲ لیتر برای هر نفر مصرف کنید.');
    }
    if (keyItems.rice.daysLeft < 5) {
        tips.push('🍚 برنج کم است. مصرف ماکارونی و نان را افزایش دهید.');
    }
    if (keyItems.legumes.daysLeft > keyItems.rice.daysLeft) {
        tips.push('🫘 حبوبات بیشتری دارید. از آن‌ها در وعده‌های غذایی استفاده کنید.');
    }
    if (crisisMode) {
        tips.push('⚠️ حالت بحران فعال است. مصرف را به حداقل برسانید و اولویت با آب و کنسروها باشد.');
    }
    if (tips.length === 0) {
        tips.push('✅ وضعیت ذخایر مناسب است. با این برنامه می‌توانید به مدت یک هفته مدیریت کنید.');
    }

    return {
        plan,
        maxDays,
        totalDays: maxDays,
        tips,
        keyItems,
        crisisMode
    };
}

// ============================================================
// تابع اصلی برای نمایش در داشبورد (با انتخاب بازه)
// ============================================================
export function generateConsumptionPlan(days = 7, startDate = null) {
    const result = generateWeeklyPlan(days, startDate);
    const { plan, maxDays, tips, keyItems, crisisMode } = result;

    let html = `
        <div class="consumption-plan">
            <div class="flex justify-between items-center mb-4">
                <h4 class="text-lg font-bold text-primary">📅 برنامه مصرف (${maxDays} روز)</h4>
                <span class="text-sm text-gray-500">${crisisMode ? '⚠️ بحران' : '🌿 عادی'}</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    `;

    plan.forEach(day => {
        html += `
            <div class="day-card bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-sm text-primary">${day.dayName}</span>
                    <span class="text-xs text-gray-400">${day.date}</span>
                </div>
                <div class="space-y-1 text-sm">
                    <div><span class="font-medium">🌅 صبحانه:</span> ${day.meals.صبحانه}</div>
                    <div><span class="font-medium">🌞 ناهار:</span> ${day.meals.ناهار}</div>
                    <div><span class="font-medium">🌙 شام:</span> ${day.meals.شام}</div>
                </div>
            </div>
        `;
    });

    html += `</div>`;

    // خلاصه موجودی
    html += `
        <div class="mt-4 p-3 bg-gray-50 rounded-xl">
            <h5 class="text-sm font-bold text-gray-700 mb-2">📊 خلاصه ذخایر</h5>
            <div class="grid grid-cols-3 md:grid-cols-5 gap-2 text-xs">
                <div>💧 آب: ${keyItems.water.daysLeft > 100 ? 'نامحدود' : Math.round(keyItems.water.daysLeft) + ' روز'}</div>
                <div>🍚 برنج: ${Math.round(keyItems.rice.daysLeft)} روز</div>
                <div>🫘 حبوبات: ${Math.round(keyItems.legumes.daysLeft)} روز</div>
                <div>🥫 کنسرو: ${Math.round(keyItems.canned.daysLeft)} روز</div>
                <div>🍞 نان: ${Math.round(keyItems.bread.daysLeft)} روز</div>
            </div>
        </div>
    `;

    // نکات
    html += `
        <div class="mt-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
            <h5 class="text-sm font-bold text-blue-700 mb-1">💡 نکات بهینه‌سازی</h5>
            <ul class="text-xs text-blue-600 space-y-1">
                ${tips.map(t => `<li>${t}</li>`).join('')}
            </ul>
        </div>
    `;

    // اگر بحران فعال است
    if (crisisMode) {
        html += `
            <div class="mt-3 p-3 bg-red-50 rounded-xl border border-red-200">
                <p class="text-sm text-red-700">⚠️ حالت بحران: اولویت با آب، کنسرو و مواد خشک است. مصرف گوشت را کاهش دهید.</p>
            </div>
        `;
    }

    html += `</div>`;
    return html;
}

// ============================================================
// تنظیمات پیشرفته (تعداد روز، تاریخ شروع)
// ============================================================
export function getConsumptionPlanOptions() {
    return {
        daysOptions: [3, 5, 7, 14, 30],
        defaultDays: 7
    };
}
