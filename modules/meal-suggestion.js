// modules/meal-suggestion.js
import { store } from './store.js';
import { getAverageRating, addFeedback } from './feedback.js';

let recipesCache = [];

// ============================================================
// بارگذاری دستورهای غذایی از JSON
// ============================================================
export async function loadRecipes() {
    if (recipesCache.length > 0) return recipesCache;
    try {
        const response = await fetch('assets/data/recipes.json');
        const data = await response.json();
        recipesCache = data;
        return data;
    } catch (error) {
        console.warn('⚠️ خطا در بارگذاری recipes.json:', error);
        return getFallbackRecipes();
    }
}

function getFallbackRecipes() {
    return [
        {
            id: 1,
            name: 'عدسی',
            category: 'خورش',
            ingredients: [
                { name: 'عدس', quantity: 0.05, unit: 'کیلوگرم' },
                { name: 'برنج', quantity: 0.1, unit: 'کیلوگرم' },
                { name: 'پیاز', quantity: 0.02, unit: 'کیلوگرم' },
                { name: 'روغن', quantity: 0.02, unit: 'لیتر' }
            ],
            servings: 4,
            cook_time: 45,
            difficulty: 'آسان',
            nutrition: { calories: 180, protein: 8, carbs: 28, fat: 2, fiber: 5 },
            tags: ['گیاهی', 'ارزان', 'سریع'],
            season: 'همه فصول'
        },
        {
            id: 2,
            name: 'ماکارونی با رب',
            category: 'پاستا',
            ingredients: [
                { name: 'ماکارونی', quantity: 0.15, unit: 'کیلوگرم' },
                { name: 'رب گوجه', quantity: 0.01, unit: 'کیلوگرم' },
                { name: 'روغن', quantity: 0.02, unit: 'لیتر' }
            ],
            servings: 4,
            cook_time: 30,
            difficulty: 'آسان',
            nutrition: { calories: 250, protein: 8, carbs: 40, fat: 3, fiber: 3 },
            tags: ['سریع', 'ارزان'],
            season: 'همه فصول'
        }
    ];
}

export function isOnline() {
    return navigator.onLine;
}

function calculateServings(recipe, inventory, familySize) {
    let maxServings = Infinity;
    for (let ingredient of recipe.ingredients) {
        let available = 0;
        const inventoryItem = inventory.find(item => 
            item.name.includes(ingredient.name) || 
            ingredient.name.includes(item.name)
        );
        if (inventoryItem) {
            if (inventoryItem.unit === ingredient.unit) {
                available = inventoryItem.quantity;
            } else {
                const conversion = {
                    'کیلوگرم': { 'گرم': 1000 },
                    'لیتر': { 'میلی‌لیتر': 1000 },
                    'عدد': { 'عدد': 1 },
                    'بسته': { 'بسته': 1 }
                };
                if (conversion[inventoryItem.unit] && conversion[inventoryItem.unit][ingredient.unit]) {
                    available = inventoryItem.quantity * conversion[inventoryItem.unit][ingredient.unit];
                } else {
                    available = inventoryItem.quantity;
                }
            }
        }
        const needed = ingredient.quantity * familySize;
        const servings = needed > 0 ? available / needed : Infinity;
        if (servings < maxServings) maxServings = servings;
    }
    return maxServings > 0 ? Math.floor(maxServings) : 0;
}

function calculateRecipeRating(recipe) {
    const ratings = recipe.ingredients.map(ing => {
        const rating = getAverageRating(ing.name);
        return rating || 0;
    });
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    return avg || 0;
}

