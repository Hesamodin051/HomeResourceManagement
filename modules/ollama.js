// modules/ollama.js
const OLLAMA_URL = 'http://localhost:11434/api/chat';

export async function getOllamaResponse(prompt, systemPrompt = '', model = 'llama3.2') {
    try {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: "system", content: systemPrompt });
        }
        messages.push({ role: "user", content: prompt });

        const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: model,
                messages: messages,
                stream: false,
                options: {
                    temperature: 0.7
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`خطای ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return data.message?.content || 'پاسخی دریافت نشد.';
    } catch (error) {
        console.error('❌ خطا در اتصال به Ollama:', error);
        return null;
    }
}

export async function generateConsumptionPlanAI(days, inventoryList, familySize, crisisMode) {
    const crisisText = crisisMode ? '⚠️ حالت بحران فعال است.' : '';
    const systemPrompt = 'شما یک دستیار هوشمند مدیریت منابع خانگی هستید.';
    const prompt = `بر اساس موجودی زیر، یک برنامه مصرف ${days} روزه برای خانواده ${familySize} نفره تهیه کن.

موجودی انبار:
${inventoryList}

${crisisText}

برنامه باید شامل ۳ وعده غذایی در روز (صبحانه، ناهار، شام) باشد.

فرمت خروجی دقیقاً به این صورت باشد (فقط همین فرمت، بدون توضیح اضافی):

روز ۱ (شنبه):
صبحانه: [نام غذا]
ناهار: [نام غذا]
شام: [نام غذا]

روز ۲ (یکشنبه):
صبحانه: [نام غذا]
ناهار: [نام غذا]
شام: [نام غذا]

... تا روز ${days}`;

    return await getOllamaResponse(prompt, systemPrompt);
}

export async function getAlternativeMealAI(mealType, inventoryList, familySize) {
    const prompt = `بر اساس موجودی زیر، یک غذای مناسب برای وعده ${mealType} پیشنهاد بده.
موجودی: ${inventoryList}
تعداد اعضای خانواده: ${familySize} نفر
فقط نام غذا را بگو، بدون توضیح.`;
    return await getOllamaResponse(prompt);
}
