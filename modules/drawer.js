// modules/drawer.js - نسخه نهایی با لینک‌های صفحات جدید
export function initDrawer() {
    const hamburger = document.getElementById('hamburgerMenu');
    const drawer = document.getElementById('drawer');
    const backdrop = document.getElementById('drawerBackdrop');
    const closeBtn = document.getElementById('closeDrawerBtn');

    if (!hamburger || !drawer || !backdrop) {
        console.error('❌ منوی کشو: المان‌ها پیدا نشدند!');
        return;
    }

    console.log('✅ منوی کشو: المان‌ها پیدا شدند.');

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

    hamburger.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
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

    console.log('✅ منوی کشو با موفقیت راه‌اندازی شد.');
}

export function updateDrawerItems() {
    const container = document.getElementById('drawerItems');
    if (!container) {
        console.warn('⚠️ المان drawerItems پیدا نشد.');
        return;
    }

    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const isLoggedIn = !!loggedInUser;

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
            { icon: 'fa-droplet', text: 'مدیریت آب', link: 'energy.html' },

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

            // ===== تنظیمات =====
            { type: 'divider' },
            { type: 'header', text: 'تنظیمات' },
            { icon: 'fa-user', text: 'پروفایل', link: 'profile.html' },
            { icon: 'fa-bell', text: 'اعلان‌ها', link: 'notifications.html' },
            { icon: 'fa-moon', text: 'تم تاریک', action: 'toggleTheme' },

            // ===== راهنما =====
            { type: 'divider' },
            { icon: 'fa-circle-question', text: 'راهنما', link: 'help.html' },
            { icon: 'fa-envelope', text: 'تماس با ما', link: 'contact.html' },

            // ===== خروج =====
            { type: 'divider' },
            { icon: 'fa-right-from-bracket', text: 'خروج', action: 'logout' }
        ];
    } else {
        // منو برای کاربران مهمان
        items = [
            { icon: 'fa-house', text: 'صفحه اصلی', link: 'index.html' },
            { icon: 'fa-right-to-bracket', text: 'ورود', link: 'login.html' },
            { icon: 'fa-user-plus', text: 'ثبت‌نام', link: 'login.html' },
            { type: 'divider' },
            { icon: 'fa-circle-question', text: 'راهنما', link: 'help.html' },
            { icon: 'fa-envelope', text: 'تماس با ما', link: 'contact.html' }
        ];
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
            header.style.fontSize = '0.7rem';
            header.style.fontWeight = '600';
            header.style.color = '#94a3b8';
            header.style.textTransform = 'uppercase';
            header.style.letterSpacing = '0.5px';
            header.style.padding = '0.5rem 0.25rem';
            header.style.marginTop = '0.25rem';
            container.appendChild(header);
            return;
        }

        const div = document.createElement('div');
        div.className = 'drawer-item';

        // ایجاد آیکون با FontAwesome
        const iconSpan = document.createElement('span');
        iconSpan.className = `fas ${item.icon}`;
        iconSpan.style.width = '20px';
        iconSpan.style.display = 'inline-block';
        iconSpan.style.textAlign = 'center';
        iconSpan.style.marginLeft = '12px';
        iconSpan.style.color = '#64748b';
        iconSpan.style.fontSize = '1rem';

        const textSpan = document.createElement('span');
        textSpan.textContent = item.text;
        textSpan.style.color = '#334155';
        textSpan.style.fontSize = '0.95rem';

        const wrapper = document.createElement('span');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.width = '100%';
        wrapper.appendChild(iconSpan);
        wrapper.appendChild(textSpan);

        if (item.link) {
            const a = document.createElement('a');
            a.href = item.link;
            a.appendChild(wrapper);
            a.style.textDecoration = 'none';
            a.style.color = 'inherit';
            a.style.display = 'block';
            a.style.width = '100%';
            a.style.padding = '0.25rem 0';
            div.appendChild(a);
        } else {
            const btn = document.createElement('button');
            btn.appendChild(wrapper);
            btn.style.background = 'none';
            btn.style.border = 'none';
            btn.style.cursor = 'pointer';
            btn.style.width = '100%';
            btn.style.textAlign = 'right';
            btn.style.fontFamily = 'inherit';
            btn.style.fontSize = '1rem';
            btn.style.padding = '0.25rem 0';
            btn.style.color = '#334155';

            // مدیریت اقدامات
            btn.onclick = function() {
                switch(item.action) {
                    case 'logout':
                        sessionStorage.removeItem('loggedInUser');
                        window.location.href = 'index.html';
                        break;
                    case 'toggleTheme':
                        document.body.classList.toggle('dark-mode');
                        // ذخیره وضعیت تم در localStorage
                        const isDark = document.body.classList.contains('dark-mode');
                        localStorage.setItem('dark_mode', isDark ? 'true' : 'false');
                        break;
                    default:
                        console.log('اقدام ناشناخته:', item.action);
                }
            };
            div.appendChild(btn);
        }

        // رویداد hover برای تغییر رنگ آیکون و متن
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

    console.log('✅ منوی استاندارد با موفقیت به‌روزرسانی شد.');
}

// ===== بارگذاری وضعیت تم هنگام راه‌اندازی =====
(function() {
    const isDark = localStorage.getItem('dark_mode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
    }
})();
