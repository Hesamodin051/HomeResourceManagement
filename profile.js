// profile.js
import { getLoggedInUser, getUserProfile, updateUserProfile, saveUserAvatar, getUserAvatar, logout } from './modules/auth.js';
import { store, setCurrentUserProfile } from './modules/store.js';
import { initDrawer, updateDrawerItems } from './modules/drawer.js';

// ============================================================
// بارگذاری اطلاعات پروفایل
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

    // پر کردن فیلدها
    document.getElementById('username').value = username;
    document.getElementById('fullName').value = profile.fullName || '';
    document.getElementById('phone').value = profile.phone || '';
    document.getElementById('birthDate').value = profile.birthDate || '';
    document.getElementById('gender').value = profile.gender || '';
    document.getElementById('maritalStatus').value = profile.maritalStatus || '';
    document.getElementById('occupation').value = profile.occupation || '';
    document.getElementById('familySize').value = profile.familySize || 4;
    document.getElementById('address').value = profile.address || '';
    document.getElementById('postalCode').value = profile.postalCode || '';
    document.getElementById('housingType').value = profile.housingType || '';
    document.getElementById('area').value = profile.area || '';
    document.getElementById('constructionYear').value = profile.constructionYear || '';
    document.getElementById('heatingSystem').value = profile.heatingSystem || '';
    document.getElementById('coolingSystem').value = profile.coolingSystem || '';
    document.getElementById('waterHeater').value = profile.waterHeater || '';
    document.getElementById('solarPanel').value = profile.solarPanel || '';
    document.getElementById('annualWater').value = profile.annualWater || '';
    document.getElementById('annualElectricity').value = profile.annualElectricity || '';
    document.getElementById('annualGas').value = profile.annualGas || '';

    // نام نمایشی
    const displayName = profile.fullName || username;
    document.getElementById('profileDisplayName').textContent = displayName;
    document.getElementById('profileUsername').textContent = `@${username}`;

    // آواتار
    const avatar = getUserAvatar(username);
    if (avatar) {
        document.getElementById('profileAvatar').src = avatar;
    } else {
        const firstChar = username.charAt(0).toUpperCase();
        document.getElementById('profileAvatar').src = `https://ui-avatars.com/api/?background=1e466e&color=fff&rounded=true&size=96&name=${firstChar}`;
    }
}

// ============================================================
// ذخیره پروفایل
// ============================================================
function saveProfile(e) {
    e.preventDefault();
    const username = getLoggedInUser();
    if (!username) return;

    const updates = {
        fullName: document.getElementById('fullName').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        birthDate: document.getElementById('birthDate').value,
        gender: document.getElementById('gender').value,
        maritalStatus: document.getElementById('maritalStatus').value,
        occupation: document.getElementById('occupation').value.trim(),
        familySize: parseInt(document.getElementById('familySize').value) || 4,
        address: document.getElementById('address').value.trim(),
        postalCode: document.getElementById('postalCode').value.trim(),
        housingType: document.getElementById('housingType').value,
        area: parseFloat(document.getElementById('area').value) || 0,
        constructionYear: parseInt(document.getElementById('constructionYear').value) || 0,
        heatingSystem: document.getElementById('heatingSystem').value,
        coolingSystem: document.getElementById('coolingSystem').value,
        waterHeater: document.getElementById('waterHeater').value,
        solarPanel: document.getElementById('solarPanel').value,
        annualWater: parseFloat(document.getElementById('annualWater').value) || 0,
        annualElectricity: parseFloat(document.getElementById('annualElectricity').value) || 0,
        annualGas: parseFloat(document.getElementById('annualGas').value) || 0
    };

    const success = updateUserProfile(username, updates);
    if (success) {
        // به‌روز کردن store
        const updated = getUserProfile(username);
        setCurrentUserProfile(updated);

        // پیام موفقیت
        const status = document.getElementById('profileStatus');
        status.textContent = '✅ اطلاعات با موفقیت ذخیره شد.';
        status.className = 'mt-4 text-center text-sm text-green-600 bg-green-50 p-2 rounded-xl block';
        setTimeout(() => {
            status.className = 'mt-4 text-center text-sm hidden';
        }, 5000);

        // به‌روز کردن نام نمایشی
        const displayName = updates.fullName || username;
        document.getElementById('profileDisplayName').textContent = displayName;
    } else {
        const status = document.getElementById('profileStatus');
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
            document.getElementById('profileAvatar').src = base64;
            // به‌روز کردن آواتار در store
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
// بازنشانی فرم به مقادیر پیش‌فرض
// ============================================================
function resetProfileForm() {
    if (confirm('آیا از بازنشانی اطلاعات اطمینان دارید؟')) {
        loadProfile(); // دوباره بارگذاری
        document.getElementById('profileStatus').className = 'mt-4 text-center text-sm hidden';
    }
}

// ============================================================
// حذف حساب کاربری
// ============================================================
function deleteAccount() {
    if (confirm('آیا مطمئن هستید؟ این عمل غیرقابل بازگشت است.')) {
        // حذف کاربر از localStorage (در auth.js تابعی برای این کار وجود ندارد، پیاده‌سازی ساده)
        const username = getLoggedInUser();
        if (!username) return;
        if (confirm('تأیید نهایی: تمام داده‌های شما پاک می‌شود.')) {
            // حذف کاربر
            const users = JSON.parse(localStorage.getItem('app_users') || '{}');
            delete users[username];
            localStorage.setItem('app_users', JSON.stringify(users));
            // حذف داده‌های مرتبط
            localStorage.removeItem(`daily_consumption_${username}`);
            localStorage.removeItem(`home_inventory_${username}`);
            localStorage.removeItem(`meal_plan_${username}`);
            // خروج
            logout();
        }
    }
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

    // رویدادها
    document.getElementById('profileForm').addEventListener('submit', saveProfile);
    document.getElementById('resetProfileBtn').addEventListener('click', resetProfileForm);
    document.getElementById('deleteAccountBtn').addEventListener('click', deleteAccount);

    // آپلود آواتار
    document.getElementById('avatarUpload').addEventListener('change', function(e) {
        if (this.files && this.files[0]) {
            handleAvatarUpload(this.files[0]);
        }
        this.value = ''; // reset
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
