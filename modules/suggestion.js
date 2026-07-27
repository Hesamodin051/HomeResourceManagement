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
// تولید پیشنهادات هوشمند (با هشدار موجودی صفر و لاگ)
// ============================================================
export function generateSuggestions() {
    const container = document.getElementById('suggestionsList');
    if (!container) return;

    console.log('🔄 تولید پیشنهادات هوشمند...');
    
    const suggestions = [];
    const crisisMode = store.crisisMode;
    const familySize = store.currentUserProfile?.familySize || 4;
    const inventory = store.inventory || [];

    console.log(`📦 تعداد آیتم‌های موجودی: ${inventory.length}`);

    // ============================================================
    // 1. هشدار موجودی صفر (مهم)
    // ============================================================
    const emptyItems = inventory.filter(item => {
        const qty = parseFloat(item.quantity);
        return qty <= 0 || isNaN(qty);
    });
    
    if (emptyItems.length > 0) {
        const names = emptyItems.map(i => i.name).join('، ');
        console.log(`⚠️ مواد تمام‌شده: ${names}`);
        suggestions.push({
            text: `⚠️ مواد زیر در انبار تمام شده است: ${names}. لطفاً نسبت به تهیه مجدد آنها اقدام کنید.`,
            priority: 'urgent'
        });
    }

    // ============================================================
    // 2. هشدار ویژه برای نان (حتی اگر صفر نباشد، کمتر از ۲ روز نیاز باشد)
    // ============================================================
    const breadItems = inventory.filter(item => {
        const name = item.name.toLowerCase();
        return name.includes('نان') || name.includes('بربری') || name.includes('لواش') || name.includes('سنگک');
    });
    
    if (breadItems.length > 0) {
        breadItems.forEach(item => {
            const qty = parseFloat(item.quantity);
            // فرض: هر نفر روزانه 2 عدد نان مصرف می‌کند
            const dailyNeed = familySize * 2;
            if (qty <= 0) {
                // این قبلاً در بخش emptyItems پوشش داده شده، اما برای اطمینان دوباره چک می‌کنیم
                if (!emptyItems.includes(item)) {
                    suggestions.push({
                        text: `⚠️ ${item.name} تمام شده است. لطفاً خرید کنید.`,
                        priority: 'urgent'
                    });
                }
            } else if (qty < dailyNeed * 2) {
                suggestions.push({
                    text: `🟡 ${item.name}: فقط ${qty} عدد باقی مانده است (نیاز روزانه: ${dailyNeed} عدد). پیشنهاد خرید مجدد.`,
                    priority: 'warning'
                });
            }
        });
    } else {
        // اگر هیچ نانی در انبار نیست، هشدار بده
        suggestions.push({
            text: '⚠️ هیچ نانی در انبار ثبت نشده است. لطفاً نان تهیه کنید.',
            priority: 'urgent'
        });
    }

    // ============================================================
    // 3. هشدار موجودی بسیار کم (کمتر از 2 روز نیاز)
    // ============================================================
    const lowItems = inventory.filter(item => {
        const qty = parseFloat(item.quantity);
        if (qty <= 0) return false;
        let dailyNeed = 0;
        const name = item.name.toLowerCase();
        if (name.includes('آب')) dailyNeed = familySize * 2;
        else if (name.includes('برنج') || name.includes('ماکارونی')) dailyNeed = familySize * 0.3;
        else if (name.includes('مرغ') || name.includes('گوشت')) dailyNeed = familySize * 0.2;
        else if (name.includes('تخم‌مرغ')) dailyNeed = familySize * 0.5;
        else if (name.includes('شیر')) dailyNeed = familySize * 0.5;
        else if (name.includes('روغن')) dailyNeed = familySize * 0.05;
        else if (name.includes('قند') || name.includes('شکر')) dailyNeed = familySize * 0.02;
        else return false;
        return qty < dailyNeed * 2;
    });

    if (lowItems.length > 0) {
        const names = lowItems.map(i => i.name).join('، ');
        suggestions.push({
            text: `🟡 مواد زیر در آستانه اتمام هستند: ${names}. پیشنهاد می‌شود به‌زودی تهیه شوند.`,
            priority: 'warning'
        });
    }

    // ============================================================
    // 4. الگوی مصرف روزانه
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
    // 5. تنوع غذایی
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
    // 6. مدیریت ذخایر (آب، برنج)
    // ============================================================
    const waterItem = inventory.find(i => i.name.includes('آب'));
    if (waterItem) {
        const qty = parseFloat(waterItem.quantity);
        if (qty > 0 && qty < 10 * familySize) {
            suggestions.push({
                text: `💧 آب ذخیره فقط برای ${Math.floor(qty / (familySize * 2))} روز کافی است. در صورت بحران، ذخیره را افزایش دهید.`,
                priority: 'urgent'
            });
        }
    }
    const riceItem = inventory.find(i => i.name.includes('برنج'));
    if (riceItem) {
        const qty = parseFloat(riceItem.quantity);
        if (qty > 0 && qty < 1 * familySize) {
            suggestions.push({
                text: '🍚 برنج در حال اتمام است. پیشنهاد خرید حداقل ۲ کیلوگرم.',
                priority: 'warning'
            });
        }
    }

    // ============================================================
    // 7. هشدار تاریخ انقضا
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
    // 8. بحران با سناریو
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
    // 9. تحلیل ارزش غذایی
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
    // 10. اگر هیچ پیشنهادی وجود نداشت، پیام مثبت نشان بده
    // ============================================================
    const hasUrgent = suggestions.some(s => s.priority === 'urgent');
    const hasWarning = suggestions.some(s => s.priority === 'warning');
    
    if (!hasUrgent && !hasWarning && inventory.length > 0) {
        const allGood = inventory.every(item => parseFloat(item.quantity) > 0);
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
    console.log(`📋 تعداد پیشنهادات تولید شده: ${suggestions.length}`);
    container.innerHTML = suggestions.map(s => {
        const priorityClass = s.priority === 'urgent' ? 'suggestion-urgent' :
                              s.priority === 'warning' ? 'suggestion-warning' :
                              'suggestion-info';
        const actionHtml = s.action ? `<span class="text-xs text-blue-500 ml-2">→ ${s.action}</span>` : '';
        return `<div class="${priorityClass}">${s.text} ${actionHtml}</div>`;
    }).join('');
}
