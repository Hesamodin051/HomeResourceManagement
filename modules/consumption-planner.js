// modules/consumption-planner.js
import { store } from './store.js';

function getFamilySize() {
    return store.currentUserProfile?.familySize || 4;
}

function getInventory() {
    return store.inventory || [];
}

// ============================================================
// تولید برنامه مصرف بر اساس موجودی (Rule-Based)
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

    // ===== تولید برنامه بر اساس موجودی =====
    const plan = generatePlanFromInventory(inventory, days, familySize, crisisMode);
    
    if (plan.length === 0) {
        return `
            <div class="text-center text-gray-400 py-8">
                <i class="fas fa-exclamation-triangle text-3xl block mb-3 opacity-50"></i>
                <p>موجودی کافی برای تهیه برنامه وجود ندارد.</p>
                <p class="text-sm mt-2">لطفاً مواد غذایی بیشتری به انبار اضافه کنید.</p>
            </div>
        `;
    }

    return renderPlanCards(plan, days);
}

// ============================================================
// تولید برنامه از موجودی (منطق اصلی)
// ============================================================
function generatePlanFromInventory(inventory, days, familySize, crisisMode) {
    const daysOfWeek = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
    const start = new Date();
    
    // ===== دسته‌بندی مواد غذایی =====
    const categories = {
        grains: [],    // غلات (برنج، نان، ماکارونی، ...)
        protein: [],   // پروتئین (گوشت، مرغ، تخم‌مرغ، حبوبات، ...)
        dairy: [],     // لبنیات (شیر، ماست، پنیر، ...)
        vegetables: [], // سبزیجات
        fruits: [],    // میوه‌ها
        others: []     // سایر
    };

    inventory.forEach(item => {
        const name = item.name.toLowerCase();
        if (name.includes('برنج') || name.includes('ماکارونی') || name.includes('نان') || name.includes('آرد')) {
            categories.grains.push(item);
        } else if (name.includes('مرغ') || name.includes('گوشت') || name.includes('تخم‌مرغ') || 
                   name.includes('عدس') || name.includes('لوبیا') || name.includes('نخود')) {
            categories.protein.push(item);
        } else if (name.includes('شیر') || name.includes('ماست') || name.includes('پنیر')) {
            categories.dairy.push(item);
        } else if (name.includes('سبزی') || name.includes('سیب‌زمینی') || name.includes('گوجه') || 
                   name.includes('پیاز') || name.includes('هویج')) {
            categories.vegetables.push(item);
        } else if (name.includes('سیب') || name.includes('موز') || name.includes('پرتقال')) {
            categories.fruits.push(item);
        } else {
            categories.others.push(item);
        }
    });

    // ===== انتخاب غذاها بر اساس موجودی =====
    const meals = {
        breakfast: [],
        lunch: [],
        dinner: []
    };

    // غذاهای صبحانه (سبک)
    const breakfastOptions = [];
    if (categories.dairy.length > 0) breakfastOptions.push('ماست و نان');
    if (categories.protein.some(p => p.name.includes('تخم‌مرغ'))) breakfastOptions.push('تخم‌مرغ');
    if (categories.dairy.some(p => p.name.includes('پنیر'))) breakfastOptions.push('نان و پنیر');
    if (categories.grains.some(p => p.name.includes('نان'))) breakfastOptions.push('نان و کره');
    if (categories.fruits.length > 0) breakfastOptions.push('میوه تازه');
    if (categories.protein.some(p => p.name.includes('عدس'))) breakfastOptions.push('عدسی');

    // غذاهای ناهار (سنگین‌تر)
    const lunchOptions = [];
    if (categories.grains.some(p => p.name.includes('برنج'))) {
        if (categories.protein.length > 0) lunchOptions.push('برنج با خورش');
        if (categories.protein.some(p => p.name.includes('مرغ'))) lunchOptions.push('برنج و مرغ');
        if (categories.vegetables.length > 0) lunchOptions.push('برنج با سبزیجات');
    }
    if (categories.grains.some(p => p.name.includes('ماکارونی'))) {
        lunchOptions.push('ماکارونی');
    }
    if (categories.protein.some(p => p.name.includes('عدس'))) lunchOptions.push('عدسی');
    if (categories.protein.some(p => p.name.includes('لوبیا'))) lunchOptions.push('لوبیا پلو');
    if (categories.protein.some(p => p.name.includes('نخود'))) lunchOptions.push('نخود پلو');

    // غذاهای شام (متوسط)
    const dinnerOptions = [];
    if (categories.dairy.some(p => p.name.includes('شیر'))) dinnerOptions.push('شیر و خرما');
    if (categories.protein.some(p => p.name.includes('تخم‌مرغ'))) dinnerOptions.push('املت');
    if (categories.vegetables.some(p => p.name.includes('سیب‌زمینی'))) dinnerOptions.push('سیب‌زمینی پخته');
    if (categories.grains.some(p => p.name.includes('نان'))) dinnerOptions.push('نان و پنیر');
    if (categories.protein.some(p => p.name.includes('عدس'))) dinnerOptions.push('سوپ عدس');
    if (categories.protein.some(p => p.name.includes('لوبیا'))) dinnerOptions.push('خورش لوبیا');

    // اگر گزینه‌ای نبود، از پیش‌فرض استفاده کن
    if (breakfastOptions.length === 0) breakfastOptions.push('نان و پنیر');
    if (lunchOptions.length === 0) lunchOptions.push('برنج و خورش');
    if (dinnerOptions.length === 0) dinnerOptions.push('سوپ');

    // ===== ساخت برنامه =====
    let plan = [];
    const maxDays = Math.min(days, 30);

    for (let i = 0; i < maxDays; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const dayName = daysOfWeek[date.getDay()] || 'روز';
        
        // انتخاب غذاها با چرخش
        const breakfast = breakfastOptions[i % breakfastOptions.length];
        const lunch = lunchOptions[i % lunchOptions.length];
        const dinner = dinnerOptions[i % dinnerOptions.length];

        // در حالت بحران، غذاها را ساده‌تر می‌کنیم
        let meals = { breakfast, lunch, dinner };
        if (crisisMode) {
            meals = {
                breakfast: breakfastOptions[i % 2] || 'نان و پنیر',
                lunch: lunchOptions[i % 2] || 'سوپ',
                dinner: dinnerOptions[i % 2] || 'املت'
            };
        }

        plan.push({
            day: i + 1,
            date: date.toISOString().slice(0, 10),
            dayName: dayName,
            meals: {
                صبحانه: { name: meals.breakfast, cook_time: getCookTime('breakfast') },
                ناهار: { name: meals.lunch, cook_time: getCookTime('lunch') },
                شام: { name: meals.dinner, cook_time: getCookTime('dinner') }
            }
        });
    }

    return plan;
}

