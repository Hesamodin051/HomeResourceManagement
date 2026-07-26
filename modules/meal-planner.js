// modules/meal-planner.js
import { getMealSuggestions, isOnline } from './meal-suggestion.js';
import { addFeedback } from './feedback.js';

let cachedSuggestions = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000;
let currentSuggestionResult = null;

// ============================================================
// تابع اصلی تولید پیشنهادات
// ============================================================
export async function generateMealSuggestions(forceRefresh = false) {
    const display = document.getElementById('mealSuggestionsDisplay');
    if (!display) return;

    const now = Date.now();
    if (!forceRefresh && cachedSuggestions && (now - lastFetchTime) < CACHE_DURATION) {
        renderMealSuggestions(cachedSuggestions);
        return;
    }

    const online = isOnline();
    display.innerHTML = `
        <div class="text-center text-gray-400 py-4">
            <i class="fas fa-spinner fa-spin text-2xl block mb-2"></i>
            ${online ? '🤖 در حال دریافت پیشنهادات هوشمند از AI...' : '📋 در حال تحلیل داده‌های آفلاین...'}
        </div>
    `;

    try {
        const result = await getMealSuggestions();
        currentSuggestionResult = result;
        cachedSuggestions = result;
        lastFetchTime = now;
        renderMealSuggestions(result);
    } catch (error) {
        console.error('❌ خطا در تولید پیشنهادات:', error);
        display.innerHTML = `
            <div class="text-center text-red-400 py-4">
                <i class="fas fa-exclamation-triangle text-3xl block mb-2"></i>
                خطا در دریافت پیشنهادات. لطفاً دوباره تلاش کنید.
            </div>
        `;
    }
}

// ============================================================
// بازنویسی پیشنهادات با نظر کاربر
// ============================================================
export async function rewriteSuggestionsWithFeedback(userFeedback) {
    const display = document.getElementById('mealSuggestionsDisplay');
    if (!display) return;

    // ذخیره بازخورد
    if (currentSuggestionResult && currentSuggestionResult.type === 'rule-based') {
        const available = currentSuggestionResult.available || [];
        available.forEach(recipe => {
            // ثبت بازخورد به‌عنوان امتیاز (بر اساس نظر کاربر)
            const rating = userFeedback.includes('خوب') ? 5 : 
                          userFeedback.includes('عالی') ? 4 :
                          userFeedback.includes('متوسط') ? 3 : 2;
            addFeedback(recipe.name, rating, userFeedback);
        });
    }

    // نمایش وضعیت بازنویسی
    display.innerHTML = `
        <div class="text-center text-gray-500 py-4">
            <i class="fas fa-edit text-2xl block mb-2"></i>
            🔄 در حال بازنویسی پیشنهادات بر اساس نظر شما...
        </div>
    `;

    // بازتولید پیشنهادات با نیروی رفرش
    await generateMealSuggestions(true);
}

