export function initDrawer() {
    const drawer = document.getElementById('drawer');
    const backdrop = document.getElementById('drawerBackdrop');
    const hamburger = document.getElementById('hamburgerMenu');
    const closeBtn = document.getElementById('closeDrawerBtn');
    if (!drawer || !backdrop || !hamburger) return;
    function openDrawer() { drawer.classList.add('open'); backdrop.classList.add('show'); }
    function closeDrawer() { drawer.classList.remove('open'); backdrop.classList.remove('show'); }
    hamburger.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    backdrop.addEventListener('click', closeDrawer);
}
export function updateDrawerItems() {
    const container = document.getElementById('drawerItems');
    if (!container) return;
    const loggedInUser = sessionStorage.getItem('loggedInUser');
    const isLoggedIn = !!loggedInUser;
    let items = [];
    if (isLoggedIn) {
        items = [
            { icon: '🥫', text: 'مدیریت مواد غذایی', link: 'food.html' },
            { icon: '⚡', text: 'مدیریت مصرف انرژی', link: 'energy.html' },
            { icon: '👤', text: 'پروفایل', link: 'profile.html' },
            { icon: '📊', text: 'داشبورد اصلی', link: 'dashboard.html' },
            { icon: '🚪', text: 'خروج', action: () => { sessionStorage.removeItem('loggedInUser'); localStorage.removeItem('loggedInUser'); window.location.href = 'index.html'; } }
        ];
    } else {
        items = [
            { icon: '🔐', text: 'ورود', link: 'login.html' },
            { icon: '📝', text: 'ثبت‌نام', link: 'login.html' }
        ];
    }
    container.innerHTML = '';
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'drawer-item';
        if (item.link) {
            const a = document.createElement('a');
            a.href = item.link;
            a.innerHTML = `${item.icon} ${item.text}`;
            a.style.textDecoration = 'none';
            a.style.color = 'inherit';
            div.appendChild(a);
        } else if (item.action) {
            const btn = document.createElement('button');
            btn.innerHTML = `${item.icon} ${item.text}`;
            btn.style.background = 'none';
            btn.style.border = 'none';
            btn.style.cursor = 'pointer';
            btn.style.width = '100%';
            btn.style.textAlign = 'right';
            btn.onclick = () => { item.action(); };
            div.appendChild(btn);
        }
        container.appendChild(div);
    });
}
