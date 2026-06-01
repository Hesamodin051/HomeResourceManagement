const USERS_KEY = 'app_users';
let currentUser = null;

function getUsers() {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : {};
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

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
    users[username] = { password: password };
    saveUsers(users);
    return { success: true, message: 'ثبت‌نام موفق. اکنون می‌توانید وارد شوید.' };
}

function login(username, password) {
    const users = getUsers();
    const user = users[username];
    if (!user || user.password !== password) {
        return { success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' };
    }
    sessionStorage.setItem('loggedInUser', username);
    currentUser = username;
    return { success: true, message: 'ورود موفق. در حال انتقال به داشبورد...' };
}

function logout() {
    sessionStorage.removeItem('loggedInUser');
    currentUser = null;
    window.location.href = 'index.html'; // به صفحه اصلی لندینگ
}

function checkAuth() {
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const currentPath = window.location.pathname;
    // اگر در صفحه داشبورد هستیم و لاگین نیستیم -> برو به صفحه اصلی
    if (!loggedInUser && currentPath.includes('dashboard.html')) {
        window.location.href = 'index.html';
        return false;
    }
    // اگر در صفحه اصلی لندینگ هستیم و لاگین هستیم -> هدایت به داشبورد (اختیاری)
    if (loggedInUser && (currentPath === '/' || currentPath.includes('index.html'))) {
        window.location.href = 'dashboard.html';
        return false;
    }
    // اگر در صفحه لاگین هستیم و لاگین هستیم -> برو به داشبورد
    if (loggedInUser && currentPath.includes('login.html')) {
        window.location.href = 'dashboard.html';
        return false;
    }
    return true;
}

function getLoggedInUser() {
    return sessionStorage.getItem('loggedInUser');
}

// راه‌اندازی صفحه لاگین
function initAuthPage() {
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

    document.getElementById('doLogin').addEventListener('click', () => {
        const username = document.getElementById('loginUsername').value.trim();
        const password = document.getElementById('loginPassword').value;
        const result = login(username, password);
        if (result.success) {
            window.location.href = 'dashboard.html';
        } else {
            document.getElementById('loginError').innerText = result.message;
        }
    });

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
            document.getElementById('regUsername').value = '';
            document.getElementById('regPassword').value = '';
            document.getElementById('regConfirm').value = '';
            setTimeout(() => {
                document.querySelector('.tab[data-tab="login"]').click();
            }, 1500);
        } else {
            document.getElementById('registerError').innerText = result.message;
            document.getElementById('registerSuccess').innerText = '';
        }
    });
}

// اگر صفحه لاگین است -> راه‌اندازی
if (window.location.pathname.includes('login.html')) {
    document.addEventListener('DOMContentLoaded', initAuthPage);
} else {
    // برای سایر صفحات (index.html و dashboard.html) وضعیت لاگین را بررسی کن
    checkAuth();
    // اگر در داشبورد هستیم، نام کاربر را نمایش بده
    if (window.location.pathname.includes('dashboard.html')) {
        document.addEventListener('DOMContentLoaded', () => {
            const userDisplay = document.getElementById('userDisplay');
            if (userDisplay) {
                const loggedInUser = getLoggedInUser();
                if (loggedInUser) userDisplay.innerText = loggedInUser;
            }
            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', () => logout());
            }
        });
    }
}
