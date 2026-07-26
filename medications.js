// medications.js
import { getLoggedInUser } from './modules/auth.js';
import {
    getMedications,
    saveMedications,
    addMedication,
    updateMedication,
    deleteMedication,
    takeMedication,
    getHistory,
    getLowStockMedications,
    getExpiringMedications,
    getRefrigeratorMedications,
    initMedications
} from './modules/medications.js';

// ===== عناصر DOM =====
const form = document.getElementById('medicationForm');
const tbody = document.getElementById('medicationBody');
const alertContainer = document.getElementById('alertContainer');
const medCount = document.getElementById('medCount');
const formMessage = document.getElementById('formMessage');

let editingId = null;

// ===== نمایش هشدارها =====
function renderAlerts() {
    const lowStock = getLowStockMedications(3);
    const expiring = getExpiringMedications(7);
    const refrigerator = getRefrigeratorMedications();

    let alerts = [];

    lowStock.forEach(med => {
        alerts.push({
            type: 'warning',
            title: `⚠️ کمبود ${med.name}`,
            message: `فقط ${med.quantity} ${med.unit || 'عدد'} باقی مانده است. لطفاً تهیه کنید.`
        });
    });

    expiring.forEach(med => {
        const daysLeft = Math.ceil((new Date(med.expiry) - new Date()) / (1000 * 60 * 60 * 24));
        alerts.push({
            type: 'danger',
            title: `🔴 نزدیکی به انقضا: ${med.name}`,
            message: `${daysLeft} روز تا تاریخ انقضا (${med.expiry}) باقی مانده است.`
        });
    });

    refrigerator.forEach(med => {
        alerts.push({
            type: 'info',
            title: `❄️ داروی یخچالی: ${med.name}`,
            message: 'این دارو باید در یخچال نگهداری شود. مطمئن شوید که دمای یخچال مناسب است.'
        });
    });

    if (alerts.length === 0) {
        alertContainer.innerHTML = `
            <div class="alert-panel-modern alert-success">
                ✅ همه داروها در وضعیت مناسب هستند. به پایش ادامه دهید.
            </div>
        `;
        return;
    }

    alertContainer.innerHTML = alerts.map(alert => `
        <div class="alert-panel-modern alert-${alert.type}">
            <div>
                <strong>${alert.title}</strong>
                <p class="text-sm mt-1">${alert.message}</p>
            </div>
        </div>
    `).join('');
}

