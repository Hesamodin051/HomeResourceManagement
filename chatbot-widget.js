// chatbot-widget.js - ویجت چت‌بات در تمام صفحات
(function() {
    'use strict';

    // ===== متغیرها =====
    let isOpen = false;
    let conversationHistory = [];
    const CHAT_HISTORY_KEY = 'chat_history';

    // ===== بارگذاری تاریخچه =====
    function loadHistory() {
        const saved = localStorage.getItem(CHAT_HISTORY_KEY);
        if (saved) {
            try {
                conversationHistory = JSON.parse(saved);
            } catch (e) {
                conversationHistory = [];
            }
        } else {
            conversationHistory = [];
        }
        return conversationHistory;
    }

    // ===== ذخیره تاریخچه =====
    function saveHistory() {
        localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(conversationHistory));
    }

    // ===== افزودن پیام به تاریخچه =====
    function addMessageToHistory(role, content) {
        conversationHistory.push({
            role: role,
            content: content,
            timestamp: new Date().toISOString()
        });
        // فقط ۵۰ پیام آخر را نگه دار
        if (conversationHistory.length > 50) {
            conversationHistory = conversationHistory.slice(-50);
        }
        saveHistory();
    }

    // ===== نمایش پیام در UI =====
    function addMessageToUI(role, content) {
        const messages = document.getElementById('chatbotMessages');
        const typingIndicator = document.getElementById('typingIndicator');
        if (!messages) return;

        const div = document.createElement('div');
        div.className = `message ${role}`;
        div.innerHTML = content.replace(/\n/g, '<br>') + 
            `<span class="time">${new Date().toLocaleTimeString('fa-IR')}</span>`;
        messages.insertBefore(div, typingIndicator);
        messages.scrollTop = messages.scrollHeight;
    }

    // ===== ارسال پیام =====
    async function sendMessage(userMessage) {
        if (typeof puter === 'undefined') {
            alert('سرویس هوش مصنوعی در دسترس نیست. لطفاً صفحه را رفرش کنید.');
            return;
        }

        const input = document.getElementById('chatbotInput');
        const sendBtn = document.getElementById('chatbotSendBtn');
        const typingIndicator = document.getElementById('typingIndicator');
        const messages = document.getElementById('chatbotMessages');

        if (!userMessage) {
            userMessage = input.value.trim();
        }

        if (!userMessage) return;

        // نمایش پیام کاربر
        addMessageToUI('user', userMessage);
        addMessageToHistory('user', userMessage);

        input.value = '';
        input.style.height = 'auto';

        // نشانگر تایپ
        typingIndicator.style.display = 'flex';
        sendBtn.disabled = true;

        try {
            // ساخت پرامپت ساده با اطلاعات موجودی
            let inventoryInfo = 'هیچ ماده غذایی ثبت نشده است.';
            try {
                const store = window.store || {};
                if (store.inventory && store.inventory.length > 0) {
                    inventoryInfo = store.inventory.map(i => 
                        `${i.name}: ${i.quantity} ${i.unit}`
                    ).join('، ');
                }
            } catch (e) {}

            const systemPrompt = `
شما یک دستیار هوشمند خانگی هستید. به سوالات کاربر پاسخ دهید.
اطلاعات موجودی: ${inventoryInfo}
پاسخ‌ها را به فارسی روان و مختصر بنویسید.`;

            const response = await puter.ai.chat([
                { role: 'system', content: systemPrompt },
                ...conversationHistory.slice(-10).map(m => ({ role: m.role, content: m.content }))
            ], { model: 'gpt-4o-mini', stream: false });

            let reply = '';
            if (typeof response === 'string') {
                reply = response;
            } else if (response && typeof response === 'object') {
                reply = response.message?.content || response.text || response.response || JSON.stringify(response);
            } else {
                reply = 'پاسخی دریافت نشد.';
            }

            addMessageToUI('assistant', reply);
            addMessageToHistory('assistant', reply);

        } catch (error) {
            console.error('خطا در چت‌بات:', error);
            const errorMsg = '❌ خطا در دریافت پاسخ. لطفاً دوباره تلاش کنید.';
            addMessageToUI('assistant', errorMsg);
            addMessageToHistory('assistant', errorMsg);
        } finally {
            typingIndicator.style.display = 'none';
            sendBtn.disabled = false;
            messages.scrollTop = messages.scrollHeight;
        }
    }

    // ===== راه‌اندازی ویجت =====
    function initChatbot() {
        const fab = document.getElementById('chatbotFab');
        const windowEl = document.getElementById('chatbotWindow');
        const closeBtn = document.getElementById('chatbotCloseBtn');
        const sendBtn = document.getElementById('chatbotSendBtn');
        const input = document.getElementById('chatbotInput');
        const messages = document.getElementById('chatbotMessages');
        const typingIndicator = document.getElementById('typingIndicator');

        if (!fab || !windowEl) {
            console.warn('⚠️ ویجت چت‌بات در صفحه پیدا نشد.');
            return;
        }

        // بارگذاری تاریخچه
        loadHistory();

        // نمایش تاریخچه در UI
        conversationHistory.forEach(msg => {
            if (msg.role !== 'system') {
                addMessageToUI(msg.role, msg.content);
            }
        });

        // باز/بسته کردن
        fab.addEventListener('click', function() {
            isOpen = !isOpen;
            windowEl.classList.toggle('open', isOpen);
            if (isOpen) {
                input.focus();
                const badge = document.getElementById('chatbotBadge');
                if (badge) badge.style.display = 'none';
            }
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                isOpen = false;
                windowEl.classList.remove('open');
            });
        }

        // ارسال پیام
        sendBtn.addEventListener('click', function() {
            sendMessage();
        });

        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        input.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 80) + 'px';
        });

        // پیشنهادات سریع
        document.querySelectorAll('.chatbot-quick-suggestions button').forEach(btn => {
            btn.addEventListener('click', function() {
                const question = this.getAttribute('data-question');
                if (question) {
                    input.value = question;
                    sendMessage();
                }
            });
        });

        console.log('✅ چت‌بات هوشمند راه‌اندازی شد.');
    }

    // ===== اجرا =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initChatbot);
    } else {
        initChatbot();
    }

    // صادر کردن توابع برای استفاده در صفحات دیگر
    window.Chatbot = {
        sendMessage: sendMessage,
        loadHistory: loadHistory,
        getHistory: function() { return conversationHistory; },
        clearHistory: function() {
            conversationHistory = [];
            saveHistory();
            const messages = document.getElementById('chatbotMessages');
            if (messages) {
                messages.innerHTML = `
                    <div class="message assistant">
                        تاریخچه پاک شد. سوال جدیدی بپرسید! 😊
                        <span class="time">اکنون</span>
                    </div>
                    <div class="typing-indicator" id="typingIndicator">
                        <span></span><span></span><span></span>
                    </div>
                `;
            }
        }
    };
})();