// ============================================================
// رندر پیشنهادات با نمایش زیبا و دسته‌بندی‌شده
// ============================================================
function renderMealSuggestions(result) {
    const display = document.getElementById('mealSuggestionsDisplay');
    if (!display) return;

    if (result.type === 'empty') {
        display.innerHTML = `
            <div class="text-center text-gray-400 py-8">
                <i class="fas fa-utensils text-5xl block mb-3 opacity-50"></i>
                <p>${result.message}</p>
                <p class="text-sm mt-2">لطفاً ابتدا مواد غذایی خود را ثبت کنید.</p>
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
        display.innerHTML = `
            <div class="ai-suggestion bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-xl border border-blue-200">
                <div class="flex items-center gap-2 mb-3">
                    <span class="text-lg">🤖</span>
                    <span class="text-sm font-bold text-blue-600">پیشنهاد هوشمند (AI)</span>
                    <span class="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">آنلاین</span>
                </div>
                <div class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    ${result.content}
                </div>
            </div>
        `;
        return;
    }

    if (result.type === 'rule-based') {
        const { available, unavailable, crisisMode } = result;
        
        // گروه‌بندی غذاها بر اساس دسته‌بندی
        const grouped = {};
        available.forEach(recipe => {
            const cat = recipe.category || 'سایر';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(recipe);
        });

        let html = `
            <div class="rule-based-suggestion">
                <div class="flex items-center gap-2 mb-4">
                    <span class="text-lg">📋</span>
                    <span class="text-sm font-bold text-gray-600">پیشنهادات غذایی</span>
                    <span class="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">${isOnline() ? 'آنلاین (Rule-Based)' : 'آفلاین'}</span>
                    ${available.length > 0 ? `<span class="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">${available.length} غذا</span>` : ''}
                </div>
        `;

        if (available.length === 0) {
            html += `
                <div class="p-4 bg-yellow-50 rounded-xl border border-yellow-200 text-sm text-yellow-700">
                    ⚠️ با موجودی فعلی نمی‌توان هیچ غذای کاملی پخت.
                    <br><span class="text-xs">برای خرید مواد اولیه، به بخش <strong>پیشنهادات خرید</strong> مراجعه کنید.</span>
                </div>
            `;
            html += `</div>`;
            display.innerHTML = html;
            return;
        }

        // نمایش غذاها به‌صورت دسته‌بندی‌شده
        html += `<div class="space-y-4">`;
        Object.keys(grouped).forEach(category => {
            const recipes = grouped[category];
            html += `
                <div class="category-group">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="text-lg">${getCategoryIcon(category)}</span>
                        <h4 class="text-sm font-bold text-gray-700">${category}</h4>
                        <span class="text-xs text-gray-400">(${recipes.length} مورد)</span>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            `;
            recipes.slice(0, 6).forEach(recipe => {
                const ratingStars = '⭐'.repeat(Math.min(Math.round(recipe.rating), 5)) + 
                                   '☆'.repeat(Math.max(0, 5 - Math.round(recipe.rating)));
                const tags = recipe.tags ? recipe.tags.slice(0, 3).map(t => `#${t}`).join(' ') : '';
                html += `
                    <div class="recipe-card bg-white rounded-xl p-3 border border-gray-100 hover:shadow-md transition-shadow cursor-pointer" 
                         data-recipe='${JSON.stringify(recipe)}'>
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <h5 class="font-bold text-gray-800 text-sm">${recipe.name}</h5>
                                <div class="flex flex-wrap items-center gap-1 mt-1">
                                    <span class="text-xs text-yellow-500">${ratingStars}</span>
                                    <span class="text-xs text-gray-400">${recipe.cook_time || '?'} دقیقه</span>
                                    <span class="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">${recipe.servings} بار</span>
                                </div>
                                <div class="flex flex-wrap gap-1 mt-1">
                                    ${tags.split(' ').map(t => `<span class="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">${t}</span>`).join('')}
                                </div>
                            </div>
                            <div class="flex flex-col items-end gap-1">
                                <span class="text-xs text-gray-400">${recipe.difficulty || ''}</span>
                                <button class="feedback-btn text-xs text-blue-500 hover:text-blue-700" data-name="${recipe.name}">
                                    <i class="fas fa-comment"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += `
                    </div>
                </div>
            `;
        });
        html += `</div>`;

        // پیشنهاد خرید (مواد کمبود)
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

        // بخش بازخورد کاربر
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
                <p class="text-xs text-gray-400 mt-2">با ثبت نظر، پیشنهادات بر اساس سلیقه شما بازنویسی می‌شوند.</p>
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
}

// ============================================================
// آیکون‌های دسته‌بندی
// ============================================================
function getCategoryIcon(category) {
    const icons = {
        'خورش': '🍲',
        'پلو': '🍚',
        'آش': '🥣',
        'کباب': '🥩',
        'شیرینی': '🍰',
        'پاستا': '🍝',
        'صبحانه': '🍳',
        'سالاد': '🥗',
        'نوشیدنی': '🥤',
        'سایر': '📌'
    };
    return icons[category] || '🍽️';
}

// ============================================================
// راه‌اندازی رویدادهای تعاملی
// ============================================================
function setupInteractiveEvents() {
    // دکمه‌های بازخورد سریع
    document.querySelectorAll('.feedback-quick-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const feedback = this.dataset.feedback;
            document.getElementById('customFeedbackInput').value = feedback;
            document.getElementById('submitFeedbackBtn').click();
        });
    });

    // دکمه ثبت بازخورد
    document.getElementById('submitFeedbackBtn')?.addEventListener('click', async function() {
        const input = document.getElementById('customFeedbackInput');
        const feedback = input.value.trim();
        if (!feedback) {
            alert('لطفاً نظر خود را بنویسید.');
            return;
        }
        // غیرفعال کردن دکمه
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin ml-1"></i>';
        
        await rewriteSuggestionsWithFeedback(feedback);
        
        // فعال کردن مجدد
        this.disabled = false;
        this.innerHTML = '<i class="fas fa-paper-plane ml-1"></i> ثبت';
        input.value = '';
    });

    // دکمه بازخورد روی هر کارت (برای آینده)
    document.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const name = this.dataset.name;
            document.getElementById('customFeedbackInput').value = `نظر من درباره ${name}: `;
            document.getElementById('customFeedbackInput').focus();
        });
    });

    // کلیک روی کارت برای نمایش جزئیات (اختیاری)
    document.querySelectorAll('.recipe-card').forEach(card => {
        card.addEventListener('click', function() {
            try {
                const recipe = JSON.parse(this.dataset.recipe);
                alert(`🍽️ ${recipe.name}\n\nمواد: ${recipe.ingredients.map(i => `${i.name} (${i.quantity} ${i.unit})`).join('، ')}\nزمان پخت: ${recipe.cook_time || '?'} دقیقه\nدفعات قابل پخت: ${recipe.servings} بار\nنکته: ${recipe.tip || '—'}`);
            } catch (e) {}
        });
    });
}

// ============================================================
// تابع رفرش
// ============================================================
export async function refreshMealSuggestions() {
    await generateMealSuggestions(true);
}

// ============================================================
// تابع اولیه
// ============================================================
export function initMealPlanner() {
    generateMealSuggestions();
    document.addEventListener('inventoryUpdated', () => generateMealSuggestions(true));
    window.addEventListener('online', () => generateMealSuggestions(true));
    window.addEventListener('offline', () => generateMealSuggestions(true));
    console.log('✅ ماژول پیشنهادات غذایی راه‌اندازی شد.');
}
