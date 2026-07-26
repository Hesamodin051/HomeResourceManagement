// notifications.js
import { getLoggedInUser } from './modules/auth.js';
import { initDrawer, updateDrawerItems } from './modules/drawer.js';

const NOTIFICATIONS_KEY = 'app_notifications';

// ============================================================
// 1. توابع مدیریت داده
// ============================================================

function getNotifications() {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    return stored ? JSON.parse(stored) : [];
}

function saveNotifications(notifications) {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(notifications));
    if (window.updateNotificationBadge) {
        window.updateNotificationBadge();
    }
}

// ============================================================
// 2. تولید اعلان‌های نمونه با لینک
// ============================================================

function generateSampleNotifications() {
    const existing = getNotifications();
    if (existing.length > 0) return existing;

    const now = new Date();
    const samples = [
        {
            id: Date.now() + 1,
            title: 'خوش آمدید!',
            message: 'به سامانه تدبیر منزل خوش آمدید. لطفاً پروفایل خود را تکمیل کنید.',
            type: 'info',
            date: now.toISOString(),
            read: false,
            link: 'profile.html'  // لینک به صفحه پروفایل
        },
        {
            id: Date.now() + 2,
            title: 'یادآوری ثبت مصرف',
            message: 'مصرف امروز خود را ثبت کنید تا بتوانیم پیشنهادات دقیق‌تری ارائه دهیم.',
            type: 'warning',
            date: new Date(now.getTime() - 3600000).toISOString(),
            read: false,
            link: 'dashboard.html'  // لینک به داشبورد
        },
        {
            id: Date.now() + 3,
            title: 'نزدیکی به تاریخ انقضا',
            message: 'برنج شما تا ۵ روز دیگر تاریخ انقضای آن تمام می‌شود. زودتر مصرف کنید.',
            type: 'danger',
            date: new Date(now.getTime() - 7200000).toISOString(),
            read: false,
            link: 'food.html'  // لینک به صفحه مواد غذایی
        },
        {
            id: Date.now() + 4,
            title: 'پیشنهاد هوشمند',
            message: 'مصرف آب شما نسبت به هفته قبل ۱۵٪ کاهش یافته است. این روند عالی را ادامه دهید!',
            type: 'success',
            date: new Date(now.getTime() - 86400000).toISOString(),
            read: false,
            link: 'dashboard.html'
        }
    ];

    saveNotifications(samples);
    return samples;
}

// ============================================================
// 3. تابع تعیین لینک بر اساس محتوای اعلان (برای اعلان‌های قدیمی)
// ============================================================

function getNotificationLink(notification) {
    // اگر خود اعلان دارای لینک باشد، همان را برمی‌گردانیم
    if (notification.link) return notification.link;

    // در غیر این صورت بر اساس عنوان یا نوع تصمیم می‌گیریم
    const title = notification.title;
    if (title.includes('تاریخ انقضا') || title.includes('مواد غذایی')) return 'food.html';
    if (title.includes('مصرف') || title.includes('پیشنهاد')) return 'dashboard.html';
    if (title.includes('پروفایل') || title.includes('کاربری')) return 'profile.html';
    if (title.includes('بحران')) return 'dashboard.html';
    if (title.includes('انرژی')) return 'energy.html';
    
    // پیش‌فرض: داشبورد
    return 'dashboard.html';
}

// ============================================================
// 4. نمایش اعلان‌ها با قابلیت کلیک
// ============================================================

function renderNotifications() {
    const container = document.getElementById('notificationsList');
    if (!container) return;

    const notifications = getNotifications();

    if (notifications.length === 0) {
        container.innerHTML = `
            <div class="card-modern p-8 text-center text-gray-400">
                <i class="fas fa-inbox text-5xl mb-3 block"></i>
                <p>✅ همه اعلان‌ها خوانده شدند.</p>
                <p class="text-sm mt-2">هیچ اعلان جدیدی وجود ندارد.</p>
            </div>
        `;
        return;
    }

    // مرتب‌سازی بر اساس تاریخ (جدیدترین اول)
    const sorted = [...notifications].sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = sorted.map(notif => {
        const link = getNotificationLink(notif);
        return `
            <div class="card-modern p-4 border-r-4 ${notif.read ? 'border-gray-300 opacity-70' : 'border-blue-500'} transition-all duration-300 hover:shadow-lg cursor-pointer notification-item" 
                 data-link="${link}" data-id="${notif.id}" data-read="${notif.read}">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center gap-2">
                            <span class="text-lg">${getNotificationIcon(notif.type)}</span>
                            <h4 class="font-bold text-primary ${notif.read ? 'text-gray-500' : ''}">${notif.title}</h4>
                            ${!notif.read ? '<span class="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full">جدید</span>' : ''}
                        </div>
                        <p class="text-sm text-gray-600 mt-1 ${notif.read ? 'text-gray-400' : ''}">${notif.message}</p>
                        <p class="text-xs text-gray-400 mt-2">${formatDate(notif.date)}</p>
                    </div>
                    <div class="flex gap-1 flex-shrink-0">
                        ${!notif.read ? `
                            <button class="mark-read-btn text-xs text-blue-500 hover:text-blue-700 hover:underline p-1" data-id="${notif.id}">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                        <button class="delete-notif-btn text-xs text-red-500 hover:text-red-700 hover:underline p-1" data-id="${notif.id}">
                            <i class="fas fa-trash-can"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // ===== رویداد کلیک روی کارت اعلان =====
    document.querySelectorAll('.notification-item').forEach(card => {
        card.addEventListener('click', function(e) {
            // اگر روی دکمه‌های داخلی کلیک شده باشد، نادیده بگیر
            if (e.target.closest('.mark-read-btn') || e.target.closest('.delete-notif-btn')) return;

            const link = this.dataset.link;
            const id = parseInt(this.dataset.id);
            const isRead = this.dataset.read === 'true';

            // اگر نخوانده بود، ابتدا علامت بخوان
            if (!isRead) {
                markAsRead(id);
            }

            // هدایت به صفحه مربوطه
            if (link) {
                window.location.href = link;
            }
        });
    });

    // ===== رویدادهای دکمه‌ها =====
    document.querySelectorAll('.mark-read-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = parseInt(this.dataset.id);
            markAsRead(id);
        });
    });

    document.querySelectorAll('.delete-notif-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            const id = parseInt(this.dataset.id);
            deleteNotification(id);
        });
    });
}