// ===== رندر جدول داروها =====
function renderMedications() {
    const medications = getMedications();

    if (medications.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-gray-400">هیچ دارویی ثبت نشده است.</td></tr>`;
        medCount.textContent = '۰ دارو';
        return;
    }

    medCount.textContent = `${medications.length} دارو`;

    tbody.innerHTML = medications.map(med => `
        <tr>
            <td class="font-medium">${med.name}</td>
            <td>${med.dosage || '—'}</td>
            <td>${med.quantity} ${med.unit || ''}</td>
            <td>${med.times ? med.times.join(' - ') : '—'}</td>
            <td>${med.expiry ? new Date(med.expiry).toLocaleDateString('fa-IR') : '—'}</td>
            <td>${getStorageLabel(med.storage)}</td>
            <td>
                <div class="flex gap-1 flex-wrap">
                    <button class="take-btn text-green-600 hover:text-green-800 text-sm" data-id="${med.id}">
                        <i class="fas fa-check-circle"></i>
                    </button>
                    <button class="edit-btn text-blue-600 hover:text-blue-800 text-sm" data-id="${med.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn text-red-600 hover:text-red-800 text-sm" data-id="${med.id}">
                        <i class="fas fa-trash-can"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    // رویدادها
    document.querySelectorAll('.take-btn').forEach(btn => {
        btn.addEventListener('click', () => handleTake(parseInt(btn.dataset.id)));
    });
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => handleEdit(parseInt(btn.dataset.id)));
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDelete(parseInt(btn.dataset.id)));
    });
}

function getStorageLabel(storage) {
    const labels = {
        'room': '🌡️ دمای اتاق',
        'refrigerator': '❄️ یخچال',
        'freezer': '🧊 فریزر',
        'dark': '🌑 محیط تاریک'
    };
    return labels[storage] || storage;
}

// ===== ثبت مصرف دارو =====
function handleTake(id) {
    const med = takeMedication(id);
    if (med) {
        showMessage(`✅ مصرف ${med.name} ثبت شد.`, 'success');
        renderMedications();
        renderAlerts();
    }
}

// ===== ویرایش دارو =====
function handleEdit(id) {
    const medications = getMedications();
    const med = medications.find(m => m.id === id);
    if (!med) return;

    editingId = id;
    document.getElementById('medName').value = med.name;
    document.getElementById('medDosage').value = med.dosage || '';
    document.getElementById('medQuantity').value = med.quantity;
    document.getElementById('medUnit').value = med.unit || 'عدد';
    document.getElementById('medTimes').value = med.times ? med.times.join(',') : '';
    document.getElementById('medExpiry').value = med.expiry || '';
    document.getElementById('medStorage').value = med.storage || 'room';
    document.getElementById('medNotes').value = med.notes || '';

    document.querySelector('#medicationForm button[type="submit"]').innerHTML = 
        '<i class="fas fa-pen ml-2"></i> بروزرسانی دارو';
    document.getElementById('medName').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== حذف دارو =====
function handleDelete(id) {
    if (!confirm('آیا از حذف این دارو اطمینان دارید؟')) return;
    deleteMedication(id);
    renderMedications();
    renderAlerts();
    showMessage('🗑️ دارو با موفقیت حذف شد.', 'info');
}

// ===== نمایش پیام فرم =====
function showMessage(msg, type = 'success') {
    formMessage.textContent = msg;
    formMessage.className = `mt-3 text-sm p-2 rounded-lg ${type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`;
    formMessage.classList.remove('hidden');
    setTimeout(() => formMessage.classList.add('hidden'), 5000);
}

// ===== نمایش تاریخچه مصرف =====
function renderHistory() {
    const history = getHistory();
    const container = document.getElementById('historyList');
    if (history.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-400">هیچ مصرفی ثبت نشده است.</p>';
        return;
    }
    container.innerHTML = history.slice().reverse().slice(0, 50).map(h => `
        <div class="flex justify-between items-center p-2 border-b border-gray-100">
            <span>💊 ${h.medName}</span>
            <span class="text-sm text-gray-500">${new Date(h.takenAt).toLocaleString('fa-IR')}</span>
        </div>
    `).join('');
}

// ===== پردازش فرم =====
form.addEventListener('submit', function(e) {
    e.preventDefault();

    const name = document.getElementById('medName').value.trim();
    const dosage = document.getElementById('medDosage').value.trim();
    const quantity = parseInt(document.getElementById('medQuantity').value);
    const unit = document.getElementById('medUnit').value;
    const timesRaw = document.getElementById('medTimes').value.trim();
    const expiry = document.getElementById('medExpiry').value;
    const storage = document.getElementById('medStorage').value;
    const notes = document.getElementById('medNotes').value.trim();

    if (!name) {
        showMessage('❌ لطفاً نام دارو را وارد کنید.', 'error');
        return;
    }
    if (!quantity || quantity < 1) {
        showMessage('❌ لطفاً تعداد معتبر وارد کنید.', 'error');
        return;
    }

    const times = timesRaw ? timesRaw.split(',').map(t => t.trim()).filter(t => t) : [];

    const medData = {
        name,
        dosage,
        quantity,
        unit,
        times,
        expiry,
        storage,
        notes
    };

    if (editingId) {
        updateMedication(editingId, medData);
        showMessage('✅ دارو با موفقیت بروزرسانی شد.', 'success');
        editingId = null;
        document.querySelector('#medicationForm button[type="submit"]').innerHTML = 
            '<i class="fas fa-save ml-2"></i> افزودن دارو';
    } else {
        addMedication(medData);
        showMessage('✅ دارو با موفقیت اضافه شد.', 'success');
    }

    form.reset();
    renderMedications();
    renderAlerts();
});

// ===== رویدادهای مدال =====
document.getElementById('historyBtn').addEventListener('click', () => {
    renderHistory();
    document.getElementById('historyModal').style.display = 'flex';
});

document.querySelector('.close-modal').addEventListener('click', () => {
    document.getElementById('historyModal').style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === document.getElementById('historyModal')) {
        document.getElementById('historyModal').style.display = 'none';
    }
});

// ===== گوش دادن به یادآوری‌ها =====
document.addEventListener('medicationReminder', function(e) {
    const { medication, title, body } = e.detail;
    showMessage(`🔔 ${title}: ${body}`, 'info');
    // نمایش در هشدارها
    alertContainer.innerHTML = `
        <div class="alert-panel-modern alert-danger">
            <div>
                <strong>${title}</strong>
                <p class="text-sm mt-1">${body}</p>
            </div>
        </div>
    ` + alertContainer.innerHTML;
});

// ===== مقداردهی اولیه =====
function init() {
    if (!getLoggedInUser()) {
        window.location.href = 'index.html';
        return;
    }

    // راه‌اندازی منوی کشو
    (function initDrawer() {
        const hamburger = document.getElementById('hamburgerMenu');
        const drawer = document.getElementById('drawer');
        const backdrop = document.getElementById('drawerBackdrop');
        const closeBtn = document.getElementById('closeDrawerBtn');

        if (!hamburger || !drawer || !backdrop) return;

        function openDrawer() {
            drawer.classList.add('open');
            backdrop.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
        function closeDrawer() {
            drawer.classList.remove('open');
            backdrop.classList.remove('show');
            document.body.style.overflow = '';
        }

        if (!hamburger._listenerAdded) {
            hamburger._listenerAdded = true;
            hamburger.addEventListener('click', openDrawer);
            if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
            backdrop.addEventListener('click', closeDrawer);
            document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
        }
    })();

    // به‌روزرسانی آیتم‌های منو
    (function updateDrawerItems() {
        const container = document.getElementById('drawerItems');
        if (!container) return;

        const isLoggedIn = !!sessionStorage.getItem('loggedInUser');
        const items = isLoggedIn ? [
            { type: 'header', text: 'منوی اصلی' },
            { icon: 'fa-house', text: 'صفحه اصلی', link: 'index.html' },
            { icon: 'fa-chart-pie', text: 'داشبورد', link: 'dashboard.html' },
            { type: 'divider' },
            { type: 'header', text: 'مدیریت منابع' },
            { icon: 'fa-utensils', text: 'مواد غذایی', link: 'food.html' },
            { icon: 'fa-bolt', text: 'مصرف انرژی', link: 'energy.html' },
            { type: 'divider' },
            { type: 'header', text: 'مدیریت بحران' },
            { icon: 'fa-triangle-exclamation', text: 'سناریوهای بحران', link: 'dashboard.html' },
            { icon: 'fa-boxes-stacked', text: 'ذخایر اضطراری', link: 'food.html' },
            { type: 'divider' },
            { type: 'header', text: 'گزارش‌ها' },
            { icon: 'fa-calendar-week', text: 'گزارش هفتگی', link: 'reports.html' },
            { icon: 'fa-calendar-alt', text: 'گزارش ماهانه', link: 'reports.html' },
            { type: 'divider' },
            { type: 'header', text: 'سلامت' },
            { icon: 'fa-pills', text: 'مدیریت داروها', link: 'medications.html' },
            { type: 'divider' },
            { type: 'header', text: 'تنظیمات' },
            { icon: 'fa-user', text: 'پروفایل', link: 'profile.html' },
            { icon: 'fa-bell', text: 'اعلان‌ها', link: 'notifications.html' },
            { icon: 'fa-moon', text: 'تم تاریک', action: 'toggleTheme' },
            { type: 'divider' },
            { icon: 'fa-clock-rotate-left', text: 'تاریخچه چت', link: 'chat-history.html' },
            { type: 'divider' },
            { icon: 'fa-circle-question', text: 'راهنما', link: 'help.html' },
            { icon: 'fa-envelope', text: 'تماس با ما', link: 'contact.html' },
            { type: 'divider' },
            { icon: 'fa-right-from-bracket', text: 'خروج', action: 'logout' }
        ] : [
            { icon: 'fa-house', text: 'صفحه اصلی', link: 'index.html' },
            { icon: 'fa-right-to-bracket', text: 'ورود', link: 'login.html' },
            { icon: 'fa-user-plus', text: 'ثبت‌نام', link: 'login.html' },
            { type: 'divider' },
            { icon: 'fa-circle-question', text: 'راهنما', link: 'help.html' },
            { icon: 'fa-envelope', text: 'تماس با ما', link: 'contact.html' }
        ];

        container.innerHTML = '';
        items.forEach(item => {
            if (item.type === 'divider') {
                const hr = document.createElement('hr');
                hr.style.margin = '0.5rem 0';
                hr.style.border = 'none';
                hr.style.borderTop = '1px solid #e2e8f0';
                container.appendChild(hr);
                return;
            }
            if (item.type === 'header') {
                const header = document.createElement('div');
                header.textContent = item.text;
                header.style.cssText = 'font-size:0.7rem;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;padding:0.5rem 0.25rem;margin-top:0.25rem;';
                container.appendChild(header);
                return;
            }
            const div = document.createElement('div');
            div.className = 'drawer-item';
            const iconSpan = document.createElement('span');
            iconSpan.className = `fas ${item.icon}`;
            iconSpan.style.cssText = 'width:20px;display:inline-block;text-align:center;margin-left:12px;color:#64748b;font-size:1rem;';
            const textSpan = document.createElement('span');
            textSpan.textContent = item.text;
            textSpan.style.cssText = 'color:#334155;font-size:0.95rem;';
            const wrapper = document.createElement('span');
            wrapper.style.cssText = 'display:flex;align-items:center;width:100%;';
            wrapper.appendChild(iconSpan);
            wrapper.appendChild(textSpan);

            if (item.link) {
                const a = document.createElement('a');
                a.href = item.link;
                a.appendChild(wrapper);
                a.style.cssText = 'text-decoration:none;color:inherit;display:block;width:100%;padding:0.25rem 0;';
                div.appendChild(a);
            } else {
                const btn = document.createElement('button');
                btn.appendChild(wrapper);
                btn.style.cssText = 'background:none;border:none;cursor:pointer;width:100%;text-align:right;font-family:inherit;font-size:1rem;padding:0.25rem 0;color:#334155;';
                btn.onclick = function() {
                    switch(item.action) {
                        case 'logout':
                            sessionStorage.removeItem('loggedInUser');
                            window.location.href = 'index.html';
                            break;
                        case 'toggleTheme':
                            document.body.classList.toggle('dark-mode');
                            localStorage.setItem('dark_mode', document.body.classList.contains('dark-mode') ? 'true' : 'false');
                            break;
                        default:
                            console.log('اقدام ناشناخته:', item.action);
                    }
                };
                div.appendChild(btn);
            }
            div.addEventListener('mouseenter', function() {
                const icon = this.querySelector('.fas');
                if (icon) icon.style.color = '#3b82f6';
                const text = this.querySelector('span:not(.fas)');
                if (text) text.style.color = '#3b82f6';
            });
            div.addEventListener('mouseleave', function() {
                const icon = this.querySelector('.fas');
                if (icon) icon.style.color = '#64748b';
                const text = this.querySelector('span:not(.fas)');
                if (text) text.style.color = '#334155';
            });
            container.appendChild(div);
        });
    })();

    // مقداردهی ماژول دارو
    initMedications();

    // رندر اولیه
    renderMedications();
    renderAlerts();
}

// اجرا
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
