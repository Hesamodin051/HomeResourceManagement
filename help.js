// help.js
import { getLoggedInUser } from './modules/auth.js';
import { initDrawer, updateDrawerItems } from './modules/drawer.js';

function init() {
    if (!getLoggedInUser()) {
        window.location.href = 'index.html';
        return;
    }
    initDrawer();
    updateDrawerItems();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
