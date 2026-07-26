// modules/inventory.js
import { store, setInventory } from './store.js';

function getInventoryKey() {
    const user = store.currentUser || 'default';
    return `home_inventory_${user}`;
}

export function loadInventory() {
    const key = getInventoryKey();
    const stored = localStorage.getItem(key);
    let inv = [];
    if (stored) {
        inv = JSON.parse(stored);
    } else {
        // ✅ داده‌های پیش‌فرض حذف شد - آرایه خالی
        inv = [];
        saveInventory(inv);
    }
    setInventory(inv);
    return inv;
}

export function saveInventory(inventory) {
    const key = getInventoryKey();
    localStorage.setItem(key, JSON.stringify(inventory));
    setInventory(inventory);
}

export function addItem(name, quantity, unit, expiry, type = 'normal') {
    const newItem = { 
        id: Date.now(), 
        name, 
        quantity, 
        unit, 
        expiry: expiry || '',
        type: type || 'normal'
    };
    const newInventory = [...store.inventory, newItem];
    saveInventory(newInventory);
    return newInventory;
}

export function editItem(id, newName, newQty, newUnit, newExpiry, newType) {
    const newInventory = store.inventory.map(item =>
        item.id === id ? { 
            ...item, 
            name: newName, 
            quantity: newQty, 
            unit: newUnit, 
            expiry: newExpiry,
            type: newType || item.type || 'normal'
        } : item
    );
    saveInventory(newInventory);
    return newInventory;
}

export function deleteItem(id) {
    const newInventory = store.inventory.filter(item => item.id !== id);
    saveInventory(newInventory);
    return newInventory;
}

export function getNormalItems() {
    return store.inventory.filter(item => item.type === 'normal' || !item.type);
}

export function getCrisisItems() {
    return store.inventory.filter(item => item.type === 'crisis');
}

export function getCrisisWater() {
    const items = getCrisisItems();
    return items.find(item => item.name.toLowerCase().includes('آب'));
}
