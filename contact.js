// contact.js
import { getLoggedInUser } from './modules/auth.js';
import { initDrawer, updateDrawerItems } from './modules/drawer.js';

function init() {
    if (!getLoggedInUser()) {
        window.location.href = 'index.html';
        return;
    }
    initDrawer();
    updateDrawerItems();
    
    // فرم تماس
    document.getElementById('contactForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('contactName').value.trim();
        const email = document.getElementById('contactEmail').value.trim();
        const subject = document.getElementById('contactSubject').value;
        const message = document.getElementById('contactMessage').value.trim();
        
        if (!name || !email || !subject || !message) {
            showResult('❌ لطفاً تمام فیلدها را پر کنید.', 'error');
            return;
        }
        
        // شبیه‌سازی ارسال
        showResult('✅ پیام شما با موفقیت ارسال شد. به زودی با شما تماس می‌گیریم.', 'success');
        this.reset();
    });
}

function showResult(msg, type) {
    const div = document.getElementById('contactResult');
    div.textContent = msg;
    div.className = `mt-4 text-center text-sm p-3 rounded-xl ${type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`;
    div.classList.remove('hidden');
    setTimeout(() => div.classList.add('hidden'), 5000);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
