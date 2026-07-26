// modules/meal-planner.js
import { store } from './store.js';
import { generateWeeklyPlan } from './consumption-planner.js';
import { getAverageRating, addFeedback } from './feedback.js';

let recipesCache = [];
let currentSuggestionResult = null;

// ============================================================
// بارگذاری دستورهای غذایی
// ============================================================
async function loadRecipes() {
    if (recipesCache.length > 0) return recipesCache;
    try {
        const response = await fetch('assets/data/recipes.json');
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
// محاسبه تعداد دفعات قابل پخت
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

function calculateRecipeRating(recipe) {
    const ratings = recipe.ingredients.map(ing => {
        const rating = getAverageRating(ing.name);
        return rating || 0;
    });
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    return avg || 0;
}

// ============================================================
// تولید پیشنهادات غذایی بر اساس الگوی مصرف
// ============================================================
export async function generateMealSuggestions(days = 1) {
    const display = document.getElementById('mealSuggestionsDisplay');
    if (!display) return;

    const familySize = store.currentUserProfile?.familySize || 4;
    const inventory = store.inventory || [];
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

    // دریافت الگوی مصرف (برای روز جاری)
    const planResult = generateWeeklyPlan(days);
    const todayPlan = planResult.plan[0] || null;

    // بارگذاری دستورها
    const recipes = await loadRecipes();

    // محاسبه غذاهای قابل پخت
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

    // ============================================================
    // رندر خروجی
    // ============================================================
    let html = `
        <div class="meal-suggestions">
            <div class="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                <span class="text-2xl">🍽️</span>
                <span class="text-sm font-bold text-gray-700">پیشنهادات غذایی امروز</span>
                <span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">${available.length} غذا</span>
            </div>
    `;

    // نمایش برنامه امروز (از الگوی مصرف)
    if (todayPlan) {
        html += `
            <div class="today-plan bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-xl border border-blue-200 mb-4">
                <h4 class="text-sm font-bold text-blue-700 mb-2">📋 برنامه امروز (${todayPlan.dayName})</h4>
                <div class="grid grid-cols-3 gap-2 text-sm">
                    <div><span class="font-medium">🌅 صبحانه:</span> ${todayPlan.meals.صبحانه}</div>
                    <div><span class="font-medium">🌞 ناهار:</span> ${todayPlan.meals.ناهار}</div>
                    <div><span class="font-medium">🌙 شام:</span> ${todayPlan.meals.شام}</div>
                </div>
                <p class="text-xs text-blue-600 mt-2">💡 این برنامه بر اساس موجودی و الگوی مصرف بهینه تنظیم شده است.</p>
            </div>
        `;
    }

    // ===== گزینه‌های غذایی برای امروز =====
    if (available.length > 0) {
        html += `
            <h5 class="text-sm font-bold text-gray-700 mb-2">✅ گزینه‌های غذایی قابل پخت با موجودی فعلی</h5>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        `;
        available.slice(0, 6).forEach(recipe => {
            const ratingStars = '⭐'.repeat(Math.min(Math.round(recipe.rating || 0), 5)) + 
                               '☆'.repeat(Math.max(0, 5 - Math.round(recipe.rating || 0)));
            const tags = recipe.tags ? recipe.tags.slice(0, 3).map(t => `#${t}`).join(' ') : '';
            const ingredients = recipe.ingredients.map(i => `${i.name} (${i.quantity} ${i.unit})`).join('، ');

            html += `
                <div class="recipe-card bg-white rounded-xl p-3 border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer"
                     onclick="alert('🍽️ ${recipe.name}\n\n🧂 مواد: ${ingredients}\n⏱️ زمان پخت: ${recipe.cook_time || '?'} دقیقه\n🔄 دفعات قابل پخت: ${recipe.servings} بار\n💡 نکته: ${recipe.tip || '—'}')">
                    <div class="flex justify-between items-start">
                        <div class="flex-1 min-w-0">
                            <h5 class="font-bold text-gray-800 text-sm truncate">${recipe.name}</h5>
                            <div class="flex flex-wrap items-center gap-1 mt-1">
                                <span class="text-xs text-yellow-500">${ratingStars}</span>
                                <span class="text-xs text-gray-400">⏱️ ${recipe.cook_time || '?'} دقیقه</span>
                                <span class="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">${recipe.servings} بار</span>
                            </div>
                            <div class="flex flex-wrap gap-1 mt-1">
                                ${tags.split(' ').map(t => `<span class="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">${t}</span>`).join('')}
                            </div>
                        </div>
                        <div class="flex flex-col items-end gap-1 flex-shrink-0">
                            <span class="text-xs text-gray-400">${recipe.difficulty || ''}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    } else {
        html += `
            <div class="p-4 bg-yellow-50 rounded-xl border border-yellow-200 text-sm text-yellow-700">
                ⚠️ با موجودی فعلی نمی‌توان هیچ غذای کاملی پخت.
                <br><span class="text-xs">برای خرید مواد اولیه، به بخش <strong>پیشنهادات خرید</strong> مراجعه کنید.</span>
            </div>
        `;
    }

    // ===== پیشنهاد خرید (مواد کمبود) =====
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

    // ===== بخش بازخورد =====
    html += `
        <div class="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <div class="flex items-center gap-2 mb-2">
                <span class="text-lg">💬</span>
                <span class="text-sm font-medium text-gray-700">نظر شما</span>
            </div>
            <div class="flex flex-wrap gap-2">
                <button class="feedback-quick-btn text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full hover:bg-green-200 transition-colors" data-feedback="عالی بود">عالی بود</button>
                <button class="feedback-quick-btn text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full hover:bg-blue-200 transition-colors" data-feedback="خوب است">خوب است</button>
                <button class="feedback-quick-btn text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full hover:bg-yellow-200 transition-colors" data-feedback="متوسط">متوسط</button>
                <button class="feedback-quick-btn text-xs bg-red-100 text-red-700 px-3 py-1 rounded-full hover:bg-red-200 transition-colors" data-feedback="نیاز به بهبود">نیاز به بهبود</button>
            </div>
            <div class="mt-2 flex gap-2">
                <input type="text" id="customFeedbackInput" class="input-modern text-sm flex-1" placeholder="نظر خود را بنویسید..." />
                <button id="submitFeedbackBtn" class="btn-gradient !py-1 !px-4 text-sm">
                    <i class="fas fa-paper-plane ml-1"></i> ثبت
                </button>
            </div>
            <p class="text-xs text-gray-400 mt-2">با ثبت نظر، پیشنهادات بر اساس سلیقه شما به‌روز می‌شوند.</p>
        </div>
    `;

    if (crisisMode) {
        html += `
            <div class="mt-4 p-3 bg-red-50 rounded-xl border border-red-200">
                <h4 class="text-sm font-bold text-red-700">⚠️ نکات ویژه در بحران</h4>
                <ul class="text-xs text-red-600 mt-1 space-y-1">
                    <li>🔹 به جای پخت هر روز برنج، از نان و حبوبات استفاده کنید.</li>
                    <li>🔹 مصرف کنسروها را به روزهای پایانی موکول کنید.</li>
                    <li>🔹 غذاهای مقوی و پرکالری را اولویت دهید.</li>
                </ul>
            </div>
        `;
    }

    html += `</div>`;
    display.innerHTML = html;

    // ===== رویدادهای تعاملی =====
    setupInteractiveEvents();
}

// ============================================================
// رویدادهای تعاملی
// ============================================================
function setupInteractiveEvents() {
    document.querySelectorAll('.feedback-quick-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const feedback = this.dataset.feedback;
            const input = document.getElementById('customFeedbackInput');
            if (input) {
                input.value = feedback;
                document.getElementById('submitFeedbackBtn')?.click();
            }
        });
    });

    document.getElementById('submitFeedbackBtn')?.addEventListener('click', async function() {
        const input = document.getElementById('customFeedbackInput');
        const feedback = input.value.trim();
        if (!feedback) {
            alert('لطفاً نظر خود را بنویسید.');
            return;
        }
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin ml-1"></i>';
        
        // ذخیره بازخورد
        const recipes = await loadRecipes();
        recipes.forEach(recipe => {
            const rating = feedback.includes('خوب') ? 5 : 
                          feedback.includes('عالی') ? 4 :
                          feedback.includes('متوسط') ? 3 : 2;
            addFeedback(recipe.name, rating, feedback);
        });
        
        // بازتولید پیشنهادات
        await generateMealSuggestions(1);
        
        this.disabled = false;
        this.innerHTML = '<i class="fas fa-paper-plane ml-1"></i> ثبت';
        input.value = '';
    });
}

// ============================================================
// تابع رفرش
// ============================================================
export async function refreshMealSuggestions() {
    await generateMealSuggestions(1);
}

// ============================================================
// مقداردهی اولیه
// ============================================================
export function initMealPlanner() {
    generateMealSuggestions(1);
    document.addEventListener('inventoryUpdated', () => generateMealSuggestions(1));
    console.log('✅ ماژول پیشنهادات غذایی راه‌اندازی شد.');
}
