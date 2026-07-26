// modules/db.js - مدیریت پایگاه داده با IndexedDB

const DB_NAME = 'TadbirHomeDB';
const DB_VERSION = 3;

let dbInstance = null;

// ============================================================
// باز کردن اتصال به پایگاه داده
// ============================================================
export function openDatabase() {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // ===== Object Store: دسته‌بندی‌ها =====
            if (!db.objectStoreNames.contains('categories')) {
                const store = db.createObjectStore('categories', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                store.createIndex('name', 'name', { unique: true });
                console.log('✅ Object Store "categories" ایجاد شد');
            }

            // ===== Object Store: مواد غذایی =====
            if (!db.objectStoreNames.contains('food_items')) {
                const store = db.createObjectStore('food_items', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                store.createIndex('category', 'category', { unique: false });
                store.createIndex('name', 'name', { unique: false });
                console.log('✅ Object Store "food_items" ایجاد شد');
            }

            // ===== Object Store: تاریخچه =====
            if (!db.objectStoreNames.contains('history')) {
                const store = db.createObjectStore('history', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                console.log('✅ Object Store "history" ایجاد شد');
            }
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            console.log('✅ اتصال به IndexedDB برقرار شد');
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            console.error('❌ خطا در اتصال به IndexedDB:', event.target.error);
            reject(event.target.error);
        };
    });
}

// ============================================================
// ابزار: تبدیل به Promise برای عملیات‌ها
// ============================================================
function performTransaction(storeName, mode, callback) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openDatabase();
            const transaction = db.transaction(storeName, mode);
            const store = transaction.objectStore(storeName);
            const result = callback(store);
            
            transaction.oncomplete = () => resolve(result);
            transaction.onerror = (event) => reject(event.target.error);
        } catch (error) {
            reject(error);
        }
    });
}

// ============================================================
// ===== عملیات روی دسته‌بندی‌ها (Categories) =====
// ============================================================

// دریافت همه دسته‌بندی‌ها
export async function getAllCategories() {
    return performTransaction('categories', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
}

// افزودن دسته‌بندی جدید
export async function addCategory(name) {
    // بررسی وجود دسته تکراری
    const categories = await getAllCategories();
    if (categories.some(c => c.name === name)) {
        throw new Error('این دسته قبلاً وجود دارد.');
    }

    return performTransaction('categories', 'readwrite', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.add({ name });
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
}

// حذف دسته‌بندی
export async function deleteCategory(id) {
    // بررسی اینکه آیا مواد غذایی با این دسته وجود دارد
    const items = await getItemsByCategory(id);
    if (items.length > 0) {
        throw new Error('این دسته دارای مواد غذایی است. ابتدا آنها را حذف کنید.');
    }

    return performTransaction('categories', 'readwrite', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
}

// ویرایش دسته‌بندی
export async function updateCategory(id, newName) {
    const categories = await getAllCategories();
    if (categories.some(c => c.name === newName && c.id !== id)) {
        throw new Error('این نام قبلاً وجود دارد.');
    }

    return performTransaction('categories', 'readwrite', (store) => {
        return new Promise((resolve, reject) => {
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const category = getRequest.result;
                if (!category) {
                    reject(new Error('دسته پیدا نشد'));
                    return;
                }
                category.name = newName;
                const putRequest = store.put(category);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    });
}

// ============================================================
// ===== عملیات روی مواد غذایی (Food Items) =====
// ============================================================

// دریافت همه مواد غذایی
export async function getAllFoodItems() {
    return performTransaction('food_items', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
}

// دریافت مواد غذایی بر اساس دسته
export async function getItemsByCategory(categoryId) {
    const allItems = await getAllFoodItems();
    return allItems.filter(item => item.categoryId === categoryId);
}

// افزودن ماده غذایی جدید
export async function addFoodItem(item) {
    // بررسی وجود ماده تکراری
    const allItems = await getAllFoodItems();
    if (allItems.some(i => i.name === item.name && i.categoryId === item.categoryId)) {
        throw new Error('این ماده قبلاً در این دسته ثبت شده است.');
    }

    return performTransaction('food_items', 'readwrite', (store) => {
        return new Promise((resolve, reject) => {
            const newItem = {
                ...item,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            const request = store.add(newItem);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
}

// ویرایش ماده غذایی
export async function updateFoodItem(id, updates) {
    return performTransaction('food_items', 'readwrite', (store) => {
        return new Promise((resolve, reject) => {
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const item = getRequest.result;
                if (!item) {
                    reject(new Error('ماده غذایی پیدا نشد'));
                    return;
                }
                const updatedItem = { 
                    ...item, 
                    ...updates, 
                    updatedAt: new Date().toISOString() 
                };
                const putRequest = store.put(updatedItem);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    });
}

// حذف ماده غذایی
export async function deleteFoodItem(id) {
    return performTransaction('food_items', 'readwrite', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
}

// ============================================================
// ===== عملیات روی تاریخچه (History) =====
// ============================================================

// افزودن به تاریخچه
export async function addHistory(action, item) {
    return performTransaction('history', 'readwrite', (store) => {
        return new Promise((resolve, reject) => {
            const historyEntry = {
                timestamp: new Date().toISOString(),
                action,
                category: item.category,
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                expiry: item.expiry || 'بدون تاریخ'
            };
            const request = store.add(historyEntry);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    });
}

// دریافت تاریخچه
export async function getHistory(limit = 50) {
    return performTransaction('history', 'readonly', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const history = request.result;
                // مرتب‌سازی بر اساس زمان (جدیدترین اول)
                history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                resolve(history.slice(0, limit));
            };
            request.onerror = () => reject(request.error);
        });
    });
}

// پاک کردن تاریخچه
export async function clearHistory() {
    return performTransaction('history', 'readwrite', (store) => {
        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
}

// ============================================================
// ===== مقداردهی اولیه (Seed) =====
// ============================================================

// ایجاد دسته‌بندی‌های پیش‌فرض در اولین بار
export async function seedDefaultCategories() {
    const categories = await getAllCategories();
    if (categories.length > 0) return;

    const defaultCategories = [
        'غلات', 'حبوبات', 'لبنیات', 'پروتئین', 
        'سبزیجات', 'میوه‌ها', 'چاشنی‌ها', 'نان', 
        'نوشیدنی', 'سایر'
    ];

    for (const name of defaultCategories) {
        await addCategory(name);
    }
    console.log('✅ دسته‌بندی‌های پیش‌فرض ایجاد شدند.');
}

// ============================================================
// صادرات پیش‌فرض
// ============================================================
export default {
    openDatabase,
    getAllCategories,
    addCategory,
    deleteCategory,
    updateCategory,
    getAllFoodItems,
    getItemsByCategory,
    addFoodItem,
    updateFoodItem,
    deleteFoodItem,
    addHistory,
    getHistory,
    clearHistory,
    seedDefaultCategories
};
