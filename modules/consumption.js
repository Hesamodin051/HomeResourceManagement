// modules/consumption.js
import { store, setConsumptionData } from './store.js';

function getConsumptionKey() {
    const user = store.currentUser || 'default';
    return `daily_consumption_${user}`;
}

export function loadConsumptionData() {
    const key = getConsumptionKey();
    const stored = localStorage.getItem(key);
    let data;
    if (stored) {
        data = JSON.parse(stored);
    } else {
        // ✅ داده‌های نمونه حذف شد - ساختار خالی
        data = { dates: [], water: [], electricity: [], gas: [] };
        saveConsumptionData(data);
    }
    setConsumptionData(data);
    return data;
}

export function saveConsumptionData(data) {
    const key = getConsumptionKey();
    localStorage.setItem(key, JSON.stringify(data));
    setConsumptionData(data);
}

export function saveTodayConsumption(water, electricity, gas) {
    const data = { ...store.consumptionData };
    const today = new Date().toISOString().slice(0,10);
    const index = data.dates.indexOf(today);
    if (index !== -1) {
        data.water[index] = water;
        data.electricity[index] = electricity;
        data.gas[index] = gas;
    } else {
        data.dates.push(today);
        data.water.push(water);
        data.electricity.push(electricity);
        data.gas.push(gas);
        if (data.dates.length > 7) {
            data.dates.shift();
            data.water.shift();
            data.electricity.shift();
            data.gas.shift();
        }
    }
    saveConsumptionData(data);
    return data;
}

export function getAverageConsumption(days = 7) {
    const data = store.consumptionData;
    if (!data || data.dates.length === 0) return null;
    const count = Math.min(days, data.dates.length);
    const slice = {
        water: data.water.slice(-count),
        electricity: data.electricity.slice(-count),
        gas: data.gas.slice(-count)
    };
    return {
        water: slice.water.reduce((a,b) => a+b, 0) / slice.water.length,
        electricity: slice.electricity.reduce((a,b) => a+b, 0) / slice.electricity.length,
        gas: slice.gas.reduce((a,b) => a+b, 0) / slice.gas.length
    };
}
