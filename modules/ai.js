// modules/ai.js
import { store } from './store.js';

export async function getAIRecommendation(prompt) {
    try {
        if (typeof puter === 'undefined') {
            console.error('Puter.js بارگذاری نشده است.');
            return 'متاسفانه سرویس هوش مصنوعی در دسترس نیست. لطفاً صفحه را رفرش کنید.';
        }
        const response = await puter.ai.chat(prompt);
        // ✅ استخراج محتوای پاسخ از آبجکت
        let content = '';
        if (typeof response === 'string') {
            content = response;
        } else if (response && typeof response === 'object') {
            // اگر response.message وجود داشته باشد
            if (response.message && typeof response.message.content === 'string') {
                content = response.message.content;
            } 
            // اگر response.text وجود داشته باشد
            else if (typeof response.text === 'string') {
                content = response.text;
            }
            // اگر response.response وجود داشته باشد (برخی APIها)
            else if (typeof response.response === 'string') {
                content = response.response;
            }
            // در غیر این صورت، به JSON تبدیل کن
            else {
                content = JSON.stringify(response);
            }
        } else {
            content = 'پاسخی دریافت نشد.';
        }
        return content || 'پاسخی دریافت نشد.';
    } catch (error) {
        console.error('خطا در ارتباط با AI:', error);
        return 'خطا در ارتباط با هوش مصنوعی. لطفاً دوباره تلاش کنید.';
    }
}

export function generateAIPrompt() {
    const inventory = store.inventory;
    const crisisMode = store.crisisMode;
    const familySize = store.currentUserProfile?.familySize || 4;
    const foodList = inventory.map(item => 
        `${item.name}: ${item.quantity} ${item.unit} (انقضا: ${item.expiry || 'نامشخص'})`
    ).join(', ') || 'هیچ ماده غذایی ثبت نشده است.';
    const crisisStatus = crisisMode ? 'فعال' : 'غیرفعال';
    let prompt = `من یک سامانه مدیریت خانگی دارم. 
خانواده من ${familySize} نفره است.
وضعیت بحران: ${crisisStatus}.
ذخایر غذایی موجود: ${foodList}.

لطفاً به عنوان یک دستیار هوشمند خانگی، موارد زیر را به من پیشنهاد بده:
1. یک برنامه غذایی برای ۳ روز آینده با استفاده از مواد موجود.
2. یک نکته برای کاهش مصرف انرژی در خانه.
3. اگر بحران فعال است، یک توصیه فوری برای مدیریت بهتر منابع.

پاسخ را به صورت سه بخش مجزا با عنوان‌های مشخص ارائه بده.`;
    return prompt;
}

export async function getSmartSuggestions() {
    const prompt = generateAIPrompt();
    const response = await getAIRecommendation(prompt);
    // ✅ اطمینان از اینکه response یک رشته است
    return typeof response === 'string' ? response : JSON.stringify(response);
}
