// modules/meal-planner.js
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

function isOnline() {
    return navigator.onLine;
}

// ============================================================
// دریافت پیشنهادات غذایی از هوش مصنوعی
// ============================================================
export async function generateMealSuggestions(forceRefresh = false) {
    const display = document.getElementById('mealSuggestionsDisplay');
    if (!display) {
        console.warn('⚠️ المان mealSuggestionsDisplay پیدا نشد.');
        return;
    }

    const familySize = getFamilySize();
    const inventory = getInventory();
    const crisisMode = store.crisisMode;

    if (inventory.length === 0) {
        display.innerHTML = `
            <div class="text-center text-gray-400 py-8">
                <i class="fas fa-utensils text-5xl block mb-3 opacity-50"></i>
                <p>هیچ ماده غذایی ثبت نشده است.</p>
                <p class="text-sm mt-2">لطفاً ابتدا مواد غذایی خود را ثبت کنید.</p>
            </div>
        `;
        return;
    }

    // اگر AI در دسترس نباشد
    if (typeof puter === 'undefined' || !isOnline()) {
        display.innerHTML = `
            <div class="text-center text-gray-400 py-8">
                <i class="fas fa-wifi-slash text-4xl block mb-3"></i>
                <p>حالت آفلاین</p>
                <p class="text-sm mt-2">برای دریافت پیشنهادات دقیق‌تر، اتصال اینترنت را برقرار کنید.</p>
                <div class="mt-4 p-3 bg-gray-100 rounded-xl text-sm text-gray-600">
                    💡 پیشنهاد: با مواد موجود، غذاهای ساده مانند عدسی، ماکارونی و املت تهیه کنید.
                </div>
            </div>
        `;
        return;
    }

    // نمایش وضعیت بارگذاری
    display.innerHTML = `
        <div class="text-center text-gray-400 py-8">
            <i class="fas fa-spinner fa-spin text-3xl block mb-3"></i>
            🤖 در حال دریافت پیشنهادات هوشمند از AI...
        </div>
    `;

    // ساخت لیست موجودی
    const inventoryList = inventory.map(item => 
        `- ${item.name}: ${item.quantity} ${item.unit}`
    ).join('\n');

    // ===== پرامپت AI =====
    const prompt = `
شما یک دستیار آشپزخانه هوشمند هستید. 
بر اساس موجودی زیر، بهترین غذاهایی که می‌توان پخت را پیشنهاد بده.

موجودی انبار:
${inventoryList}

تعداد اعضای خانواده: ${familySize} نفر
${crisisMode ? '⚠️ حالت بحران فعال است. اولویت با غذاهای ساده و کم‌مصرف.' : ''}

لطفاً ۵ غذای برتر را به ترتیب اولویت پیشنهاد بده.
برای هر غذا، این اطلاعات را بده:
1. نام غذا
2. مواد اولیه (با مقدار دقیق برای ${familySize} نفر)
3. زمان پخت (دقیقه)
4. یک نکته مفید

فرمت خروجی:
1. [نام غذا]
   مواد: [لیست مواد با مقدار]
   زمان: [عدد] دقیقه
   نکته: [متن]

2. ...
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

        // ===== نمایش نتیجه =====
        display.innerHTML = `
            <div class="ai-suggestion bg-gradient-to-r from-blue-50 to-purple-50 p-5 rounded-xl border border-blue-200">
                <div class="flex items-center gap-3 mb-3">
                    <span class="text-2xl">🤖</span>
                    <span class="text-sm font-bold text-blue-600">پیشنهادات هوشمند (AI)</span>
                    <span class="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">آنلاین</span>
                </div>
                <div class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    ${result.replace(/\n/g, '<br>')}
                </div>
                <div class="mt-4 text-xs text-gray-400 text-center">
                    🤖 تولید شده توسط هوش مصنوعی • بر اساس موجودی واقعی انبار
                </div>
            </div>
        `;

    } catch (error) {
        console.error('❌ خطا در ارتباط با AI:', error);
        display.innerHTML = `
            <div class="text-center text-red-400 py-8">
                <i class="fas fa-exclamation-triangle text-3xl block mb-2"></i>
                خطا در دریافت پیشنهادات.
                <br><span class="text-xs text-gray-400">لطفاً دوباره تلاش کنید.</span>
            </div>
        `;
    }
}

// ============================================================
// تابع رفرش
// ============================================================
export async function refreshMealSuggestions() {
    await generateMealSuggestions(true);
}

// ============================================================
// مقداردهی اولیه
// ============================================================
export function initMealPlanner() {
    generateMealSuggestions();
    document.addEventListener('inventoryUpdated', () => generateMealSuggestions(true));
    window.addEventListener('online', () => generateMealSuggestions(true));
    window.addEventListener('offline', () => generateMealSuggestions(true));
    console.log('✅ ماژول پیشنهادات غذایی (AI) راه‌اندازی شد.');
}
