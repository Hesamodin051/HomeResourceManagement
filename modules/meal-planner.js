// modules/meal-planner.js
import { getMealSuggestions, isOnline } from './meal-suggestion.js';
import { addFeedback } from './feedback.js';

let cachedSuggestions = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000;
let currentSuggestionResult = null;

// ============================================================
// تولید پیشنهادات
// ============================================================
export async function generateMealSuggestions(forceRefresh = false) {
    const display = document.getElementById('mealSuggestionsDisplay');
    if (!display) {
        console.warn('⚠️ المان mealSuggestionsDisplay پیدا نشد.');
        return;
    }

    const now = Date.now();
    if (!forceRefresh && cachedSuggestions && (now - lastFetchTime) < CACHE_DURATION) {
        renderMealSuggestions(cachedSuggestions);
        return;
    }

    const online = isOnline();
    display.innerHTML = `
        <div class="text-center text-gray-400 py-8">
            <i class="fas fa-spinner fa-spin text-3xl block mb-3"></i>
            ${online ? '🤖 در حال دریافت پیشنهادات هوشمند از AI...' : '📋 در حال تحلیل داده‌های آفلاین...'}
        </div>
    `;

    try {
        const result = await getMealSuggestions();
        
        // ===== بررسی وجود نتیجه =====
        if (!result) {
            display.innerHTML = `
                <div class="text-center text-gray-400 py-8">
                    <i class="fas fa-exclamation-triangle text-3xl block mb-2"></i>
                    هیچ پیشنهادی یافت نشد.
                </div>
            `;
            return;
        }

        currentSuggestionResult = result;
        cachedSuggestions = result;
        lastFetchTime = now;
        renderMealSuggestions(result);
    } catch (error) {
        console.error('❌ خطا در تولید پیشنهادات:', error);
        display.innerHTML = `
            <div class="text-center text-red-400 py-8">
                <i class="fas fa-exclamation-triangle text-3xl block mb-2"></i>
                خطا در دریافت پیشنهادات. لطفاً دوباره تلاش کنید.
                <br><span class="text-xs text-gray-400">${error.message || ''}</span>
            </div>
        `;
    }
}

// ============================================================
// بازنویسی با نظر کاربر
// ============================================================
export async function rewriteSuggestionsWithFeedback(userFeedback) {
    const display = document.getElementById('mealSuggestionsDisplay');
    if (!display) return;

    if (currentSuggestionResult && currentSuggestionResult.type === 'rule-based') {
        const available = currentSuggestionResult.available || [];
        available.forEach(recipe => {
            const rating = userFeedback.includes('خوب') ? 5 : 
                          userFeedback.includes('عالی') ? 4 :
                          userFeedback.includes('متوسط') ? 3 : 2;
            addFeedback(recipe.name, rating, userFeedback);
        });
    }

    display.innerHTML = `
        <div class="text-center text-gray-500 py-8">
            <i class="fas fa-edit text-3xl block mb-2"></i>
            🔄 در حال بازنویسی پیشنهادات بر اساس نظر شما...
        </div>
    `;

    await generateMealSuggestions(true);
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
        'نان': '🍞',
        'سایر': '📌'
    };
    return icons[category] || '🍽️';
}

// ============================================================
// رنگ‌های دسته‌بندی
// ============================================================
function getCategoryColor(category) {
    const colors = {
        'خورش': 'border-red-400',
        'پلو': 'border-yellow-400',
        'آش': 'border-orange-400',
        'کباب': 'border-pink-400',
        'شیرینی': 'border-purple-400',
        'پاستا': 'border-blue-400',
        'صبحانه': 'border-green-400',
        'سالاد': 'border-emerald-400',
        'نوشیدنی': 'border-cyan-400',
        'نان': 'border-amber-400'
    };
    return colors[category] || 'border-gray-400';
}

