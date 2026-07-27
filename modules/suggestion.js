// modules/suggestion.js
import { store } from './store.js';
import { getPatternSuggestions, getFoodVarietySuggestions } from './pattern-analysis.js';
import { analyzeInventoryNutrition } from './food.js';

function getSelectedScenarioName() {
    const select = document.getElementById('scenarioSelect');
    if (select && select.value) {
        const scenarios = window.crisisScenarios || [];
        const scenario = scenarios.find(s => s.id == select.value);
        return scenario ? scenario.name : null;
    }
    return null;
}

// ============================================================
// تولید پیشنهادات هوشمند (با هشدار موجودی صفر)
// ============================================================
export function generateSuggestions() {
    const container = document.getElementById('suggestionsList');
    if (!container) return;

    const suggestions = [];
    const crisisMode = store.crisisMode;
    const familySize = store.currentUserProfile?.familySize || 4;
    const inventory = store.inventory || [];

    // ============================================================
    // 1. هشدار موجودی صفر (مهم)
    // ============================================================
    const emptyItems = inventory.filter(item => item.quantity <= 0);
    if (emptyItems.length > 0) {
        const names = emptyItems.map(i => i.name).join('، ');
        suggestions.push({
            text: `⚠️ مواد زیر در انبار تمام شده است: ${names}. لطفاً نسبت به تهیه مجدد آنها اقدام کنید.`,
            priority: 'urgent'
        });
    }

    // ============================================================
    // 2. هشدار موجودی بسیار کم (کمتر از 10% نیاز روزانه)
    // ============================================================
    const lowItems = inventory.filter(item => {
        if (item.quantity <= 0) return false;
        // تخمین نیاز روزانه (ساده)
        let dailyNeed = 0;
        const name = item.name.toLowerCase();
        if (name.includes('آب')) dailyNeed = familySize * 2; // لیتر
        else if (name.includes('برنج') || name.includes('ماکارونی')) dailyNeed = familySize * 0.3; // کیلوگرم
        else if (name.includes('نان')) dailyNeed = familySize * 0.2; // کیلوگرم
        else if (name.includes('مرغ') || name.includes('گوشت')) dailyNeed = familySize * 0.2; // کیلوگرم
        else if (name.includes('تخم‌مرغ')) dailyNeed = familySize * 0.5; // عدد
        else if (name.includes('شیر')) dailyNeed = familySize * 0.5; // لیتر
        else return false;
        
        // اگر موجودی کمتر از 2 روز نیاز باشد، هشدار بده
        return item.quantity < dailyNeed * 2;
    });

    if (lowItems.length > 0 && emptyItems.length === 0) {
        const names = lowItems.map(i => i.name).join('، ');
        suggestions.push({
            text: `🟡 مواد زیر در آستانه اتمام هستند: ${names}. پیشنهاد می‌شود به‌زودی تهیه شوند.`,
            priority: 'warning'
        });
    }

    // ============================================================
    // 3. الگوی مصرف روزانه
    // ============================================================
    const patternSuggestions = getPatternSuggestions();
    patternSuggestions.forEach(s => {
        suggestions.push({
            text: `${s.title}\n${s.message}`,
            priority: s.severity === 'warning' ? 'urgent' : 'info',
            action: s.action
        });
    });

    // ============================================================
    // 4. تنوع غذایی
    // ============================================================
    const varietySuggestions = getFoodVarietySuggestions();
    varietySuggestions.forEach(s => {
        suggestions.push({
            text: `${s.title}\n${s.message}`,
            priority: s.severity === 'warning' ? 'warning' : 'info',
            action: s.action
        });
    });

    // ============================================================
    // 5. مدیریت ذخایر (آب، برنج)
    // ============================================================
    const waterItem = inventory.find(i => i.name.includes('آب'));
    if (waterItem && waterItem.quantity > 0 && waterItem.quantity < 10 * familySize) {
        suggestions.push({
            text: `💧 آب ذخیره فقط برای ${Math.floor(waterItem.quantity / (familySize * 2))} روز کافی است. در صورت بحران، ذخیره را افزایش دهید.`,
            priority: 'urgent'
        });
    }
    const riceItem = inventory.find(i => i.name.includes('برنج'));
    if (riceItem && riceItem.quantity > 0 && riceItem.quantity < 1 * familySize) {
        suggestions.push({
            text: '🍚 برنج در حال اتمام است. پیشنهاد خرید حداقل ۲ کیلوگرم.',
            priority: 'warning'
        });
    }

    // ============================================================
    // 6. هشدار تاریخ انقضا
    // ============================================================
    const today = new Date();
    const expiringSoon = inventory.filter(item => {
        if (!item.expiry) return false;
        const expiryDate = new Date(item.expiry);
        const diffDays = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 3;
    });
    if (expiringSoon.length > 0) {
        const names = expiringSoon.map(i => i.name).join('، ');
        suggestions.push({
            text: `⏰ اقلام زیر تا ۳ روز دیگر تاریخ انقضایشان تمام می‌شود: ${names}. زودتر مصرف کنید.`,
            priority: 'urgent'
        });
    }

    // ============================================================
    // 7. بحران با سناریو
    // ============================================================
    if (crisisMode) {
        const scenarioName = getSelectedScenarioName();
        if (scenarioName === 'زلزله') {
            suggestions.push({ text: '🔴 پس از زلزله، شیر گاز را ببندید. از آب لوله‌کشی استفاده نکنید. تا ۷۲ ساعت ذخیره آب کافی داشته باشید.', priority: 'urgent' });
            suggestions.push({ text: '📋 داروهای ضروری و مدارک مهم را در دسترس قرار دهید.', priority: 'warning' });
        } else if (scenarioName === 'قطعی برق زمستانی') {
            suggestions.push({ text: '❄️ یخچال را باز نکنید تا سرما حفظ شود. از بخاری نفتی با تهویه مناسب استفاده کنید.', priority: 'urgent' });
            suggestions.push({ text: '🔋 باتری و شمع به اندازه کافی ذخیره کنید.', priority: 'warning' });
        } else if (scenarioName && scenarioName.includes('بحران انسانی')) {
            suggestions.push({ text: '🛡️ وسایل گازسوز را کمتر استفاده کنید. داروهای تجویزی را برای ۳ ماه ذخیره کنید.', priority: 'urgent' });
            suggestions.push({ text: '🥫 کنسروها و مواد غذایی کم‌حجم پرکالری را اولویت دهید.', priority: 'warning' });
        } else if (scenarioName === 'آلودگی شدید هوا') {
            suggestions.push({ text: '😷 از خانه خارج نشوید. در و پنجره را ببندید. از ماسک N95 استفاده کنید.', priority: 'urgent' });
        } else if (scenarioName === 'خشکسالی و کمبود آب') {
            suggestions.push({ text: '💦 مصرف آب را به حداقل برسانید. از شستشوی خودرو و حیاط خودداری کنید.', priority: 'urgent' });
        } else if (scenarioName === 'پاندمی و قرنطینه') {
            suggestions.push({ text: '🧴 از ماسک و مواد ضدعفونی استفاده کنید. از تماس نزدیک خودداری کنید.', priority: 'urgent' });
        } else if (scenarioName === 'سیل و آبگرفتگی') {
            suggestions.push({ text: '🌊 آب لوله‌کشی آلوده است. از آب بسته‌بندی استفاده کنید. تا تخلیه کامل آب، از برق گرفتگی خودداری کنید.', priority: 'urgent' });
        }
    }

    // ============================================================
    // 8. تحلیل ارزش غذایی
    // ============================================================
    if (!crisisMode && inventory.length > 0) {
        const nutrition = analyzeInventoryNutrition();
        if (nutrition && nutrition.calories > 0) {
            suggestions.push({
                text: `📊 ارزش غذایی کل موجودی: ${nutrition.calories} کیلوکالری، ${nutrition.protein}g پروتئین، ${nutrition.carbs}g کربوهیدرات.`,
                priority: 'info'
            });
            if (nutrition.protein < 20) {
                suggestions.push({
                    text: '💪 پروتئین موجودی شما کم است. مصرف حبوبات، تخم‌مرغ و لبنیات را افزایش دهید.',
                    priority: 'warning'
                });
            }
            if (nutrition.fiber < 10) {
                suggestions.push({
                    text: '🌾 فیبر موجودی شما کم است. مصرف سبزیجات و غلات کامل را افزایش دهید.',
                    priority: 'warning'
                });
            }
        }
    }

    // ============================================================
    // 9. اگر هیچ پیشنهادی وجود نداشت، پیام مثبت نشان بده
    // ============================================================
    const hasUrgent = suggestions.some(s => s.priority === 'urgent');
    const hasWarning = suggestions.some(s => s.priority === 'warning');
    
    if (!hasUrgent && !hasWarning && inventory.length > 0) {
        // بررسی اینکه آیا همه چیز خوب است
        const allGood = inventory.every(item => item.quantity > 0);
        if (allGood) {
            suggestions.push({
                text: '✅ وضعیت ذخایر شما مناسب است. به پایش ادامه دهید.',
                priority: 'info'
            });
        }
    }

    // ============================================================
    // رندر پیشنهادات
    // ============================================================
    container.innerHTML = suggestions.map(s => {
        const priorityClass = s.priority === 'urgent' ? 'suggestion-urgent' :
                              s.priority === 'warning' ? 'suggestion-warning' :
                              'suggestion-info';
        const actionHtml = s.action ? `<span class="text-xs text-blue-500 ml-2">→ ${s.action}</span>` : '';
        return `<div class="${priorityClass}">${s.text} ${actionHtml}</div>`;
    }).join('');
}
