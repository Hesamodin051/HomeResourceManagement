// modules/org-store.js
// نسخه‌ی مستقل برای بخش سازمانی - بدون تداخل با store.js اصلی

export const orgStore = {
    // داده‌های سازمانی (برای پنل مدیریت)
    organizations: [],
    currentOrganization: null,
    orgConsumptionData: {
        dates: [],
        water: [],
        electricity: [],
        gas: []
    },
    orgUsers: [],
    listeners: []
};

// ============================================================
// توابع مدیریت سازمان‌ها
// ============================================================
export function setOrganizations(orgs) {
    orgStore.organizations = orgs;
    notifyOrgListeners('organizations', orgs);
}

export function getOrganizations() {
    return orgStore.organizations;
}

export function setCurrentOrganization(org) {
    orgStore.currentOrganization = org;
    notifyOrgListeners('currentOrganization', org);
}

export function getCurrentOrganization() {
    return orgStore.currentOrganization;
}

// ============================================================
// توابع مدیریت داده‌های مصرف سازمانی
// ============================================================
export function setOrgConsumptionData(data) {
    orgStore.orgConsumptionData = data;
    notifyOrgListeners('orgConsumptionData', data);
}

export function getOrgConsumptionData() {
    return orgStore.orgConsumptionData;
}

// ============================================================
// توابع مدیریت کاربران سازمانی
// ============================================================
export function setOrgUsers(users) {
    orgStore.orgUsers = users;
    notifyOrgListeners('orgUsers', users);
}

export function getOrgUsers() {
    return orgStore.orgUsers;
}

// ============================================================
// سیستم شنود (Listener)
// ============================================================
function notifyOrgListeners(key, value) {
    orgStore.listeners.forEach(listener => {
        if (listener.key === key) listener.callback(value);
    });
}

export function addOrgListener(key, callback) {
    orgStore.listeners.push({ key, callback });
}

// ============================================================
// پاک کردن داده‌های سازمانی (برای خروج)
// ============================================================
export function clearOrgData() {
    orgStore.currentOrganization = null;
    orgStore.orgConsumptionData = { dates: [], water: [], electricity: [], gas: [] };
    orgStore.orgUsers = [];
    notifyOrgListeners('clear', null);
}