// ============================================================
// زمان پخت بر اساس نوع وعده
// ============================================================
function getCookTime(mealType) {
    const times = {
        breakfast: { min: 5, max: 20 },
        lunch: { min: 30, max: 60 },
        dinner: { min: 15, max: 40 }
    };
    const t = times[mealType] || times.lunch;
    return Math.floor(Math.random() * (t.max - t.min + 1)) + t.min;
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
                <span class="text-sm text-gray-500">📋 بر اساس موجودی</span>
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
                html += `
                    <div class="meal-item flex justify-between items-center p-1 rounded hover:bg-blue-50 transition-colors" 
                         data-day-index="${idx}" data-meal-type="${type}" data-meal-name="${meal.name}">
                        <span><span class="font-medium">${mealIcons[type]} ${type}:</span> ${meal.name}</span>
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
                ✅ برنامه بر اساس موجودی واقعی انبار تولید شده است.
            </div>
        </div>
    `;

    return html;
}

// ============================================================
// دریافت پیشنهاد جایگزین (بدون AI)
// ============================================================
export async function getAlternativeMeal(mealType, dayIndex) {
    const fallback = {
        'صبحانه': ['نان و پنیر', 'تخم‌مرغ', 'حلیم', 'فرنی', 'ماست و نان'],
        'ناهار': ['عدسی', 'ماکارونی', 'کتلت', 'برنج و خورش', 'لوبیا پلو'],
        'شام': ['سوپ', 'املت', 'نان و کره', 'شیر و خرما', 'سیب‌زمینی پخته']
    };
    const options = fallback[mealType] || ['غذای ساده'];
    return options[dayIndex % options.length];
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
