// modules/meal-suggestion.js
import { store } from './store.js';
import { getAverageRating } from './feedback.js';
import { analyzeInventoryNutrition } from './food.js';

let recipesCache = [];

// ============================================================
// ۱. بارگذاری دستورهای غذایی از JSON
// ============================================================
export async function loadRecipes() {
    if (recipesCache.length > 0) return recipesCache;
    try {
        // ابتدا از کش (Cache API) تلاش کن
        const cache = await caches.open('recipe-cache-v1');
        const cachedResponse = await cache.match('/assets/data/recipes.json');
        if (cachedResponse) {
            const data = await cachedResponse.json();
            recipesCache = data;
            return data;
        }
        // اگر در کش نبود، از شبکه دریافت کن
        const response = await fetch('assets/data/recipes.json');
        const data = await response.json();
        recipesCache = data;
        // ذخیره در کش برای استفاده آفلاین
        cache.put('/assets/data/recipes.json', response.clone());
        return data;
    } catch (error) {
        console.warn('⚠️ خطا در بارگذاری recipes.json، استفاده از داده‌های پیش‌فرض:', error);
        return getFallbackRecipes();
    }
}

// ============================================================
// ۲. داده‌های پیش‌فرض (در صورت عدم دسترسی به فایل)
// ============================================================
function getFallbackRecipes() {
    return [
        {
            id: 1,
            name: 'عدسی',
            category: 'خورش',
            ingredients: [
                { name: 'عدس', quantity: 0.05, unit: 'کیلوگرم' },
                { name: 'برنج', quantity: 0.1, unit: 'کیلوگرم' },
                { name: 'پیاز', quantity: 0.02, unit: 'کیلوگرم' },
                { name: 'روغن', quantity: 0.02, unit: 'لیتر' }
            ],
            servings: 4,
            cook_time: 45,
            difficulty: 'آسان',
            nutrition: { calories: 180, protein: 8, carbs: 28, fat: 2, fiber: 5 },
            tags: ['گیاهی', 'ارزان', 'سریع'],
            season: 'همه فصول'
        },
        {
            id: 2,
            name: 'ماکارونی با رب',
            category: 'پاستا',
            ingredients: [
                { name: 'ماکارونی', quantity: 0.15, unit: 'کیلوگرم' },
                { name: 'رب گوجه', quantity: 0.01, unit: 'کیلوگرم' },
                { name: 'روغن', quantity: 0.02, unit: 'لیتر' }
            ],
            servings: 4,
            cook_time: 30,
            difficulty: 'آسان',
            nutrition: { calories: 250, protein: 8, carbs: 40, fat: 3, fiber: 3 },
            tags: ['سریع', 'ارزان'],
            season: 'همه فصول'
        },
        {
            id: 3,
            name: 'املت ساده',
            category: 'صبحانه',
            ingredients: [
                { name: 'تخم‌مرغ', quantity: 2, unit: 'عدد' },
                { name: 'روغن', quantity: 0.02, unit: 'لیتر' },
                { name: 'نمک', quantity: 0.002, unit: 'کیلوگرم' }
            ],
            servings: 2,
            cook_time: 10,
            difficulty: 'آسان',
            nutrition: { calories: 180, protein: 12, carbs: 1, fat: 14, fiber: 0 },
            tags: ['سریع', 'صبحانه'],
            season: 'همه فصول'
        }
    ];
}

// ============================================================
// ۳. تشخیص وضعیت اینترنت
// ============================================================
export function isOnline() {
    return navigator.onLine;
}

