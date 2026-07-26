// modules/auth.js
import { store, setCurrentUser, setCurrentUserProfile } from './store.js';

const USERS_KEY = 'app_users';

function getUsers() {
    const users = localStorage.getItem(USERS_KEY);
    return users ? JSON.parse(users) : {};
}

function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function register(username, password, email = '') {
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
    users[username] = {
        password,
        registeredAt: new Date().toISOString(),
        familySize: 4,
        storageDays: 7,
        email: email,
        avatar: null
    };
    saveUsers(users);
    sessionStorage.setItem('loggedInUser', username);
    setCurrentUser(username);
    setCurrentUserProfile(users[username]);
    return { success: true, message: 'ثبت‌نام موفق' };
}

export function login(username, password) {
    const users = getUsers();
    const user = users[username];
    if (!user || user.password !== password) {
        return { success: false, message: 'نام کاربری یا رمز عبور اشتباه است.' };
    }
    sessionStorage.setItem('loggedInUser', username);
    setCurrentUser(username);
    setCurrentUserProfile(user);
    return { success: true, message: 'ورود موفق' };
}

export function logout() {
    sessionStorage.removeItem('loggedInUser');
    setCurrentUser(null);
    setCurrentUserProfile(null);
    window.location.href = 'index.html';
}

export function getLoggedInUser() {
    return sessionStorage.getItem('loggedInUser');
}

export function getUserProfile(username) {
    const users = getUsers();
    return users[username] || null;
}

export function updateUserProfile(username, updates) {
    const users = getUsers();
    if (!users[username]) return false;
    if (updates.familySize !== undefined) users[username].familySize = parseInt(updates.familySize);
    if (updates.storageDays !== undefined) users[username].storageDays = parseInt(updates.storageDays);
    if (updates.email !== undefined) users[username].email = updates.email;
    saveUsers(users);
    if (store.currentUser === username) {
        setCurrentUserProfile(users[username]);
    }
    return true;
}

export function saveUserAvatar(username, avatarBase64) {
    const users = getUsers();
    if (users[username]) {
        users[username].avatar = avatarBase64;
        saveUsers(users);
        if (store.currentUser === username) {
            setCurrentUserProfile(users[username]);
        }
        return true;
    }
    return false;
}

export function getUserAvatar(username) {
    const users = getUsers();
    return users[username]?.avatar || null;
}

// ===== تابع checkAuth ساده =====
export function checkAuth() {
    const loggedInUser = getLoggedInUser();
    const currentPath = window.location.pathname;

    // اگر کاربر لاگین نکرده و در صفحات محافظت‌شده است
    const protectedPages = ['dashboard.html', 'profile.html', 'food.html', 'energy.html', 
                            'reports.html', 'notifications.html', 'help.html', 'contact.html', 
                            'chat-history.html', 'medications.html'];
    
    if (!loggedInUser && protectedPages.some(page => currentPath.includes(page))) {
        window.location.href = 'index.html';
        return false;
    }

    // اگر کاربر لاگین کرده و در index یا login است
    if (loggedInUser && (currentPath === '/' || 
                         currentPath.includes('index.html') || 
                         currentPath.includes('login.html'))) {
        window.location.href = 'dashboard.html';
        return false;
    }

    return true;
}

export function initAuthPage() {
    const loggedInUser = getLoggedInUser();
    if (loggedInUser) {
        window.location.href = 'dashboard.html';
        return;
    }

    const tabs = document.querySelectorAll('.tab-btn');
    const loginPanel = document.getElementById('loginForm');
    const registerPanel = document.getElementById('registerForm');

    if (tabs.length) {
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                tabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                if (this.dataset.tab === 'login') {
                    loginPanel.style.display = 'block';
                    registerPanel.style.display = 'none';
                } else {
                    loginPanel.style.display = 'none';
                    registerPanel.style.display = 'block';
                }
            });
        });
    }

    const loginBtn = document.getElementById('doLogin');
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            const result = login(username, password);
            if (result.success) {
                window.location.href = 'dashboard.html';
            } else {
                const errorDiv = document.getElementById('loginError');
                if (errorDiv) errorDiv.innerText = result.message;
            }
        });
    }

    const registerBtn = document.getElementById('doRegister');
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            const username = document.getElementById('regUsername').value.trim();
            const password = document.getElementById('regPassword').value;
            const confirm = document.getElementById('regConfirm').value;
            if (password !== confirm) {
                const errorDiv = document.getElementById('registerError');
                if (errorDiv) errorDiv.innerText = 'رمز عبور و تکرار آن مطابقت ندارند.';
                return;
            }
            const email = '';
            const result = register(username, password, email);
            if (result.success) {
                window.location.href = 'dashboard.html';
            } else {
                const errorDiv = document.getElementById('registerError');
                if (errorDiv) errorDiv.innerText = result.message;
            }
        });
    }
}