// ============================================================
// تولید پیشنهاد Rule-Based (آفلاین)
// ============================================================
export async function generateRuleBasedSuggestion() {
    const familySize = store.currentUserProfile?.familySize || 4;
    const inventory = store.inventory || [];
    const crisisMode = store.crisisMode;
    const recipes = await loadRecipes();

    if (inventory.length === 0) {
        return {
            type: 'empty',
            message: 'هیچ ماده غذایی ثبت نشده است. لطفاً ابتدا مواد غذایی خود را ثبت کنید.'
        };
    }

    const availableRecipes = recipes.map(recipe => {
        const servings = calculateServings(recipe, inventory, familySize);
        const rating = calculateRecipeRating(recipe);
        return { ...recipe, servings, rating, isAvailable: servings > 0 };
    });

    availableRecipes.sort((a, b) => {
        if (a.isAvailable && !b.isAvailable) return -1;
        if (!a.isAvailable && b.isAvailable) return 1;
        if (a.rating !== b.rating) return b.rating - a.rating;
        return b.servings - a.servings;
    });

    const available = availableRecipes.filter(r => r.isAvailable);
    const unavailable = availableRecipes.filter(r => !r.isAvailable);

    return {
        type: 'rule-based',
        available,
        unavailable,
        totalRecipes: recipes.length,
        crisisMode
    };
}

// ============================================================
// تولید پیشنهاد با هوش مصنوعی (آنلاین)
// ============================================================
export async function generateAISuggestion() {
    const familySize = store.currentUserProfile?.familySize || 4;
    const inventory = store.inventory || [];
    const crisisMode = store.crisisMode;

    if (inventory.length === 0) {
        return {
            type: 'empty',
            message: 'هیچ ماده غذایی ثبت نشده است.'
        };
    }

    if (typeof puter === 'undefined') {
        return {
            type: 'error',
            message: 'سرویس هوش مصنوعی در دسترس نیست.'
        };
    }

    const inventoryList = inventory.map(item => 
        `- ${item.name}: ${item.quantity} ${item.unit} (انقضا: ${item.expiry || 'نامشخص'})`
    ).join('\n');

    const prompt = `
شما یک دستیار آشپزخانه هوشمند و حرفه‌ای هستید.

اطلاعات:
- تعداد اعضای خانواده: ${familySize} نفر
- وضعیت بحران: ${crisisMode ? 'فعال ⚠️' : 'غیرفعال 🌿'}

موجودی انبار:
${inventoryList}

لطفاً ۵ غذای برتری که می‌توان با این مواد پخت را پیشنهاد بده.

برای هر غذا، این اطلاعات را بده:
1. نام غذا
2. مواد لازم (با مقدار دقیق برای ${familySize} نفر)
3. تعداد دفعات قابل پخت (بر اساس موجودی)
4. زمان پخت (دقیقه)
5. یک نکته مفید

پاسخ را به صورت شماره‌دار و با فرمت زیر بده:

1. [نام غذا]
   مواد: [لیست مواد]
   دفعات: [عدد]
   زمان: [عدد] دقیقه
   نکته: [متن]

2. ...
`;

    try {
        const response = await puter.ai.chat(prompt, {
            model: 'gpt-4o-mini',
            stream: false
        });

        let result = '';
        if (typeof response === 'string') {
            result = response;
        } else if (response && typeof response === 'object') {
            result = response.message?.content || response.text || response.response || JSON.stringify(response);
        } else {
            result = 'پاسخی دریافت نشد.';
        }

        return {
            type: 'ai',
            content: result
        };
    } catch (error) {
        console.error('❌ خطا در AI:', error);
        return {
            type: 'error',
            message: '❌ خطا در ارتباط با هوش مصنوعی.'
        };
    }
}

// ============================================================
// تابع اصلی
// ============================================================
export async function getMealSuggestions() {
    const online = isOnline();

    if (online) {
        console.log('🌐 آنلاین: استفاده از هوش مصنوعی');
        const result = await generateAISuggestion();
        if (result.type === 'error' || result.type === 'empty') {
            console.log('⚠️ AI خطا داد، بازگشت به Rule-Based');
            return await generateRuleBasedSuggestion();
        }
        return result;
    } else {
        console.log('📴 آفلاین: استفاده از Rule-Based');
        return await generateRuleBasedSuggestion();
    }
}
