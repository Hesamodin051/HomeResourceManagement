// modules/ai-fallback.js
// نسخه‌ی ساده با jsllm7 (بدون نیاز به import)

/**
 * تولید پاسخ از هوش مصنوعی با استفاده از jsllm7
 */
export async function generateAIResponse(prompt, systemPrompt = '') {
    try {
        // بررسی وجود jsllm7
        if (typeof jsllm7 === 'undefined') {
            console.warn('⚠️ jsllm7 بارگذاری نشده است. لطفاً CDN را اضافه کنید.');
            return null;
        }

        let fullPrompt = prompt;
        if (systemPrompt) {
            fullPrompt = `${systemPrompt}\n\n${prompt}`;
        }
        
        const response = await jsllm7.generate(fullPrompt, {
            model: 'gpt-4o-mini',
            temperature: 0.7,
            maxTokens: 1000
        });
        
        if (typeof response === 'string') {
            return response;
        } else if (response && typeof response === 'object') {
            return response.text || response.content || JSON.stringify(response);
        } else {
            return 'پاسخی دریافت نشد.';
        }
    } catch (error) {
        console.error('❌ خطا در AI Fallback:', error);
        return null;
    }
}

/**
 * تولید برنامه مصرف با jsllm7
 */
export async function generateConsumptionPlanAI(days, inventoryList, familySize, crisisMode) {
    const crisisText = crisisMode ? '⚠️ حالت بحران فعال است. مصرف را به حداقل برسان و اولویت با آب و کنسروها باشد.' : '';
    
    const prompt = `
شما یک دستیار هوشمند مدیریت منابع خانگی هستید. 
بر اساس موجودی زیر، یک برنامه مصرف ${days} روزه برای خانواده ${familySize} نفره تهیه کن.

موجودی انبار:
${inventoryList}

${crisisText}

برنامه باید شامل ۳ وعده غذایی در روز (صبحانه، ناهار، شام) باشد.

مهم: فقط از مواد موجود در انبار استفاده کن. اگر ماده‌ای کافی نیست، پیشنهاد جایگزین بده.

فرمت خروجی دقیقاً به این صورت باشد (فقط همین فرمت، بدون توضیح اضافی):

روز ۱ (شنبه):
صبحانه: [نام غذا]
ناهار: [نام غذا]
شام: [نام غذا]

روز ۲ (یکشنبه):
صبحانه: [نام غذا]
ناهار: [نام غذا]
شام: [نام غذا]

... تا روز ${days}

توجه: غذاها باید متناسب با وعده باشند (صبحانه سبک، ناهار سنگین‌تر، شام متوسط). تنوع غذایی رعایت شود.
`;

    return await generateAIResponse(prompt);
}

/**
 * دریافت پیشنهاد غذای جایگزین
 */
export async function getAlternativeMealAI(mealType, inventoryList, familySize) {
    const prompt = `
بر اساس موجودی زیر، یک غذای مناسب برای وعده ${mealType} پیشنهاد بده.
موجودی: ${inventoryList}
تعداد اعضای خانواده: ${familySize} نفر
فقط نام غذا را بگو، بدون توضیح.
`;

    const response = await generateAIResponse(prompt);
    return response || 'غذای ساده';
}