// ============================================================
// رندر اصلی (با مدیریت خطا)
// ============================================================
function renderMealSuggestions(result) {
    const display = document.getElementById('mealSuggestionsDisplay');
    if (!display) return;

    // ===== بررسی وجود نتیجه =====
    if (!result) {
        display.innerHTML = `
            <div class="text-center text-gray-400 py-8">
                <i class="fas fa-utensils text-5xl block mb-3 opacity-50"></i>
                <p>هیچ پیشنهادی موجود نیست.</p>
                <p class="text-sm mt-2">لطفاً ابتدا مواد غذایی خود را ثبت کنید.</p>
            </div>
        `;
        return;
    }

    if (result.type === 'empty') {
        display.innerHTML = `
            <div class="text-center text-gray-400 py-8">
                <i class="fas fa-utensils text-5xl block mb-3 opacity-50"></i>
                <p>${result.message || 'هیچ ماده غذایی ثبت نشده است.'}</p>
                <p class="text-sm mt-2">لطفاً ابتدا مواد غذایی خود را ثبت کنید.</p>
            </div>
        `;
        return;
    }

    if (result.type === 'error') {
        display.innerHTML = `
            <div class="text-center text-red-400 py-6">
                <i class="fas fa-exclamation-triangle text-3xl block mb-2"></i>
                ${result.message || 'خطا در دریافت پیشنهادات.'}
            </div>
        `;
        return;
    }

    if (result.type === 'ai') {
        display.innerHTML = `
            <div class="ai-suggestion bg-gradient-to-r from-blue-50 to-purple-50 p-5 rounded-xl border border-blue-200">
                <div class="flex items-center gap-3 mb-3">
                    <span class="text-2xl">🤖</span>
                    <span class="text-sm font-bold text-blue-600">پیشنهاد هوشمند (AI)</span>
                    <span class="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">آنلاین</span>
                </div>
                <div class="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    ${result.content || 'پاسخی دریافت نشد.'}
                </div>
            </div>
        `;
        return;
    }

    if (result.type === 'rule-based') {
        const available = result.available || [];
        const unavailable = result.unavailable || [];
        const crisisMode = result.crisisMode || false;
        
        // ===== گروه‌بندی بر اساس دسته =====
        const grouped = {};
        available.forEach(recipe => {
            const cat = recipe.category || 'سایر';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(recipe);
        });

        let html = `
            <div class="rule-based-suggestion">
                <div class="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200">
                    <span class="text-2xl">📋</span>
                    <span class="text-sm font-bold text-gray-700">پیشنهادات غذایی</span>
                    <span class="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">${isOnline() ? 'آنلاین' : 'آفلاین'}</span>
                    ${available.length > 0 ? `<span class="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">${available.length} غذا</span>` : ''}
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

        // ===== نمایش غذاها به‌صورت دسته‌بندی‌شده =====
        html += `<div class="space-y-5">`;
        Object.keys(grouped).forEach(category => {
            const recipes = grouped[category];
            const borderColor = getCategoryColor(category);
            html += `
                <div class="category-group">
                    <div class="flex items-center gap-2 mb-3">
                        <span class="text-2xl">${getCategoryIcon(category)}</span>
                        <h4 class="text-base font-bold text-gray-800">${category}</h4>
                        <span class="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">${recipes.length} مورد</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            `;
            recipes.slice(0, 6).forEach(recipe => {
                const ratingStars = '⭐'.repeat(Math.min(Math.round(recipe.rating || 0), 5)) + 
                                   '☆'.repeat(Math.max(0, 5 - Math.round(recipe.rating || 0)));
                const tags = (recipe.tags || []).slice(0, 3).map(t => `#${t}`).join(' ');
                const ingredients = (recipe.ingredients || []).map(i => `${i.name} (${i.quantity} ${i.unit})`).join('، ');
                
                html += `
                    <div class="recipe-card bg-white rounded-xl p-3 border-r-4 ${borderColor} shadow-sm hover:shadow-md transition-all cursor-pointer" 
                         data-recipe='${JSON.stringify(recipe)}'>
                        <div class="flex justify-between items-start">
                            <div class="flex-1 min-w-0">
                                <h5 class="font-bold text-gray-800 text-sm truncate">${recipe.name || 'غذای نامشخص'}</h5>
                                <div class="flex flex-wrap items-center gap-1 mt-1">
                                    <span class="text-xs text-yellow-500">${ratingStars}</span>
                                    <span class="text-xs text-gray-400">⏱️ ${recipe.cook_time || '?'} دقیقه</span>
                                    <span class="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">${recipe.servings || 0} بار</span>
                                </div>
                                <div class="flex flex-wrap gap-1 mt-1">
                                    ${tags.split(' ').map(t => `<span class="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">${t}</span>`).join('')}
                                </div>
                                <div class="text-xs text-gray-400 mt-1 truncate" title="${ingredients}">
                                    🧂 ${ingredients || 'بدون مواد ثبت‌شده'}
                                </div>
                            </div>
                            <div class="flex flex-col items-end gap-1 flex-shrink-0">
                                <span class="text-xs text-gray-400">${recipe.difficulty || ''}</span>
                                <button class="feedback-btn text-xs text-blue-500 hover:text-blue-700 p-1" data-name="${recipe.name}" title="ثبت نظر">
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

        // ===== پیشنهاد خرید =====
        if (unavailable.length > 0) {
            const missingIngredients = {};
            unavailable.slice(0, 5).forEach(r => {
                (r.ingredients || []).forEach(ing => {
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
// رویدادهای تعاملی
// ============================================================
function setupInteractiveEvents() {
    // بازخورد سریع
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

    // ثبت نظر
    document.getElementById('submitFeedbackBtn')?.addEventListener('click', async function() {
        const input = document.getElementById('customFeedbackInput');
        const feedback = input.value.trim();
        if (!feedback) {
            alert('لطفاً نظر خود را بنویسید.');
            return;
        }
        this.disabled = true;
        this.innerHTML = '<i class="fas fa-spinner fa-spin ml-1"></i>';
        
        await rewriteSuggestionsWithFeedback(feedback);
        
        this.disabled = false;
        this.innerHTML = '<i class="fas fa-paper-plane ml-1"></i> ثبت';
        input.value = '';
    });

    // دکمه بازخورد روی کارت
    document.querySelectorAll('.feedback-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const name = this.dataset.name;
            const input = document.getElementById('customFeedbackInput');
            if (input) {
                input.value = `نظر من درباره ${name}: `;
                input.focus();
            }
        });
    });

    // کلیک روی کارت
    document.querySelectorAll('.recipe-card').forEach(card => {
        card.addEventListener('click', function() {
            try {
                const recipe = JSON.parse(this.dataset.recipe);
                const ingredients = (recipe.ingredients || []).map(i => `${i.name} (${i.quantity} ${i.unit})`).join('\n');
                alert(`🍽️ ${recipe.name || 'غذای نامشخص'}\n\n🧂 مواد لازم:\n${ingredients || 'مواد ثبت‌شده‌ای وجود ندارد'}\n\n⏱️ زمان پخت: ${recipe.cook_time || '?'} دقیقه\n🔄 دفعات قابل پخت: ${recipe.servings || 0} بار\n💡 نکته: ${recipe.tip || '—'}`);
            } catch (e) {
                console.warn('خطا در نمایش جزئیات غذا:', e);
            }
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
// مقداردهی اولیه
// ============================================================
export function initMealPlanner() {
    generateMealSuggestions();
    document.addEventListener('inventoryUpdated', () => generateMealSuggestions(true));
    window.addEventListener('online', () => generateMealSuggestions(true));
    window.addEventListener('offline', () => generateMealSuggestions(true));
    console.log('✅ ماژول پیشنهادات غذایی راه‌اندازی شد.');
}
