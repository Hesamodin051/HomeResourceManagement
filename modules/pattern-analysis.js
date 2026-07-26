// modules/pattern-analysis.js
import { store } from './store.js';
import { getFeedback } from './feedback.js';

const PATTERN_KEY = 'consumption_pattern';

// ===== دریافت الگوهای ذخیره‌شده =====
function getPatterns() {
    const stored = localStorage.getItem(PATTERN_KEY);
    return stored ? JSON.parse(stored) : {};
}

// ===== ذخیره الگوها =====
function savePatterns(patterns) {
    localStorage.setItem(PATTERN_KEY, JSON.stringify(patterns));
}

// ===== تحلیل الگوی مصرف روزانه =====
export function analyzeDailyPattern() {
    const consumptionData = store.consumptionData;
    if (!consumptionData || consumptionData.dates.length === 0) {
        return null;
    }

    const len = consumptionData.dates.length;
    const last7Days = {
        water: consumptionData.water.slice(-7),
        electricity: consumptionData.electricity.slice(-7),
        gas: consumptionData.gas.slice(-7)
    };

    const avgWater = last7Days.water.reduce((a,b) => a+b, 0) / last7Days.water.length;
    const avgElec = last7Days.electricity.reduce((a,b) => a+b, 0) / last7Days.electricity.length;
    const avgGas = last7Days.gas.reduce((a,b) => a+b, 0) / last7Days.gas.length;

    const today = consumptionData.dates[consumptionData.dates.length - 1];
    const todayWater = consumptionData.water[consumptionData.water.length - 1] || 0;
    const todayElec = consumptionData.electricity[consumptionData.electricity.length - 1] || 0;
    const todayGas = consumptionData.gas[consumptionData.gas.length - 1] || 0;

    return {
        averages: { water: avgWater, electricity: avgElec, gas: avgGas },
        today: { water: todayWater, electricity: todayElec, gas: todayGas },
        waterDeviation: todayWater - avgWater,
        electricityDeviation: todayElec - avgElec,
        gasDeviation: todayGas - avgGas,
        isWaterHigh: todayWater > avgWater * 1.2,
        isElectricityHigh: todayElec > avgElec * 1.2,
        isGasHigh: todayGas > avgGas * 1.2
    };
}

// ===== پیشنهاد بر اساس الگوی مصرف =====
export function getPatternSuggestions() {
    const pattern = analyzeDailyPattern();
    if (!pattern) return [];

    const suggestions = [];
    const familySize = store.currentUserProfile?.familySize || 4;

    if (pattern.isWaterHigh) {
        suggestions.push({
            type: 'water',
            severity: 'warning',
            title: '⚠️ مصرف آب بالا',
            message: `مصرف آب امروز ${pattern.waterDeviation.toFixed(0)} لیتر بیشتر از میانگین است. لطفاً شیرآلات را بررسی کنید.`,
            action: 'بررسی نشتی'
        });
    }

    if (pattern.isElectricityHigh) {
        suggestions.push({
            type: 'electricity',
            severity: 'warning',
            title: '⚡ مصرف برق بالا',
            message: `مصرف برق امروز ${pattern.electricityDeviation.toFixed(0)} کیلووات بیشتر از میانگین است. وسایل پرمصرف را خاموش کنید.`,
            action: 'خاموش کردن وسایل اضافی'
        });
    }

    if (pattern.isGasHigh) {
        suggestions.push({
            type: 'gas',
            severity: 'warning',
            title: '🔥 مصرف گاز بالا',
            message: `مصرف گاز امروز ${pattern.gasDeviation.toFixed(0)} مترمکعب بیشتر از میانگین است. دمای پکیج را بررسی کنید.`,
            action: 'تنظیم دمای پکیج'
        });
    }

    // پیشنهادات صرفه‌جویی
    if (!pattern.isWaterHigh && !pattern.isElectricityHigh && !pattern.isGasHigh) {
        suggestions.push({
            type: 'success',
            severity: 'success',
            title: '✅ مصرف متعادل',
            message: 'مصرف شما در محدوده متعادل است. این روند عالی را ادامه دهید!',
            action: 'ادامه دهید'
        });
    }

    return suggestions;
}

// ===== تشخیص الگوی مصرف مواد غذایی =====
export function analyzeFoodPattern() {
    const inventory = store.inventory;
    if (!inventory || inventory.length === 0) return null;

    const categories = {};
    inventory.forEach(item => {
        const cat = item.category || 'سایر';
        if (!categories[cat]) categories[cat] = 0;
        categories[cat] += item.quantity;
    });

    const total = Object.values(categories).reduce((a,b) => a+b, 0);
    const percentages = {};
    Object.keys(categories).forEach(cat => {
        percentages[cat] = (categories[cat] / total * 100).toFixed(1);
    });

    return {
        categories,
        total,
        percentages,
        diversity: Object.keys(categories).length,
        isBalanced: Object.keys(categories).length >= 5,
        dominantCategory: Object.keys(categories).reduce((a,b) => categories[a] > categories[b] ? a : b, Object.keys(categories)[0])
    };
}

// ===== پیشنهاد بهبود تنوع غذایی =====
export function getFoodVarietySuggestions() {
    const pattern = analyzeFoodPattern();
    if (!pattern) return [];

    const suggestions = [];
    const feedback = getFeedback();

    if (!pattern.isBalanced) {
        const missingCategories = [];
        const allCategories = ['غلات', 'حبوبات', 'سبزیجات', 'لبنیات', 'پروتئین', 'نان'];
        allCategories.forEach(cat => {
            if (!pattern.categories[cat] || pattern.categories[cat] < 1) {
                missingCategories.push(cat);
            }
        });

        if (missingCategories.length > 0) {
            suggestions.push({
                type: 'variety',
                severity: 'warning',
                title: '🔄 تنوع غذایی کم',
                message: `دسته‌های ${missingCategories.join('، ')} در انبار شما وجود ندارند. برای تغذیه متعادل، این مواد را اضافه کنید.`,
                action: 'افزودن مواد جدید',
                missing: missingCategories
            });
        }
    }

    // پیشنهاد بر اساس بازخورد کاربر
    const mostLiked = Object.keys(feedback).filter(name => {
        const avg = feedback[name].totalRating / feedback[name].count;
        return avg >= 4 && feedback[name].count > 0;
    });

    if (mostLiked.length > 0 && pattern.isBalanced) {
        suggestions.push({
            type: 'liked',
            severity: 'success',
            title: '❤️ مواد غذایی محبوب شما',
            message: `مواد غذایی ${mostLiked.slice(0, 3).join('، ')} امتیاز بالایی از شما گرفته‌اند. بیشتر از آنها استفاده کنید.`,
            action: 'استفاده بیشتر'
        });
    }

    return suggestions;
}

// ===== صادرات پیش‌فرض =====
export default {
    analyzeDailyPattern,
    getPatternSuggestions,
    analyzeFoodPattern,
    getFoodVarietySuggestions
};
