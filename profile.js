// profile.js
import { getLoggedInUser, getUserProfile, updateUserProfile, saveUserAvatar, getUserAvatar, logout } from './modules/auth.js';
import { store, setCurrentUserProfile } from './modules/store.js';
import { initDrawer, updateDrawerItems } from './modules/drawer.js';

// ============================================================
// بارگذاری اطلاعات پروفایل (با چک کردن المان‌ها)
// ============================================================
function loadProfile() {
    const username = getLoggedInUser();
    if (!username) {
        window.location.href = 'index.html';
        return;
    }

    const profile = getUserProfile(username);
    if (!profile) {
        alert('خطا در بارگذاری پروفایل.');
        return;
    }

    // === پر کردن فیلدها با چک کردن وجود المان ===
    const setField = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    };
    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    };

    setField('username', username);
    setField('fullName', profile.fullName || '');
    setField('phone', profile.phone || '');
    setField('birthDate', profile.birthDate || '');
    setField('gender', profile.gender || '');
    setField('maritalStatus', profile.maritalStatus || '');
    setField('occupation', profile.occupation || '');
    setField('familySize', profile.familySize || 4);
    setField('address', profile.address || '');
    setField('postalCode', profile.postalCode || '');
    setField('housingType', profile.housingType || '');
    setField('area', profile.area || '');
    setField('constructionYear', profile.constructionYear || '');
    setField('heatingSystem', profile.heatingSystem || '');
    setField('coolingSystem', profile.coolingSystem || '');
    setField('waterHeater', profile.waterHeater || '');
    setField('solarPanel', profile.solarPanel || '');
    setField('annualWater', profile.annualWater || '');
    setField('annualElectricity', profile.annualElectricity || '');
    setField('annualGas', profile.annualGas || '');

    // نام نمایشی
    const displayName = profile.fullName || username;
    setText('profileDisplayName', displayName);
    setText('profileUsername', `@${username}`);

    // آواتار
    const avatar = getUserAvatar(username);
    const avatarImg = document.getElementById('profileAvatar');
    if (avatarImg) {
        if (avatar) {
            avatarImg.src = avatar;
        } else {
            const firstChar = username.charAt(0).toUpperCase();
            avatarImg.src = `https://ui-avatars.com/api/?background=1e466e&color=fff&rounded=true&size=96&name=${firstChar}`;
        }
    }
}

// ============================================================
// ذخیره پروفایل
// ============================================================
function saveProfile(e) {
    e.preventDefault();
    const username = getLoggedInUser();
    if (!username) return;

    const getField = (id) => {
        const el = document.getElementById(id);
        return el ? el.value : '';
    };
    const getFloat = (id) => parseFloat(getField(id)) || 0;
    const getInt = (id) => parseInt(getField(id)) || 0;

    const updates = {
        fullName: getField('fullName').trim(),
        phone: getField('phone').trim(),
        birthDate: getField('birthDate'),
        gender: getField('gender'),
        maritalStatus: getField('maritalStatus'),
        occupation: getField('occupation').trim(),
        familySize: getInt('familySize') || 4,
        address: getField('address').trim(),
        postalCode: getField('postalCode').trim(),
        housingType: getField('housingType'),
        area: getFloat('area'),
        constructionYear: getInt('constructionYear'),
        heatingSystem: getField('heatingSystem'),
        coolingSystem: getField('coolingSystem'),
        waterHeater: getField('waterHeater'),
        solarPanel: getField('solarPanel'),
        annualWater: getFloat('annualWater'),
        annualElectricity: getFloat('annualElectricity'),
        annualGas: getFloat('annualGas')
    };

    const success = updateUserProfile(username, updates);
    const status = document.getElementById('profileStatus');
    if (!status) return;

    if (success) {
        const updated = getUserProfile(username);
        setCurrentUserProfile(updated);
        status.textContent = '✅ اطلاعات با موفقیت ذخیره شد.';
        status.className = 'mt-4 text-center text-sm text-green-600 bg-green-50 p-2 rounded-xl block';
        setTimeout(() => {
            status.className = 'mt-4 text-center text-sm hidden';
        }, 5000);
        const displayName = updates.fullName || username;
        const displayEl = document.getElementById('profileDisplayName');
        if (displayEl) displayEl.textContent = displayName;
    } else {
        status.textContent = '❌ خطا در ذخیره اطلاعات. لطفاً دوباره تلاش کنید.';
        status.className = 'mt-4 text-center text-sm text-red-600 bg-red-50 p-2 rounded-xl block';
    }
}

// ============================================================
// آپلود آواتار
// ============================================================
function handleAvatarUpload(file) {
    const username = getLoggedInUser();
    if (!username) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result;
        const success = saveUserAvatar(username, base64);
        if (success) {
            const avatarImg = document.getElementById('profileAvatar');
            if (avatarImg) avatarImg.src = base64;
            const updated = getUserProfile(username);
            setCurrentUserProfile(updated);
            alert('✅ آواتار با موفقیت به‌روز شد.');
        } else {
            alert('❌ خطا در ذخیره آواتار.');
        }
    };
    reader.readAsDataURL(file);
}

// ============================================================
// بازنشانی فرم
// ============================================================
function resetProfileForm() {
    if (confirm('آیا از بازنشانی اطلاعات اطمینان دارید؟')) {
        loadProfile();
        const status = document.getElementById('profileStatus');
        if (status) status.className = 'mt-4 text-center text-sm hidden';
    }
}

// ============================================================
// حذف حساب کاربری
// ============================================================
function deleteAccount() {
    if (!confirm('آیا مطمئن هستید؟ این عمل غیرقابل بازگشت است.')) return;
    const username = getLoggedInUser();
    if (!username) return;
    if (!confirm('تأیید نهایی: تمام داده‌های شما پاک می‌شود.')) return;

    const users = JSON.parse(localStorage.getItem('app_users') || '{}');
    delete users[username];
    localStorage.setItem('app_users', JSON.stringify(users));
    localStorage.removeItem(`daily_consumption_${username}`);
    localStorage.removeItem(`home_inventory_${username}`);
    localStorage.removeItem(`meal_plan_${username}`);
    logout();
}

// ============================================================
// راه‌اندازی
// ============================================================
function init() {
    if (!getLoggedInUser()) {
        window.location.href = 'index.html';
        return;
    }
    initDrawer();
    updateDrawerItems();
    loadProfile();

    const form = document.getElementById('profileForm');
    if (form) form.addEventListener('submit', saveProfile);
    
    const resetBtn = document.getElementById('resetProfileBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetProfileForm);
    
    const deleteBtn = document.getElementById('deleteAccountBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', deleteAccount);

    const avatarUpload = document.getElementById('avatarUpload');
    if (avatarUpload) {
        avatarUpload.addEventListener('change', function(e) {
            if (this.files && this.files[0]) {
                handleAvatarUpload(this.files[0]);
            }
            this.value = '';
        });
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
