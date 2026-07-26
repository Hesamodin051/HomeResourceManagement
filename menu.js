// menu.js - نسخه با دیباگ کامل
(function() {
    'use strict';

    console.log('🔄 menu.js (v2) در حال بارگذاری...');

    // ===== راه‌اندازی منوی کشو =====
    function initDrawer() {
        const hamburger = document.getElementById('hamburgerMenu');
        const drawer = document.getElementById('drawer');
        const backdrop = document.getElementById('drawerBackdrop');
        const closeBtn = document.getElementById('closeDrawerBtn');

        if (!hamburger || !drawer || !backdrop) {
            if (hamburger) {
                console.warn('⚠️ منوی کشو: المان‌های drawer یا backdrop پیدا نشدند!');
            } else {
                console.log('ℹ️ این صفحه منوی همبرگری ندارد (مثلاً login.html)');
            }
            return false;
        }

        console.log('✅ منوی کشو: همه المان‌ها پیدا شدند.');

        function openDrawer() {
            drawer.classList.add('open');
            backdrop.classList.add('show');
            document.body.style.overflow = 'hidden';
            console.log('📂 منو باز شد');
        }

        function closeDrawer() {
            drawer.classList.remove('open');
            backdrop.classList.remove('show');
            document.body.style.overflow = '';
            console.log('📁 منو بسته شد');
        }

        if (hamburger._listenerAdded) {
            console.log('ℹ️ رویداد منو قبلاً متصل شده است.');
            return true;
        }
        hamburger._listenerAdded = true;

        hamburger.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🖱️ کلیک روی همبرگر (menu.js)');
            openDrawer();
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', closeDrawer);
        }

        backdrop.addEventListener('click', closeDrawer);

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                closeDrawer();
            }
        });

        console.log('✅ منوی کشو با موفقیت راه‌اندازی شد (menu.js v2).');
        return true;
    }

    // ===== به‌روزرسانی آیتم‌های منو =====
    function updateDrawerItems() {
        const container = document.getElementById('drawerItems');
        if (!container) {
            console.error('❌ المان drawerItems پیدا نشد!');
            return false;
        }

        const loggedInUser = sessionStorage.getItem('loggedInUser');
        const isLoggedIn = !!loggedInUser;
        console.log('🔍 وضعیت لاگین:', { loggedInUser, isLoggedIn });

        let items = [];

        if (isLoggedIn) {
            items = [
                // ===== بخش اصلی =====
                { type: 'header', text: 'منوی اصلی' },
                { icon: 'fa-house', text: 'صفحه اصلی', link: 'index.html' },
                { icon: 'fa-chart-pie', text: 'داشبورد', link: 'dashboard.html' },

                // ===== مدیریت منابع =====
                { type: 'divider' },
                { type: 'header', text: 'مدیریت منابع' },
                { icon: 'fa-utensils', text: 'مواد غذایی', link: 'food.html' },
                { icon: 'fa-bolt', text: 'مصرف انرژی', link: 'energy.html' },

                // ===== مدیریت بحران =====
                { type: 'divider' },
                { type: 'header', text: 'مدیریت بحران' },
                { icon: 'fa-triangle-exclamation', text: 'سناریوهای بحران', link: 'dashboard.html' },
                { icon: 'fa-boxes-stacked', text: 'ذخایر اضطراری', link: 'food.html' },

                // ===== گزارش‌ها =====
                { type: 'divider' },
                { type: 'header', text: 'گزارش‌ها' },
                { icon: 'fa-calendar-week', text: 'گزارش هفتگی', link: 'reports.html' },
                { icon: 'fa-calendar-alt', text: 'گزارش ماهانه', link: 'reports.html' },

                // ===== بخش سلامت (جدید) - با دیباگ =====
                { type: 'divider' },
                { type: 'header', text: 'سلامت' },
                { icon: 'fa-pills', text: 'مدیریت داروها', link: 'medications.html' },

                // ===== تنظیمات =====
                { type: 'divider' },
                { type: 'header', text: 'تنظیمات' },
                { icon: 'fa-user', text: 'پروفایل', link: 'profile.html' },
                { icon: 'fa-bell', text: 'اعلان‌ها', link: 'notifications.html' },
                { icon: 'fa-moon', text: 'تم تاریک', action: 'toggleTheme' },

                // ===== تاریخچه و راهنما =====
                { type: 'divider' },
                { icon: 'fa-clock-rotate-left', text: 'تاریخچه چت', link: 'chat-history.html' },
                { type: 'divider' },
                { icon: 'fa-circle-question', text: 'راهنما', link: 'help.html' },
                { icon: 'fa-envelope', text: 'تماس با ما', link: 'contact.html' },

                // ===== خروج =====
                { type: 'divider' },
                { icon: 'fa-right-from-bracket', text: 'خروج', action: 'logout' }
            ];

            // ===== دیباگ: چاپ تعداد آیتم‌ها =====
            console.log('📋 آیتم‌های منو (ورود):', items.length);
            console.log('🔍 بخش سلامت در آیتم‌ها وجود دارد؟', items.some(item => item.text === 'مدیریت داروها'));

        } else {
            items = [
                { icon: 'fa-house', text: 'صفحه اصلی', link: 'index.html' },
                { icon: 'fa-right-to-bracket', text: 'ورود', link: 'login.html' },
                { icon: 'fa-user-plus', text: 'ثبت‌نام', link: 'login.html' },
                { type: 'divider' },
                { icon: 'fa-circle-question', text: 'راهنما', link: 'help.html' },
                { icon: 'fa-envelope', text: 'تماس با ما', link: 'contact.html' }
            ];
            console.log('📋 آیتم‌های منو (مهمان):', items.length);
        }

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

        console.log('✅ آیتم‌های منو به‌روزرسانی شدند. تعداد آیتم‌ها:', items.length);
        console.log('✅ آخرین آیتم‌های منو:', items.slice(-5).map(i => i.text || i.type));
        return true;
    }

    // ===== اجرا با دیباگ =====
    function init() {
        console.log('🔄 menu.js v2: شروع اجرا...');
        const drawerInit = initDrawer();
        const itemsUpdate = updateDrawerItems();

        if (drawerInit && itemsUpdate) {
            console.log('✅ menu.js v2 با موفقیت اجرا شد.');
        } else {
            console.error('❌ menu.js v2: خطا در راه‌اندازی منو.');
        }
    }

    // ===== اجرا =====
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ===== تابع رفرش دستی برای دیباگ =====
    window.refreshMenu = function() {
        console.log('🔄 رفرش دستی منو...');
        updateDrawerItems();
    };
})();
