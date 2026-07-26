// modules/medications.js
import { store } from './store.js';

const STORAGE_KEY = 'user_medications';
const REMINDERS_KEY = 'medication_reminders';

// ===== دریافت لیست داروها =====
export function getMedications() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

// ===== ذخیره لیست داروها =====
export function saveMedications(medications) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(medications));
}

// ===== دریافت یادآوری‌ها =====
export function getReminders() {
    const stored = localStorage.getItem(REMINDERS_KEY);
    return stored ? JSON.parse(stored) : [];
}

// ===== ذخیره یادآوری‌ها =====
function saveReminders(reminders) {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
}

// ===== افزودن دارو =====
export function addMedication(medication) {
    const medications = getMedications();
    const newMed = {
        id: Date.now(),
        ...medication,
        createdAt: new Date().toISOString(),
        lastTaken: null,
        takenCount: 0
    };
    medications.push(newMed);
    saveMedications(medications);
    
    // تنظیم یادآوری
    scheduleReminders(newMed);
    
    return newMed;
}

// ===== ویرایش دارو =====
export function updateMedication(id, updates) {
    const medications = getMedications();
    const index = medications.findIndex(m => m.id === id);
    if (index === -1) return null;
    medications[index] = { ...medications[index], ...updates };
    saveMedications(medications);
    
    // تنظیم مجدد یادآوری‌ها
    clearReminders(id);
    scheduleReminders(medications[index]);
    
    return medications[index];
}

// ===== حذف دارو =====
export function deleteMedication(id) {
    let medications = getMedications();
    medications = medications.filter(m => m.id !== id);
    saveMedications(medications);
    clearReminders(id);
}

// ===== ثبت مصرف دارو =====
export function takeMedication(id) {
    const medications = getMedications();
    const index = medications.findIndex(m => m.id === id);
    if (index === -1) return null;
    medications[index].lastTaken = new Date().toISOString();
    medications[index].takenCount = (medications[index].takenCount || 0) + 1;
    saveMedications(medications);
    
    // اضافه کردن به تاریخچه مصرف
    addToHistory(id, medications[index].name);
    
    return medications[index];
}

// ===== تاریخچه مصرف =====
function addToHistory(medId, medName) {
    const history = JSON.parse(localStorage.getItem('medication_history') || '[]');
    history.push({
        medId,
        medName,
        takenAt: new Date().toISOString()
    });
    if (history.length > 100) history.shift(); // نگه‌داری ۱۰۰ مورد آخر
    localStorage.setItem('medication_history', JSON.stringify(history));
}

export function getHistory() {
    return JSON.parse(localStorage.getItem('medication_history') || '[]');
}

// ===== تنظیم یادآوری =====
function scheduleReminders(medication) {
    if (!medication.times || medication.times.length === 0) return;
    
    const reminders = getReminders();
    medication.times.forEach(time => {
        const [hours, minutes] = time.split(':').map(Number);
        const now = new Date();
        const target = new Date();
        target.setHours(hours, minutes, 0, 0);
        
        // اگر زمان گذشته، برای روز بعد تنظیم کن
        if (target <= now) {
            target.setDate(target.getDate() + 1);
        }
        
        const delay = target.getTime() - now.getTime();
        
        const reminderId = setTimeout(() => {
            sendMedicationReminder(medication);
            // تنظیم مجدد برای روز بعد
            scheduleReminders(medication);
        }, delay);
        
        reminders.push({
            id: reminderId,
            medId: medication.id,
            time: time,
            date: target.toISOString()
        });
    });
    saveReminders(reminders);
}

// ===== پاک کردن یادآوری‌های یک دارو =====
function clearReminders(medId) {
    const reminders = getReminders();
    const filtered = reminders.filter(r => r.medId !== medId);
    saveReminders(filtered);
}

// ===== ارسال یادآوری =====
function sendMedicationReminder(medication) {
    const title = `💊 یادآوری مصرف دارو`;
    const body = `${medication.name} (${medication.dosage || ''}) - زمان مصرف فرا رسید.`;
    
    // اعلان مرورگر
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: '/icons/icon-192.png',
            tag: `med-${medication.id}`,
            requireInteraction: true
        });
    }
    
    // نمایش در صفحه (اگر باز باشد)
    const event = new CustomEvent('medicationReminder', {
        detail: { medication, title, body }
    });
    document.dispatchEvent(event);
}

// ===== دریافت داروهای در حال اتمام =====
export function getLowStockMedications(threshold = 3) {
    const medications = getMedications();
    return medications.filter(m => m.quantity <= threshold);
}

// ===== دریافت داروهای در حال انقضا =====
export function getExpiringMedications(days = 7) {
    const medications = getMedications();
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);
    
    return medications.filter(m => {
        if (!m.expiry) return false;
        const expiry = new Date(m.expiry);
        return expiry >= now && expiry <= future;
    });
}

// ===== دریافت داروهای نیازمند یخچال =====
export function getRefrigeratorMedications() {
    const medications = getMedications();
    return medications.filter(m => m.storage === 'refrigerator');
}

// ===== درخواست مجوز اعلان =====
export function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.warn('مرورگر از Notification پشتیبانی نمی‌کند.');
        return;
    }
    if (Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

// ===== مقداردهی اولیه =====
export function initMedications() {
    requestNotificationPermission();
    // بازیابی یادآوری‌های ذخیره‌شده
    const reminders = getReminders();
    reminders.forEach(r => {
        // تنظیم مجدد یادآوری‌ها در صورت نیاز
        const med = getMedications().find(m => m.id === r.medId);
        if (med) {
            scheduleReminders(med);
        }
    });
}
