// modules/store.js
export const store = {
    currentUser: null,
    currentUserProfile: null,
    crisisMode: false,
    inventory: [],
    consumptionData: {
        dates: [],
        water: [],
        electricity: [],
        gas: []
    },
    listeners: [],
    _isUpdating: false  // پرچم جلوگیری از حلقه
};

export function setCrisisMode(active) {
    store.crisisMode = active;
    notifyListeners('crisisMode', active);
}

export function setInventory(newInventory) {
    if (store._isUpdating) {
        console.warn('⚠️ جلوگیری از به‌روزرسانی همزمان inventory');
        return;
    }
    store._isUpdating = true;
    store.inventory = newInventory;
    notifyListeners('inventory', newInventory);
    store._isUpdating = false;
}

export function setConsumptionData(data) {
    store.consumptionData = data;
    notifyListeners('consumptionData', data);
}

export function setCurrentUser(user) {
    store.currentUser = user;
    notifyListeners('currentUser', user);
}

export function setCurrentUserProfile(profile) {
    store.currentUserProfile = profile;
    notifyListeners('currentUserProfile', profile);
}

function notifyListeners(key, value) {
    store.listeners.forEach(listener => {
        if (listener.key === key) listener.callback(value);
    });
}

export function addListener(key, callback) {
    store.listeners.push({ key, callback });
}
