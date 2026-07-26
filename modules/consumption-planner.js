// modules/consumption-planner.js
import { store } from './store.js';

// ============================================================
// دریافت وضعیت اینترنت
// ============================================================
function isOnline() {
    return navigator.onLine;
}

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
// تولید برنامه مصرف با هوش مصنوعی (نسخه اصلی)
// ============================================================
export async function generateConsumptionPlan(days = 7, startDate = null) {
    const familySize = getFamilySize();
    const inventory = getInventory();
    const crisisMode = store.crisisMode;

    // اگر موجودی خالی است، پیام مناسب نمایش بده
    if (inventory.length === 0) {
        return `
            <div class="text-center text-gray-400 py-8">
                <i class="fas fa-utensils text-5xl block mb-3 opacity-50"></i>
                <p>هیچ ماده غذایی ثبت نشده است.</p>
                <p class="text-sm mt-2">لطفاً ابتدا مواد غذایی خود را ثبت کنید.</p>
            </div>
        `;
    }

    // اگر AI در دسترس نباشد، از داده‌های پیش‌فرض استفاده کن
    if (typeof puter === 'undefined' || !isOnline()) {
        return generateFallbackPlan(days, familySize);
    }

    // ساخت لیست موجودی برای ارسال به AI
    const inventoryList = inventory.map(item => 
        `- ${item.name}: ${item.quantity} ${item.unit} ${item.expiry ? '(انقضا: ' + item.expiry + ')' : ''}`
    ).join('\n');

    // ===== ساخت پرامپت برای هوش مصنوعی =====
    const prompt = `
شما یک دستیار هوشمند مدیریت منابع خانگی هستید. 
بر اساس موجودی زیر، یک برنامه مصرف ${days} روزه برای خانواده ${familySize} نفره تهیه کن.

موجودی انبار:
${inventoryList}

${crisisMode ? '⚠️ حالت بحران فعال است. مصرف را به حداقل برسان و اولویت با آب و کنسروها باشد.' : ''}

برنامه باید شامل ۳ وعده غذایی در روز (صبحانه، ناهار، شام) باشد.

فرمت خروجی را به این صورت بده (فقط همین فرمت، بدون توضیح اضافی):

روز ۱ (شنبه):
صبحانه: [نام غذا]
ناهار: [نام غذا]
شام: [نام غذا]

روز ۲ (یکشنبه):
صبحانه: [نام غذا]
ناهار: [نام غذا]
شام: [نام غذا]

... تا روز ${days}

نکات:
1. فقط از مواد موجود در انبار استفاده کن.
2. سعی کن تنوع غذایی رعایت شود.
3. اگر ماده‌ای کافی نیست، پیشنهاد جایگزین بده.
4. غذاها باید متناسب با وعده باشند (صبحانه سبک، ناهار سنگین‌تر، شام متوسط).
`;

    try {
        const response = await puter.ai.chat(prompt, {
            model: "gpt-4o-mini",
            temperature: 0.7
        });

        let result = '';
        if (typeof response === 'string') {
            result = response;
        } else if (response && typeof response === 'object') {
            result = response.message?.content || response.text || response.response || JSON.stringify(response);
        } else {
            result = 'پاسخی دریافت نشد.';
        }

        // ===== تبدیل پاسخ AI به HTML =====
        return formatAIResponseToHTML(result, days);

    } catch (error) {
        console.error('❌ خطا در ارتباط با AI:', error);
        return generateFallbackPlan(days, familySize);
    }
}

// ============================================================
// تبدیل پاسخ AI به HTML
// ============================================================
function formatAIResponseToHTML(aiResponse, days) {
    // حذف علامت‌های اضافی و نمایش زیبا
    const lines = aiResponse.split('\n').filter(line => line.trim() !== '');
    
    let html = `
        <div class="consumption-plan-ai">
            <div class="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                <span class="text-2xl">🤖</span>
                <span class="text-sm font-bold text-blue-600">برنامه هوشمند (AI)</span>
                <span class="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">آنلاین</span>
                <span class="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">${days} روز</span>
            </div>
            <div class="space-y-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                ${aiResponse.replace(/\n/g, '<br>')}
            </div>
            <div class="mt-4 text-xs text-gray-400 text-center">
                🤖 تولید شده توسط هوش مصنوعی • بر اساس موجودی واقعی انبار
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
    const meals = {
        صبحانه: ['نان و پنیر', 'تخم‌مرغ', 'حلیم', 'فرنی'],
        ناهار: ['برنج و خورش', 'ماکارونی', 'کباب', 'کتلت'],
        شام: ['سوپ', 'نان و پنیر', 'عدسی', 'املت']
    };

    let html = `
        <div class="consumption-plan-fallback">
            <div class="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                <span class="text-2xl">📋</span>
                <span class="text-sm font-bold text-gray-600">برنامه پیش‌فرض</span>
                <span class="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">آفلاین</span>
                <span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">${days} روز</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    `;

    for (let i = 0; i < Math.min(days, 7); i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        const dayName = daysOfWeek[date.getDay()] || 'روز';
        html += `
            <div class="day-card bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
                <div class="flex justify-between items-center mb-2">
                    <span class="font-bold text-sm text-primary">${dayName}</span>
                    <span class="text-xs text-gray-400">${date.toISOString().slice(0, 10)}</span>
                </div>
                <div class="space-y-1 text-sm">
                    <div><span class="font-medium">🌅 صبحانه:</span> ${meals.صبحانه[i % meals.صبحانه.length]}</div>
                    <div><span class="font-medium">🌞 ناهار:</span> ${meals.ناهار[i % meals.ناهار.length]}</div>
                    <div><span class="font-medium">🌙 شام:</span> ${meals.شام[i % meals.شام.length]}</div>
                </div>
            </div>
        `;
    }

    html += `
            </div>
            <div class="mt-4 p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                <p class="text-sm text-yellow-700">⚠️ حالت آفلاین: این یک برنامه پیش‌فرض است. برای برنامه‌ریزی دقیق‌تر، اتصال اینترنت را برقرار کنید.</p>
            </div>
        </div>
    `;

    return html;
}

// ============================================================
// دریافت جزئیات یک وعده (برای مدال مصرف)
// ============================================================
export function getMealDetails(dayIndex, mealType, plan) {
    // این تابع در نسخه AI کاربرد ندارد، اما برای سازگاری نگه داشته شده است
    return null;
}
