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

export function generateSuggestions() {
    const container = document.getElementById('suggestionsList');
    if (!container) return;

    const suggestions = [];
    const crisisMode = store.crisisMode;
    const familySize = store.currentUserProfile?.familySize || 4;

    // ===== 1. الگوی مصرف روزانه =====
    const patternSuggestions = getPatternSuggestions();
    patternSuggestions.forEach(s => {
        suggestions.push({
            text: `${s.title}\n${s.message}`,
            priority: s.severity === 'warning' ? 'urgent' : 'info',
            action: s.action
        });
    });

    // ===== 2. تنوع غذایی =====
    const varietySuggestions = getFoodVarietySuggestions();
    varietySuggestions.forEach(s => {
        suggestions.push({
            text: `${s.title}\n${s.message}`,
            priority: s.severity === 'warning' ? 'warning' : 'info',
            action: s.action
        });
    });

    // ===== 3. مدیریت ذخایر =====
    const inventory = store.inventory;
    const waterItem = inventory.find(i => i.name.includes('آب'));
    if (waterItem && waterItem.quantity < 10 * familySize) {
        suggestions.push({
            text: `💧 آب ذخیره فقط برای ${Math.floor(waterItem.quantity / (familySize * 2))} روز کافی است. در صورت بحران، ذخیره را افزایش دهید.`,
            priority: 'urgent'
        });
    }
    const riceItem = inventory.find(i => i.name.includes('برنج'));
    if (riceItem && riceItem.quantity < 1 * familySize) {
        suggestions.push({
            text: '🍚 برنج در حال اتمام است. پیشنهاد خرید حداقل ۲ کیلوگرم.',
            priority: 'warning'
        });
    }

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

    // ===== 4. بحران با سناریو =====
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

    // ===== 5. تحلیل ارزش غذایی =====
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

    if (!crisisMode && suggestions.filter(s => s.priority === 'urgent').length === 0 && inventory.length > 0) {
        suggestions.push({
            text: '✅ وضعیت ذخایر شما مناسب است. به پایش ادامه دهید.',
            priority: 'info'
        });
    }

    container.innerHTML = suggestions.map(s => {
        const priorityClass = s.priority === 'urgent' ? 'suggestion-urgent' :
                              s.priority === 'warning' ? 'suggestion-warning' :
                              'suggestion-info';
        const actionHtml = s.action ? `<span class="text-xs text-blue-500 ml-2">→ ${s.action}</span>` : '';
        return `<div class="${priorityClass}">${s.text} ${actionHtml}</div>`;
    }).join('');
}
