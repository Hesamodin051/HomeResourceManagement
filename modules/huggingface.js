// modules/huggingface.js

const HF_TOKEN = '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'; // توکنی که از مرحله قبل گرفتی
const BASE_URL = 'https://router.huggingface.co/v1';

export async function getHuggingFaceResponse(prompt, systemPrompt = '') {
    try {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: "system", content: systemPrompt });
        }
        messages.push({ role: "user", content: prompt });

        const response = await fetch(`${BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HF_TOKEN}`
            },
            body: JSON.stringify({
                model: 'deepseek-ai/DeepSeek-V3-0324', // یا 'deepseek-ai/DeepSeek-R1-0528'
                messages: messages,
                temperature: 0.7,
                max_tokens: 2000,
                stream: false
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`خطای ${response.status}: ${errorData.error?.message || 'مشخص نیست'}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || 'پاسخی دریافت نشد.';
    } catch (error) {
        console.error('❌ خطا در ارتباط با Hugging Face:', error);
        return null;
    }
}

/**
 * تولید برنامه مصرف با Hugging Face
 */
export async function generateConsumptionPlanAI(days, inventoryList, familySize, crisisMode) {
    const crisisText = crisisMode ? '⚠️ حالت بحران فعال است. مصرف را به حداقل برسان.' : '';
    
    const systemPrompt = 'شما یک دستیار هوشمند مدیریت منابع خانگی هستید.';
    const prompt = `
بر اساس موجودی زیر، یک برنامه مصرف ${days} روزه برای خانواده ${familySize} نفره تهیه کن.

موجودی انبار:
${inventoryList}

${crisisText}

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
`;

    return await getHuggingFaceResponse(prompt, systemPrompt);
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

    return await getHuggingFaceResponse(prompt);
}
