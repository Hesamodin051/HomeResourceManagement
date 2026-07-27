// modules/org-consumption.js
// نسخه‌ی مستقل برای بخش سازمانی - بدون تداخل با consumption.js اصلی

import { orgStore, setOrgConsumptionData } from './org-store.js';

// ============================================================
// کلیدهای ذخیره‌سازی در localStorage
// ============================================================
function getOrgConsumptionKey() {
    const org = orgStore.currentOrganization;
    if (org && org.id) {
        return `org_consumption_${org.id}`;
    }
    return 'org_consumption_default';
}

function getOrgUsersKey() {
    return 'org_users_list';
}

// ============================================================
// بارگذاری داده‌های مصرف سازمانی از localStorage
// ============================================================
export function loadOrgConsumptionData() {
    const key = getOrgConsumptionKey();
    const stored = localStorage.getItem(key);
    let data;
    
    if (stored) {
        data = JSON.parse(stored);
    } else {
        data = generateOrgSampleData();
        saveOrgConsumptionData(data);
    }
    
    setOrgConsumptionData(data);
    return data;
}

// ============================================================
// تولید داده‌های نمونه برای سازمان
// ============================================================
function generateOrgSampleData() {
    const dates = [];
    const water = [];
    const electricity = [];
    const gas = [];
    
    const today = new Date();
    for (let i = 30; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        dates.push(date.toISOString().slice(0, 10));
        water.push(Math.round((Math.random() * 200 + 100) * 10) / 10);
        electricity.push(Math.round((Math.random() * 10 + 5) * 10) / 10);
        gas.push(Math.round((Math.random() * 5 + 2) * 10) / 10);
    }
    
    return { dates, water, electricity, gas };
}

// ============================================================
// ذخیره داده‌های مصرف سازمانی
// ============================================================
export function saveOrgConsumptionData(data) {
    const key = getOrgConsumptionKey();
    localStorage.setItem(key, JSON.stringify(data));
    setOrgConsumptionData(data);
}

// ============================================================
// ذخیره مصرف روزانه سازمانی
// ============================================================
export function saveOrgTodayConsumption(water, electricity, gas) {
    const data = { ...orgStore.orgConsumptionData };
    const today = new Date().toISOString().slice(0, 10);
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
        if (data.dates.length > 365) {
            data.dates.shift();
            data.water.shift();
            data.electricity.shift();
            data.gas.shift();
        }
    }
    saveOrgConsumptionData(data);
    return data;
}

// ============================================================
// دریافت میانگین مصرف سازمانی
// ============================================================
export function getOrgAverageConsumption(days = 30) {
    const data = orgStore.orgConsumptionData;
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

// ============================================================
// بارگذاری لیست کاربران سازمانی
// ============================================================
export function loadOrgUsers() {
    try {
        const stored = localStorage.getItem(getOrgUsersKey());
        if (stored) {
            const users = JSON.parse(stored);
            orgStore.orgUsers = users;
            return users;
        }
    } catch (e) {
        console.warn('⚠️ خطا در بارگذاری کاربران سازمانی:', e);
    }
    return [];
}

// ============================================================
// ذخیره لیست کاربران سازمانی
// ============================================================
export function saveOrgUsers(users) {
    try {
        localStorage.setItem(getOrgUsersKey(), JSON.stringify(users));
        orgStore.orgUsers = users;
    } catch (e) {
        console.warn('⚠️ خطا در ذخیره کاربران سازمانی:', e);
    }
}

// ============================================================
// افزودن کاربر به لیست سازمانی
// ============================================================
export function addOrgUser(username, profile) {
    const users = orgStore.orgUsers || [];
    if (!users.find(u => u.username === username)) {
        users.push({ username, ...profile, addedAt: new Date().toISOString() });
        saveOrgUsers(users);
    }
    return users;
}

// ============================================================
// حذف کاربر از لیست سازمانی
// ============================================================
export function removeOrgUser(username) {
    const users = orgStore.orgUsers || [];
    const filtered = users.filter(u => u.username !== username);
    saveOrgUsers(filtered);
    return filtered;
}