// ============================================================
// ۴. محاسبه تعداد دفعات قابل پخت (Rule-Based)
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
            // تبدیل واحد (ساده)
            if (inventoryItem.unit === ingredient.unit) {
                available = inventoryItem.quantity;
            } else {
                // تلاش برای تبدیل
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

// ============================================================
// ۵. تولید پیشنهاد با Rule-Based (آفلاین)
// ============================================================
export async function generateRuleBasedSuggestion() {
    const familySize = store.currentUserProfile?.familySize || 4;
    const inventory = store.inventory || [];
    const crisisMode = store.crisisMode;
    const recipes = await loadRecipes();

    if (inventory.length === 0) {
        return {
            type: 'empty',
            message: 'هیچ ماده غذایی ثبت نشده است. لطفاً ابتدا مواد غذایی خود را ثبت کنید.'
        };
    }

    const availableRecipes = recipes.map(recipe => {
        const servings = calculateServings(recipe, inventory, familySize);
        const rating = calculateRecipeRating(recipe);
        return { ...recipe, servings, rating, isAvailable: servings > 0 };
    });

    availableRecipes.sort((a, b) => {
        if (a.isAvailable && !b.isAvailable) return -1;
        if (!a.isAvailable && b.isAvailable) return 1;
        if (a.rating !== b.rating) return b.rating - a.rating;
        return b.servings - a.servings;
    });

    const available = availableRecipes.filter(r => r.isAvailable);
    const unavailable = availableRecipes.filter(r => !r.isAvailable);

    const nutrition = analyzeInventoryNutrition();

    return {
        type: 'rule-based',
        available,
        unavailable,
        nutrition,
        totalRecipes: recipes.length,
        crisisMode
    };
}

// ============================================================
// ۶. تولید پیشنهاد با هوش مصنوعی (آنلاین)
// ============================================================
export async function generateAISuggestion() {
    const familySize = store.currentUserProfile?.familySize || 4;
    const inventory = store.inventory || [];
    const crisisMode = store.crisisMode;

    if (inventory.length === 0) {
        return {
            type: 'empty',
            message: 'هیچ ماده غذایی ثبت نشده است. لطفاً ابتدا مواد غذایی خود را ثبت کنید.'
        };
    }

    // بررسی وجود Puter.js
    if (typeof puter === 'undefined') {
        return {
            type: 'error',
            message: 'سرویس هوش مصنوعی در دسترس نیست. لطفاً صفحه را رفرش کنید.'
        };
    }

    // ساخت لیست موجودی
    const inventoryList = inventory.map(item => 
        `- ${item.name}: ${item.quantity} ${item.unit} (انقضا: ${item.expiry || 'نامشخص'})`
    ).join('\n');

    // ساخت پرامپت
    const prompt = `
شما یک دستیار آشپزخانه هوشمند و حرفه‌ای هستید که به کاربر کمک می‌کنید بهترین غذاها را با موجودی فعلی خود بپزد.

اطلاعات:
- تعداد اعضای خانواده: ${familySize} نفر
- وضعیت بحران: ${crisisMode ? 'فعال ⚠️' : 'غیرفعال 🌿'}

موجودی انبار:
${inventoryList}

لطفاً ۵ غذای برتری که می‌توان با این مواد پخت را پیشنهاد بده.

برای هر غذا، این اطلاعات را بده:
1. نام غذا
2. مواد لازم (با مقدار دقیق برای ${familySize} نفر)
3. تعداد دفعات قابل پخت (بر اساس موجودی)
4. زمان پخت (دقیقه)
5. یک نکته مفید

پاسخ را به صورت شماره‌دار و با فرمت زیر بده:

1. [نام غذا]
   مواد: [لیست مواد]
   دفعات: [عدد]
   زمان: [عدد] دقیقه
   نکته: [متن]

2. ...
`;

    try {
        const response = await puter.ai.chat(prompt, {
            model: 'gpt-4o-mini',
            stream: false
        });

        let result = '';
        if (typeof response === 'string') {
            result = response;
        } else if (response && typeof response === 'object') {
            result = response.message?.content || response.text || response.response || JSON.stringify(response);
        } else {
            result = 'پاسخی دریافت نشد.';
        }

        return {
            type: 'ai',
            content: result
        };
    } catch (error) {
        console.error('❌ خطا در AI:', error);
        return {
            type: 'error',
            message: '❌ خطا در ارتباط با هوش مصنوعی. لطفاً دوباره تلاش کنید یا از حالت آفلاین استفاده کنید.'
        };
    }
}

// ============================================================
// ۷. تابع اصلی (ترکیبی)
// ============================================================
export async function getMealSuggestions() {
    const online = isOnline();

    if (online) {
        console.log('🌐 آنلاین: استفاده از هوش مصنوعی');
        const result = await generateAISuggestion();
        if (result.type === 'error' || result.type === 'empty') {
            // اگر AI خطا داد، به Rule-Based برگرد
            console.log('⚠️ AI خطا داد، بازگشت به Rule-Based');
            return await generateRuleBasedSuggestion();
        }
        return result;
    } else {
        console.log('📴 آفلاین: استفاده از Rule-Based');
        return await generateRuleBasedSuggestion();
    }
}

// ============================================================
// ۸. رندر کردن نتیجه در HTML
// ============================================================
export function renderMealSuggestions(result) {
    const display = document.getElementById('mealSuggestionsDisplay');
    if (!display) return;

    if (result.type === 'empty') {
        display.innerHTML = `
            <div class="text-center text-gray-400 py-4">
                <i class="fas fa-utensils text-3xl block mb-2"></i>
                ${result.message}
                <br><span class="text-sm">لطفاً ابتدا مواد غذایی خود را در صفحه مدیریت مواد غذایی ثبت کنید.</span>
            </div>
        `;
        return;
    }

    if (result.type === 'error') {
        display.innerHTML = `
            <div class="text-center text-red-400 py-4">
                <i class="fas fa-exclamation-triangle text-3xl block mb-2"></i>
                ${result.message}
            </div>
        `;
        return;
    }

    if (result.type === 'ai') {
        // نمایش پاسخ هوش مصنوعی
        display.innerHTML = `
            <div class="ai-suggestion bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-xl border border-blue-200">
                <div class="flex items-center gap-2 mb-3">
                    <span class="text-lg">🤖</span>
                    <span class="text-sm font-bold text-blue-600">پیشنهاد هوشمند (AI)</span>
                    <span class="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">آنلاین</span>
                </div>
                <div class="text-sm text-gray-700 leading-relaxed">
                    ${result.content.replace(/\n/g, '<br>')}
                </div>
            </div>
        `;
        return;
    }

    if (result.type === 'rule-based') {
        // نمایش Rule-Based
        const { available, unavailable, nutrition, crisisMode } = result;
        let html = `
            <div class="rule-based-suggestion">
                <div class="flex items-center gap-2 mb-3">
                    <span class="text-lg">📋</span>
                    <span class="text-sm font-bold text-gray-600">پیشنهادات (آفلاین)</span>
                    <span class="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">آفلاین</span>
                </div>
                <div class="nutrition-summary bg-gray-50 p-3 rounded-xl mb-4">
                    <p class="text-sm font-medium">📊 ارزش غذایی کل موجودی:</p>
                    <div class="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs mt-2">
                        <div>🔥 کالری: <strong>${nutrition?.calories || 0} کیلوکالری</strong></div>
                        <div>💪 پروتئین: <strong>${nutrition?.protein || 0} گرم</strong></div>
                        <div>🍞 کربوهیدرات: <strong>${nutrition?.carbs || 0} گرم</strong></div>
                        <div>🧈 چربی: <strong>${nutrition?.fat || 0} گرم</strong></div>
                        <div>🌾 فیبر: <strong>${nutrition?.fiber || 0} گرم</strong></div>
                    </div>
                </div>
        `;

        if (available.length > 0) {
            html += `
                <h4 class="font-bold text-green-600 mb-2">✅ غذاهای قابل تهیه (${available.length} مورد)</h4>
                <ul class="space-y-2 max-h-60 overflow-y-auto">
            `;
            available.slice(0, 10).forEach(r => {
                const ratingStars = '⭐'.repeat(Math.min(Math.round(r.rating), 5)) + 
                                   '☆'.repeat(Math.max(0, 5 - Math.round(r.rating)));
                html += `
                    <li class="flex flex-wrap justify-between items-center p-2 border-b border-gray-100 hover:bg-gray-50 rounded-lg transition-colors">
                        <div class="flex-1">
                            <strong>${r.name}</strong>
                            <span class="text-xs text-gray-500 mr-2">(قابل تکرار ${r.servings} بار)</span>
                            <span class="text-xs text-yellow-500 mr-2">${ratingStars}</span>
                            <span class="text-xs text-gray-400 mr-2">${r.cook_time || '?'} دقیقه</span>
                        </div>
                        <div class="text-xs text-gray-400">${r.difficulty || ''}</div>
                    </li>
                `;
            });
            if (available.length > 10) {
                html += `<li class="text-center text-gray-400 text-sm py-2">و ${available.length - 10} غذای دیگر...</li>`;
            }
            html += `</ul>`;
        } else {
            html += `
                <div class="p-3 bg-yellow-50 rounded-xl border border-yellow-200 text-sm text-yellow-700">
                    ⚠️ با موجودی فعلی نمی‌توان هیچ غذای کاملی پخت.
                </div>
            `;
        }

        if (unavailable.length > 0) {
            const missingIngredients = {};
            unavailable.slice(0, 5).forEach(r => {
                r.ingredients.forEach(ing => {
                    const has = store.inventory.some(item => 
                        item.name.includes(ing.name) || ing.name.includes(item.name)
                    );
                    if (!has) {
                        if (!missingIngredients[ing.name]) missingIngredients[ing.name] = 0;
                        missingIngredients[ing.name] += ing.quantity;
                    }
                });
            });
            const items = Object.keys(missingIngredients);
            if (items.length > 0) {
                html += `
                    <div class="mt-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                        <p class="text-sm text-blue-700 font-medium">🛒 برای پخت غذاهای بیشتر، این مواد را تهیه کنید:</p>
                        <div class="flex flex-wrap gap-2 mt-2">
                            ${items.slice(0, 10).map(item => 
                                `<span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">${item}</span>`
                            ).join('')}
                        </div>
                    </div>
                `;
            }
        }

        if (crisisMode) {
            html += `
                <div class="mt-4 p-3 bg-red-50 rounded-xl border border-red-200">
                    <h4 class="text-sm font-bold text-red-700">⚠️ نکات ویژه در بحران</h4>
                    <ul class="text-xs text-red-600 mt-1 space-y-1">
                        <li>🔹 به جای پخت هر روز برنج، از نان و حبوبات استفاده کنید.</li>
                        <li>🔹 مصرف کنسروها را به روزهای پایانی موکول کنید.</li>
                    </ul>
                </div>
            `;
        }

        html += `</div>`;
        display.innerHTML = html;
        return;
    }
}

// ============================================================
// ۹. محاسبه امتیاز بازخورد
// ============================================================
function calculateRecipeRating(recipe) {
    const ratings = recipe.ingredients.map(ing => {
        const rating = getAverageRating(ing.name);
        return rating || 0;
    });
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    return avg || 0;
}

// ============================================================
// ۱۰. گوش دادن به تغییرات وضعیت اینترنت
// ============================================================
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('🌐 اتصال اینترنت برقرار شد. می‌توانید از AI استفاده کنید.');
        // به‌روزرسانی خودکار پیشنهادات
        const display = document.getElementById('mealSuggestionsDisplay');
        if (display) {
            getMealSuggestions().then(result => renderMealSuggestions(result));
        }
    });

    window.addEventListener('offline', () => {
        console.log('📴 اتصال اینترنت قطع شد. استفاده از حالت آفلاین.');
        const display = document.getElementById('mealSuggestionsDisplay');
        if (display) {
            getMealSuggestions().then(result => renderMealSuggestions(result));
        }
    });
}
