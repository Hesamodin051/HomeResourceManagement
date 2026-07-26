// modules/meal-planner.js
import { getMealSuggestions, renderMealSuggestions, isOnline } from './meal-suggestion.js';

// ===== تابع اصلی (با کش) =====
let cachedSuggestions = null;
let lastFetchTime = 0;
const CACHE_DURATION = 60000; // ۱ دقیقه

export async function generateMealSuggestions(forceRefresh = false) {
    const display = document.getElementById('mealSuggestionsDisplay');
    if (!display) return;

    const now = Date.now();
    if (!forceRefresh && cachedSuggestions && (now - lastFetchTime) < CACHE_DURATION) {
        // استفاده از کش
        renderMealSuggestions(cachedSuggestions);
        return;
    }

    // نمایش وضعیت بارگذاری
    const online = isOnline();
    display.innerHTML = `
        <div class="text-center text-gray-400 py-4">
            <i class="fas fa-spinner fa-spin text-2xl block mb-2"></i>
            ${online ? '🤖 در حال دریافت پیشنهادات هوشمند از AI...' : '📋 در حال تحلیل داده‌های آفلاین...'}
        </div>
    `;

    try {
        const result = await getMealSuggestions();
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

// ===== تابع رفرش دستی =====
export async function refreshMealSuggestions() {
    await generateMealSuggestions(true);
}

// ===== مقداردهی اولیه =====
export function initMealPlanner() {
    // بارگذاری اولیه
    generateMealSuggestions();

    // گوش دادن به تغییرات موجودی
    document.addEventListener('inventoryUpdated', () => {
        generateMealSuggestions(true);
    });

    // گوش دادن به تغییرات وضعیت اینترنت
    window.addEventListener('online', () => {
        generateMealSuggestions(true);
    });

    window.addEventListener('offline', () => {
        generateMealSuggestions(true);
    });

    console.log('✅ ماژول پیشنهادات غذایی راه‌اندازی شد.');
}
