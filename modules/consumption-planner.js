// modules/consumption-planner.js
import { store } from './store.js';

function calculateDays(quantity, unit, dailyNeedPerPerson, familySize) {
    if (unit === 'کیلوگرم' || unit === 'لیتر') {
        let need = dailyNeedPerPerson * familySize;
        return need > 0 ? quantity / need : Infinity;
    } else if (unit === 'عدد' || unit === 'بسته') {
        return quantity / (dailyNeedPerPerson * familySize);
    }
    return Infinity;
}

function getKeyItems(inventory, familySize) {
    const items = {
        water: { name: 'آب', quantity: 0, unit: 'لیتر', dailyPerPerson: 2 },
        rice: { name: 'برنج', quantity: 0, unit: 'کیلوگرم', dailyPerPerson: 0.15 },
        pasta: { name: 'ماکارونی', quantity: 0, unit: 'کیلوگرم', dailyPerPerson: 0.15 },
        legumes: { name: 'حبوبات', quantity: 0, unit: 'کیلوگرم', dailyPerPerson: 0.05 },
        canned: { name: 'کنسرو', quantity: 0, unit: 'عدد', dailyPerPerson: 0.5 },
        bread: { name: 'نان', quantity: 0, unit: 'کیلوگرم', dailyPerPerson: 0.2 }
    };
    inventory.forEach(item => {
        const name = item.name.toLowerCase();
        if (name.includes('آب')) items.water.quantity += item.quantity;
        if (name.includes('برنج')) items.rice.quantity += item.quantity;
        if (name.includes('ماکارونی')) items.pasta.quantity += item.quantity;
        if (name.includes('عدس') || name.includes('لوبیا') || name.includes('نخود')) items.legumes.quantity += item.quantity;
        if (name.includes('کنسرو')) items.canned.quantity += item.quantity;
        if (name.includes('نان')) items.bread.quantity += item.quantity;
    });
    const result = {};
    for (let [key, val] of Object.entries(items)) {
        result[key] = { ...val, daysLeft: calculateDays(val.quantity, val.unit, val.dailyPerPerson, familySize) };
    }
    return result;
}

function generateDailyPlan(keyItems, familySize) {
    const plan = [];
    let riceLeft = keyItems.rice.quantity, legumesLeft = keyItems.legumes.quantity, pastaLeft = keyItems.pasta.quantity;
    const days = Math.min(Math.floor(keyItems.rice.daysLeft), 7);
    for (let i=1; i<=days; i++) {
        let meal = `روز ${i}: `;
        if (i%3===0 && pastaLeft > 0) {
            meal += 'ماکارونی با رب گوجه‌فرنگی (در صورت وجود)';
            pastaLeft -= 0.15 * familySize;
        } else if (i%2===0 && legumesLeft > 0) {
            meal += 'عدسی یا خورشت لوبیا با برنج';
            legumesLeft -= 0.05 * familySize;
        } else {
            meal += 'برنج با کنسرو یا حبوبات';
            riceLeft -= 0.15 * familySize;
        }
        plan.push(meal);
    }
    return plan;
}

function getExtensionTips(keyItems) {
    const tips = [];
    if (keyItems.rice.daysLeft < 7 && keyItems.legumes.daysLeft > keyItems.rice.daysLeft) {
        tips.push('🍛 برنج کم است، می‌توانید با افزایش مصرف حبوبات (عدس، لوبیا) و پخت غذاهای بدون برنج مثل عدسی یا آبگوشت، مدت بیشتری دوام بیاورید.');
    }
    if (keyItems.canned.daysLeft > 5) {
        tips.push('🥫 کنسروها را برای روزهای پایانی بحران نگه دارید؛ اولویت مصرف مواد خشک (برنج، ماکارونی) باشد.');
    }
    if (keyItems.bread.daysLeft < 3) {
        tips.push('🍞 نان محدود است. با آرد موجود می‌توانید نان خانگی بپزید (در صورت وجود فر یا تابه).');
    }
    if (tips.length===0) {
        tips.push('✅ وضعیت ذخایر مناسب است. با مدیریت مصرف می‌توانید مدت طولانی تری دوام بیاورید.');
    }
    return tips;
}

export function generateConsumptionPlan() {
    const familySize = store.currentUserProfile?.familySize || 4;
    const inventory = store.inventory;
    const crisisMode = store.crisisMode;

    const keyItems = getKeyItems(inventory, familySize);
    const dailyPlan = generateDailyPlan({ ...keyItems }, familySize);
    const extensionTips = getExtensionTips(keyItems);

    let html = `<div class="plan-summary">
        <h4>📊 وضعیت ذخایر (خانواده ${familySize} نفره)</h4>
        <ul>
            <li>💧 آب: ${keyItems.water.daysLeft > 1000 ? 'نامحدود' : keyItems.water.daysLeft.toFixed(1)} روز</li>
            <li>🍚 برنج: ${keyItems.rice.daysLeft.toFixed(1)} روز</li>
            <li>🍝 ماکارونی: ${keyItems.pasta.daysLeft.toFixed(1)} روز</li>
            <li>🫘 حبوبات: ${keyItems.legumes.daysLeft.toFixed(1)} روز</li>
            <li>🥫 کنسرو: ${keyItems.canned.daysLeft.toFixed(1)} روز</li>
            <li>🍞 نان: ${keyItems.bread.daysLeft.toFixed(1)} روز</li>
        </ul>
    </div>`;

    if (dailyPlan.length > 0) {
        html += `<div class="plan-daily">
            <h4>🗓️ الگوی مصرف پیشنهادی (برای ${dailyPlan.length} روز)</h4>
            <ul>${dailyPlan.map(day => `<li>${day}</li>`).join('')}</ul>
        </div>`;
    } else {
        html += `<div class="plan-daily"><p>⚠️ برای برنامه‌ریزی روزانه، ذخیره مواد غذایی کافی نیست. لطفاً خرید کنید.</p></div>`;
    }

    html += `<div class="plan-tips">
        <h4>💡 نکات افزایش طول مدت بدون خرید</h4>
        <ul>${extensionTips.map(tip => `<li>${tip}</li>`).join('')}</ul>
    </div>`;

    if (crisisMode) {
        html += `<div class="crisis-tips"><h4>⚠️ توصیه‌های ویژه در حالت بحران</h4><ul><li>🔹 اولویت مصرف آب و غذاهای پرکالری.</li><li>🔹 از پخت غذاهای آبکی زیاد خودداری کنید.</li></ul></div>`;
    }
    return html;
}
