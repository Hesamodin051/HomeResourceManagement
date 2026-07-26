// modules/chatbot.js
import { store } from './store.js';

const STORAGE_KEY = 'chat_history';
const MAX_HISTORY = 20;

let conversationHistory = [];

function loadHistory() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            conversationHistory = JSON.parse(saved);
        } catch (e) {
            conversationHistory = [];
        }
    } else {
        conversationHistory = [];
    }
    return conversationHistory;
}

function saveHistory() {
    if (conversationHistory.length > MAX_HISTORY) {
        conversationHistory = conversationHistory.slice(-MAX_HISTORY);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversationHistory));
}

export function addMessage(role, content) {
    conversationHistory.push({ role, content, timestamp: new Date().toISOString() });
    saveHistory();
}

export function getHistory() {
    return conversationHistory;
}

export function clearHistory() {
    conversationHistory = [];
    saveHistory();
}

function calculateRemainingDays() {
    const inventory = store.inventory || [];
    const familySize = store.currentUserProfile?.familySize || 4;
    const consumptionData = store.consumptionData || { dates: [], water: [], electricity: [], gas: [] };

    let avgWater = 0, avgElec = 0, avgGas = 0;
    const len = consumptionData.dates.length;
    if (len > 0) {
        const count = Math.min(7, len);
        const slice = {
            water: consumptionData.water.slice(-count),
            electricity: consumptionData.electricity.slice(-count),
            gas: consumptionData.gas.slice(-count)
        };
        avgWater = slice.water.reduce((a,b) => a+b, 0) / slice.water.length;
        avgElec = slice.electricity.reduce((a,b) => a+b, 0) / slice.electricity.length;
        avgGas = slice.gas.reduce((a,b) => a+b, 0) / slice.gas.length;
    }

    let waterDays = Infinity;
    const waterItem = inventory.find(i => i.name.toLowerCase().includes('آب'));
    if (waterItem) {
        const waterLiters = waterItem.quantity;
        const dailyNeed = familySize * 2;
        waterDays = dailyNeed > 0 ? waterLiters / dailyNeed : Infinity;
    }

    let foodDays = Infinity;
    const riceItem = inventory.find(i => i.name.toLowerCase().includes('برنج'));
    const legumeItem = inventory.find(i => i.name.toLowerCase().includes('عدس') || i.name.toLowerCase().includes('لوبیا'));
    if (riceItem && legumeItem) {
        const riceKg = riceItem.quantity;
        const legumeKg = legumeItem.quantity || 0;
        const dailyRice = familySize * 0.15;
        const dailyLegume = familySize * 0.05;
        const daysFromRice = dailyRice > 0 ? riceKg / dailyRice : Infinity;
        const daysFromLegume = dailyLegume > 0 ? legumeKg / dailyLegume : Infinity;
        foodDays = Math.min(daysFromRice, daysFromLegume);
    } else if (riceItem) {
        const riceKg = riceItem.quantity;
        const dailyRice = familySize * 0.15;
        foodDays = dailyRice > 0 ? riceKg / dailyRice : Infinity;
    }

    return {
        waterDays: waterDays === Infinity ? 'نامحدود' : Math.floor(waterDays),
        foodDays: foodDays === Infinity ? 'نامحدود' : Math.floor(foodDays),
        avgWater: avgWater.toFixed(1),
        avgElec: avgElec.toFixed(1),
        avgGas: avgGas.toFixed(1)
    };
}

