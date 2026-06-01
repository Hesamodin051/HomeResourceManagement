// کلید ذخیره‌سازی کاربران در localStorage
const USERS_KEY = 'app_users';
let currentUser = null;

// بارگذاری کاربران از localStorage
function getUsers() {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : {};
}

// ذخیره کاربران در localStorage
function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// ثبت‌نام کاربر جدید
function register(username, password) {
    const users = getUsers();
    if (users[username]) {
        return { success: false, message: 'این نام کاربری قبلاً ثبت شده است.' };
    }
    if (username.length < 3) {
        return { success: false, message: 'نام کاربری باید حداقل ۳ کاراکتر باشد.' };
    }
    if (password.length < 4) {
        return { success: false, message: 'رمز عبور باید حداقل ۴ کاراکتر باشد.' };
    }
    users[username] = { password: password }; // در عمل رمز را هش می‌کنیم، ولی برای MVP ساده
    saveUsers(users);
    return { success: true, message: 'ثبت‌نام موفق. اکنون می‌توانید وارد شوید.' };
}

// ورود کاربر
function login(username, password) {
    const users = getUsers();
    const user = users[username];
    if (!user || user.password !== password) {
        return { success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' };
    }
    // ذخیره اطلاعات کاربر لاگین‌شده در sessionStorage (برای ماندگاری تا بسته شدن مرورگر)
    sessionStorage.setItem('loggedInUser', username);
    currentUser = username;
    return { success: true, message: 'ورود موفق. در حال انتقال به صفحه اصلی...' };
}

// خروج از حساب
function logout() {
    sessionStorage.removeItem('loggedInUser');
    currentUser = null;
    window.location.href = 'login.html';
}

// بررسی وضعیت لاگین (در هر صفحه)
function checkAuth() {
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    if (!loggedInUser && window.location.pathname.indexOf('login.html') === -1) {
        // اگر لاگین نیست و در صفحه لاگین هم نیست، به لاگین هدایت کن
        window.location.href = 'login.html';
        return false;
    }
    if (loggedInUser && window.location.pathname.indexOf('login.html') !== -1) {
        // اگر لاگین هست و در صفحه لاگین است، به صفحه اصلی برو
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// راه‌اندازی رویدادهای صفحه لاگین (در login.html اجرا شود)
function initAuthPage() {
    // تب‌ها
    const tabs = document.querySelectorAll('.tab');
    const loginPanel = document.getElementById('loginForm');
    const registerPanel = document.getElementById('registerForm');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            if (tab.dataset.tab === 'login') {
                loginPanel.style.display = 'block';
                registerPanel.style.display = 'none';
            } else {
                loginPanel.style.display = 'none';
                registerPanel.style.display = 'block';
            }
        });
    });

    // دکمه ورود
    document.getElementById('doLogin').addEventListener('click', () => {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const result = login(username, password);
        if (result.success) {
            window.location.href = 'index.html';
        } else {
            document.getElementById('loginError').innerText = result.message;
        }
    });

    // دکمه ثبت‌نام
    document.getElementById('doRegister').addEventListener('click', () => {
        const username = document.getElementById('regUsername').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regConfirm').value;
        if (password !== confirm) {
            document.getElementById('registerError').innerText = 'رمز عبور و تکرار آن مطابقت ندارند.';
            return;
        }
        const result = register(username, password);
        if (result.success) {
            document.getElementById('registerSuccess').innerText = result.message;
            document.getElementById('registerError').innerText = '';
            // پاک کردن فرم
            document.getElementById('regUsername').value = '';
            document.getElementById('regPassword').value = '';
            document.getElementById('regConfirm').value = '';
            // پس از ۲ ثانیه به تب ورود برو
            setTimeout(() => {
                document.querySelector('.tab[data-tab="login"]').click();
            }, 1500);
        } else {
            document.getElementById('registerError').innerText = result.message;
            document.getElementById('registerSuccess').innerText = '';
        }
    });
}

// اجرای کد مخصوص صفحه لاگین
if (window.location.pathname.includes('login.html')) {
    document.addEventListener('DOMContentLoaded', initAuthPage);
} else {
    // در صفحات دیگر (مثل index.html) وضعیت لاگین را بررسی کن
    checkAuth();
    // نمایش نام کاربر لاگین‌شده در صفحه (اختیاری)
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    if (loggedInUser && document.getElementById('userDisplay')) {
        document.getElementById('userDisplay').innerText = loggedInUser;
    }
}
