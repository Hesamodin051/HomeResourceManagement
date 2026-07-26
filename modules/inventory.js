// modules/inventory.js
import { store, setInventory } from './store.js';
import { getLoggedInUser } from './auth.js';

function getInventoryKey() {
    const user = store.currentUser || getLoggedInUser() || 'default';
    return `home_inventory_${user}`;
}

export function loadInventory() {
    const key = getInventoryKey();
    console.log('🔑 بارگذاری موجودی با کلید:', key);
    const stored = localStorage.getItem(key);
    let inv = [];
    if (stored) {
        inv = JSON.parse(stored);
    } else {
        inv = [];
        saveInventory(inv);
    }
    setInventory(inv);
    console.log('✅ موجودی بارگذاری شد. تعداد:', inv.length);
    return inv;
}

export function saveInventory(inventory) {
    const key = getInventoryKey();
    localStorage.setItem(key, JSON.stringify(inventory));
    setInventory(inventory);
}

export function addItem(name, quantity, unit, expiry, type = 'normal') {
    const newItem = { id: Date.now(), name, quantity, unit, expiry: expiry || '', type: type || 'normal' };
    const newInventory = [...store.inventory, newItem];
    saveInventory(newInventory);
    return newInventory;
}

export function editItem(id, newName, newQty, newUnit, newExpiry, newType) {
    const newInventory = store.inventory.map(item =>
        item.id === id ? { ...item, name: newName, quantity: newQty, unit: newUnit, expiry: newExpiry, type: newType || item.type || 'normal' } : item
    );
    saveInventory(newInventory);
    return newInventory;
}

export function deleteItem(id) {
    const newInventory = store.inventory.filter(item => item.id !== id);
    saveInventory(newInventory);
    return newInventory;
}

export function consumeIngredients(ingredients, familySize) {
    const inventory = store.inventory;
    let consumedItems = [];
    let errors = [];
    ingredients.forEach(ing => {
        const needed = ing.quantity * familySize;
        const inventoryItem = inventory.find(item => item.name.includes(ing.name) || ing.name.includes(item.name));
        if (inventoryItem) {
            if (inventoryItem.quantity >= needed) {
                inventoryItem.quantity -= needed;
                consumedItems.push({ name: inventoryItem.name, consumed: needed, unit: inventoryItem.unit, remaining: inventoryItem.quantity });
            } else {
                errors.push(`${inventoryItem.name} (موجودی: ${inventoryItem.quantity} ${inventoryItem.unit}، نیاز: ${needed} ${inventoryItem.unit})`);
            }
        } else {
            errors.push(`${ing.name} (در انبار موجود نیست)`);
        }
    });
    if (errors.length > 0) {
        return { success: false, errors: errors, message: 'مواد کافی برای این غذا وجود ندارد:\n' + errors.join('\n') };
    }
    saveInventory(inventory);
    return { success: true, consumedItems: consumedItems, message: 'مواد با موفقیت مصرف شدند.' };
}