function buildSystemContext() {
    const crisisMode = store.crisisMode;
    const familySize = store.currentUserProfile?.familySize || 4;
    const inventory = store.inventory || [];
    const remaining = calculateRemainingDays();

    let inventorySummary = '';
    if (inventory.length === 0) {
        inventorySummary = 'هیچ ماده‌ی غذایی در انبار ثبت نشده است.';
    } else {
        inventorySummary = inventory.map(item =>
            `- ${item.name}: ${item.quantity} ${item.unit} (تاریخ انقضا: ${item.expiry || 'نامشخص'})`
        ).join('\n');
    }
    let medicationsInfo = 'هیچ دارویی ثبت نشده است.';
    try {
        const stored = localStorage.getItem('user_medications');
        if (stored) {
            const meds = JSON.parse(stored);
            if (meds.length > 0) {
                medicationsInfo = meds.map(m => 
                    `${m.name}: ${m.quantity} ${m.unit || 'عدد'} (${m.expiry ? 'انقضا: ' + m.expiry : 'بدون تاریخ انقضا'})`
                ).join('\n');
            }
        }
    } catch (e) {}
    
    return `
شما یک دستیار هوشمند خانگی هستید که به کاربر کمک می‌کنید مصرف انرژی و ذخایر را مدیریت کند.

اطلاعات فعلی:
- تعداد اعضای خانواده: ${familySize} نفر
- حالت بحران: ${crisisMode ? 'فعال ⚠️' : 'غیرفعال 🌿'}

تخمین روزهای باقی‌مانده از ذخایر فعلی:
- آب آشامیدنی: ${remaining.waterDays} روز
- مواد غذایی: ${remaining.foodDays} روز
- میانگین مصرف روزانه آب: ${remaining.avgWater} لیتر
- میانگین مصرف روزانه برق: ${remaining.avgElec} کیلووات
- میانگین مصرف روزانه گاز: ${remaining.avgGas} مترمکعب
اطلاعات داروهای ثبت‌شده:
    ${medicationsInfo}

موجودی دقیق انبار (فقط این موارد موجود است):
${inventorySummary}

===== قوانین مهم =====
1. اگر کاربر تعداد روز را مشخص نکرد، اول بپرس: "برای چند روز برنامه‌ریزی می‌خواهید؟"
2. فقط بر اساس لیست موجودی پاسخ بده. هیچ ماده‌ای را فرض نکن!
3. اگر موجودی برای پخت غذا کافی نیست، به جای برنامه غذایی، یک بسته‌ی خرید پیشنهاد بده.
4. در حالت بحران، اولویت با مدیریت آب و مواد غذایی ذخیره‌شده است.
5. پاسخ‌ها را به فارسی روان و مختصر بنویس.
6. همیشه در ابتدا یا انتها، وضعیت کلی ذخایر را خلاصه کن.
`;
}

export async function sendMessage(userMessage) {
    try {
        if (typeof puter === 'undefined') {
            throw new Error('Puter.js بارگذاری نشده است.');
        }

        addMessage('user', userMessage);

        const daysMatch = userMessage.match(/(\d+)\s*روز/);
        if (daysMatch) {
            sessionStorage.setItem('user_plan_days', daysMatch[1]);
        }

        const systemPrompt = buildSystemContext();
        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory.slice(-10)
        ];

        const response = await puter.ai.chat(messages, {
            model: 'gpt-4o-mini',
            stream: false
        });

        let assistantReply = '';
        if (typeof response === 'string') {
            assistantReply = response;
        } else if (response && typeof response === 'object') {
            if (response.message && typeof response.message.content === 'string') {
                assistantReply = response.message.content;
            } else if (typeof response.text === 'string') {
                assistantReply = response.text;
            } else if (typeof response.response === 'string') {
                assistantReply = response.response;
            } else {
                assistantReply = JSON.stringify(response);
            }
        } else {
            assistantReply = 'پاسخی دریافت نشد.';
        }

        addMessage('assistant', assistantReply);
        return assistantReply;

    } catch (error) {
        console.error('خطا در چت‌بات:', error);
        const errorMessage = '❌ متأسفانه در ارتباط با هوش مصنوعی مشکل پیش آمد. لطفاً دوباره تلاش کنید.';
        addMessage('assistant', errorMessage);
        return errorMessage;
    }
}

export async function getQuickSuggestion() {
    const prompt = `با توجه به وضعیت فعلی (${store.crisisMode ? 'بحران' : 'عادی'})، یک توصیه‌ی کوتاه و مفید برای مدیریت بهتر منابع به من بده. (حداکثر ۵۰ کلمه)`;
    return await sendMessage(prompt);
}

loadHistory();
console.log('✅ چت‌بات هوشمند آماده است. تعداد پیام‌های ذخیره‌شده:', conversationHistory.length);

export default {
    sendMessage,
    getHistory,
    clearHistory,
    addMessage,
    getQuickSuggestion
};