// ============================================================
// 5. توابع کمکی
// ============================================================

function getNotificationIcon(type) {
    const icons = {
        info: 'ℹ️',
        warning: '⚠️',
        danger: '🔴',
        success: '✅',
        default: '📌'
    };
    return icons[type] || icons.default;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'همین الان';
    if (diffMins < 60) return `${diffMins} دقیقه پیش`;
    if (diffHours < 24) return `${diffHours} ساعت پیش`;
    if (diffDays < 7) return `${diffDays} روز پیش`;
    
    return date.toLocaleDateString('fa-IR') + ' ' + date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
}

// ============================================================
// 6. عملیات روی اعلان‌ها
// ============================================================

function markAsRead(id) {
    const notifications = getNotifications();
    const updated = notifications.map(n => 
        n.id === id ? { ...n, read: true } : n
    );
    saveNotifications(updated);
    renderNotifications();
}

function deleteNotification(id) {
    if (!confirm('آیا از حذف این اعلان اطمینان دارید؟')) return;
    const notifications = getNotifications();
    const updated = notifications.filter(n => n.id !== id);
    saveNotifications(updated);
    renderNotifications();
}

function markAllAsRead() {
    const notifications = getNotifications();
    if (notifications.length === 0) {
        alert('هیچ اعلانی برای علامت‌گذاری وجود ندارد.');
        return;
    }
    const updated = notifications.map(n => ({ ...n, read: true }));
    saveNotifications(updated);
    renderNotifications();
}

function clearAllNotifications() {
    const notifications = getNotifications();
    if (notifications.length === 0) {
        alert('هیچ اعلانی برای پاک کردن وجود ندارد.');
        return;
    }
    if (!confirm('آیا از پاک کردن همه اعلان‌ها اطمینان دارید؟')) return;
    saveNotifications([]);
    renderNotifications();
}

// ============================================================
// 7. اضافه کردن اعلان جدید با لینک
// ============================================================

function addNotification(title, message, type = 'info', link = null) {
    const notifications = getNotifications();
    const newNotification = {
        id: Date.now(),
        title,
        message,
        type,
        date: new Date().toISOString(),
        read: false,
        link: link || getLinkFromTitle(title)  // اگر لینک داده نشد، از عنوان حدس بزن
    };
    notifications.unshift(newNotification);
    saveNotifications(notifications);
    if (document.getElementById('notificationsList')) {
        renderNotifications();
    }
    return newNotification;
}

// تابع کمکی برای حدس لینک از عنوان
function getLinkFromTitle(title) {
    if (title.includes('تاریخ انقضا') || title.includes('مواد غذایی')) return 'food.html';
    if (title.includes('مصرف') || title.includes('پیشنهاد')) return 'dashboard.html';
    if (title.includes('پروفایل')) return 'profile.html';
    if (title.includes('انرژی')) return 'energy.html';
    if (title.includes('بحران')) return 'dashboard.html';
    return 'dashboard.html';
}

// ============================================================
// 8. مقداردهی اولیه
// ============================================================

function init() {
    if (!getLoggedInUser()) {
        window.location.href = 'index.html';
        return;
    }

    initDrawer();
    updateDrawerItems();

    generateSampleNotifications();
    renderNotifications();

    const markAllBtn = document.getElementById('markAllReadBtn');
    if (markAllBtn) markAllBtn.addEventListener('click', markAllAsRead);

    const clearAllBtn = document.getElementById('clearAllBtn');
    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAllNotifications);

    setInterval(renderNotifications, 30000);
}

// ============================================================
// 9. صادرات
// ============================================================

window.NotificationManager = {
    addNotification,
    getNotifications,
    markAsRead,
    deleteNotification,
    clearAllNotifications,
    markAllAsRead,
    renderNotifications
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

export default {
    addNotification,
    getNotifications,
    markAsRead,
    deleteNotification,
    clearAllNotifications,
    markAllAsRead,
    renderNotifications
};
