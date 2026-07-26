// modules/deepseek.js

// کلید API خود را در اینجا قرار دهید
// ⚠️ توجه: این روش برای محیط‌های تولید امن نیست!
// برای پروژه‌های عمومی، از یک Backend Proxy استفاده کنید.
const DEEPSEEK_API_KEY = 'sk-68b3aab327cc46c9ae88599ec2ed8d70';

/**
 * دریافت پاسخ از DeepSeek API با استفاده از fetch
 */
export async function getDeepSeekResponse(prompt, systemPrompt = '') {
    try {
        const messages = [];
        if (systemPrompt) {
            messages.push({ role: "system", content: systemPrompt });
        }
        messages.push({ role: "user", content: prompt });

        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
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
        console.error('❌ خطا در ارتباط با DeepSeek:', error);
        return null;
    }
}

// ... توابع دیگر مانند generateConsumptionPlanAI و getAlternativeMealAI ...
