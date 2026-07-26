// modules/inventory.js (اضافه کردن تابع جدید)

// ============================================================
// مصرف مواد اولیه برای یک غذا (کاهش موجودی)
// ============================================================
export function consumeIngredients(ingredients, familySize) {
    const inventory = store.inventory;
    let consumedItems = [];
    let errors = [];

    ingredients.forEach(ing => {
        // مقدار مورد نیاز برای کل خانواده
        const needed = ing.quantity * familySize;
        // پیدا کردن ماده در موجودی
        const inventoryItem = inventory.find(item => 
            item.name.includes(ing.name) || 
            ing.name.includes(item.name)
        );
        if (inventoryItem) {
            if (inventoryItem.quantity >= needed) {
                inventoryItem.quantity -= needed;
                consumedItems.push({
                    name: inventoryItem.name,
                    consumed: needed,
                    unit: inventoryItem.unit
                });
            } else {
                errors.push(`${inventoryItem.name} (موجودی: ${inventoryItem.quantity} ${inventoryItem.unit}، نیاز: ${needed} ${inventoryItem.unit})`);
            }
        } else {
            errors.push(`${ing.name} (در انبار موجود نیست)`);
        }
    });

    if (errors.length > 0) {
        return { 
            success: false, 
            errors: errors,
            message: 'مواد کافی برای این غذا وجود ندارد:\n' + errors.join('\n')
        };
    }

    // ذخیره موجودی جدید
    saveInventory(inventory);
    return { 
        success: true, 
        consumedItems: consumedItems,
        message: 'مواد مصرف شدند.' 
    };
}
