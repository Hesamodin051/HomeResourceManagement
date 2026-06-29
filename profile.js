import { getLoggedInUser, getUserProfile, updateUserProfile, saveUserAvatar, getUserAvatar } from './modules/auth.js';
import { setCurrentUserProfile } from './modules/store.js';

document.addEventListener('DOMContentLoaded', async () => {
    const loggedInUser = getLoggedInUser();
    if (!loggedInUser) { window.location.href = 'index.html'; return; }
    let profile = getUserProfile(loggedInUser);
    if (!profile) { window.location.href = 'login.html'; return; }

    document.getElementById('usernameDisplay').innerText = loggedInUser;
    document.getElementById('registeredAtDisplay').innerText = new Date(profile.registeredAt).toLocaleDateString('fa-IR');
    document.getElementById('familySizeInput').value = profile.familySize || 4;
    document.getElementById('storageDaysInput').value = profile.storageDays || 7;
    document.getElementById('emailInput').value = profile.email || '';

    const avatarImg = document.getElementById('avatarImg');
    if (profile.avatar) avatarImg.src = profile.avatar;
    else {
        const firstChar = loggedInUser.charAt(0).toUpperCase();
        avatarImg.src = `https://ui-avatars.com/api/?background=1e466e&color=fff&rounded=true&size=100&name=${firstChar}`;
    }
    let tempAvatar = null;
    document.getElementById('avatarUpload').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = e => { tempAvatar = e.target.result; avatarImg.src = tempAvatar; };
            reader.readAsDataURL(file);
        }
    });

    document.getElementById('saveProfileBtn').addEventListener('click', () => {
        const familySize = parseInt(document.getElementById('familySizeInput').value);
        const storageDays = parseInt(document.getElementById('storageDaysInput').value);
        const email = document.getElementById('emailInput').value.trim();
        if (isNaN(familySize) || familySize < 1) return showMessage('تعداد اعضای خانواده باید حداقل ۱ باشد.', 'error');
        if (isNaN(storageDays) || storageDays < 1) return showMessage('مدت ذخیره‌سازی باید حداقل ۱ روز باشد.', 'error');
        let success = updateUserProfile(loggedInUser, { familySize, storageDays, email });
        if (success && tempAvatar) success = saveUserAvatar(loggedInUser, tempAvatar);
        if (success) {
            showMessage('اطلاعات با موفقیت به‌روز شد.', 'success');
            const newProfile = getUserProfile(loggedInUser);
            setCurrentUserProfile(newProfile);
            if (newProfile.avatar) avatarImg.src = newProfile.avatar;
        } else showMessage('خطا در ذخیره تغییرات.', 'error');
    });

    function showMessage(msg, type) {
        const div = document.getElementById('messageDiv');
        div.innerText = msg;
        div.className = `message ${type}`;
        setTimeout(() => div.innerText = '', 3000);
    }
    document.getElementById('backToDashboardBtn').addEventListener('click', () => window.location.href = 'dashboard.html');
});
