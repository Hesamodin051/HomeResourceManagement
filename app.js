import { checkAuth, getLoggedInUser, logout, getUserProfile, getUserAvatar } from './modules/auth.js';
import { loadInventory, addItem, editItem, deleteItem } from './modules/inventory.js';
import { loadConsumptionData, saveTodayConsumption } from './modules/consumption.js';
import { store, setCrisisMode, addListener, setCurrentUserProfile } from './modules/store.js';
import { initDrawer, updateDrawerItems } from './drawer.js';
import { generateSuggestions } from './modules/suggestions.js';
import { generateConsumptionPlan } from './modules/consumption-planner.js';
import { generateMealSuggestions } from './modules/meal-planner.js';
import { getSmartSuggestions } from './modules/ai.js';

// ===== PWA: ثبت Service Worker =====
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('✅ Service Worker ثبت شد'))
        .catch(err => console.log('❌ خطا در ثبت Service Worker:', err));
}

// ===== توابع AI =====
async function handleAISuggestion() {
    const display = document.getElementById('aiSuggestionDisplay');
    const btn = document.getElementById('aiSuggestionBtn');
    const loadingBtn = document.getElementById('aiLoadingBtn');
    if (!display) return;
    btn.style.display = 'none';
    loadingBtn.style.display = 'inline-block';
    display.innerHTML = '<span style="color: #805ad5;">🤔 در حال تحلیل داده‌ها و دریافت پیشنهادات...</span>';
    try {
        const suggestion = await getSmartSuggestions();
        display.innerHTML = suggestion.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    } catch (error) {
        display.innerHTML = '❌ خطا در دریافت پیشنهادات. لطفاً دوباره تلاش کنید.';
        console.error(error);
    } finally {
        btn.style.display = 'inline-block';
        loadingBtn.style.display = 'none';
    }
}

// ===== رندر جدول ذخایر =====
function renderInventoryTable() {
    const tbody = document.getElementById('inventoryBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    store.inventory.forEach(item => {
        const row = tbody.insertRow();
        row.insertCell(0).innerText = item.name;
        row.insertCell(1).innerText = item.quantity;
        row.insertCell(2).innerText = item.unit;
        row.insertCell(3).innerText = item.expiry || '—';
        const actionsCell = row.insertCell(4);
        const editBtn = document.createElement('button');
        editBtn.innerText = '✏️';
        editBtn.className = 'edit-btn';
        editBtn.onclick = () => {
            const newName = prompt('نام جدید:', item.name);
            const newQty = parseFloat(prompt('مقدار جدید:', item.quantity));
            const newUnit = prompt('واحد جدید:', item.unit);
            const newExpiry = prompt('تاریخ انقضا (YYYY-MM-DD):', item.expiry);
            if (newName && !isNaN(newQty) && newQty > 0 && newUnit) {
                editItem(item.id, newName.trim(), newQty, newUnit.trim(), newExpiry || '');
                renderInventoryTable();
                generateAlerts();
                document.getElementById('consumptionPlanDisplay').innerHTML = generateConsumptionPlan();
                document.getElementById('mealSuggestionsDisplay').innerHTML = generateMealSuggestions();
                generateSuggestions();
            } else alert('ورودی نامعتبر');
        };
        const delBtn = document.createElement('button');
        delBtn.innerText = '🗑️';
        delBtn.className = 'delete-btn';
        delBtn.onclick = () => {
            if (confirm('آیا از حذف این قلم اطمینان دارید؟')) {
                deleteItem(item.id);
                renderInventoryTable();
                generateAlerts();
                document.getElementById('consumptionPlanDisplay').innerHTML = generateConsumptionPlan();
                document.getElementById('mealSuggestionsDisplay').innerHTML = generateMealSuggestions();
                generateSuggestions();
            }
        };
        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(delBtn);
    });
}

function generateAlerts() {
    const alertPanel = document.getElementById('alertPanel');
    if (!alertPanel) return;
    const alerts = [];
    let familySize = 4;
    if (store.currentUserProfile && store.currentUserProfile.familySize) familySize = store.currentUserProfile.familySize;
    const waterItem = store.inventory.find(i => i.name.includes('آب'));
    if (waterItem) {
        const waterLiters = waterItem.quantity;
        const daysLeft = waterLiters / (familySize * 2);
        if (daysLeft < 1) alerts.push('🔴 بحرانی: آب کمتر از یک روز!');
        else if (daysLeft < 3) alerts.push(`🟠 هشدار: آب تنها برای ${Math.floor(daysLeft)} روز`);
        else if (daysLeft < 7) alerts.push('🟡 توجه: آب کمتر از یک هفته');
    } else alerts.push('⚠️ آب در لیست ذخایر ثبت نشده!');
    if (store.crisisMode) alerts.push('⚠️ حالت بحران فعال است. مصرف را به حداقل برسانید.');
    else if (alerts.length === 0) alerts.push('✅ وضعیت ذخایر مناسب است.');
    alertPanel.innerHTML = alerts.map(a => `<div>${a}</div>`).join('');
}

function renderChart() {
    const ctx = document.getElementById('myChart');
    if (!ctx) return;
    const data = store.consumptionData;
    if (!data || !data.dates.length) return;
    if (window.myChartInstance) window.myChartInstance.destroy();
    window.myChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [
                { label: 'آب (لیتر)', data: data.water, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.3 },
                { label: 'برق (کیلووات)', data: data.electricity, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)', fill: true, tension: 0.3 },
                { label: 'گاز (مترمکعب)', data: data.gas, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.3 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } }
    });
}

function bindDashboardUI() {
    const saveBtn = document.getElementById('saveConsumptionBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const water = parseFloat(document.getElementById('waterConsumption').value);
            const elec = parseFloat(document.getElementById('electricityConsumption').value);
            const gas = parseFloat(document.getElementById('gasConsumption').value);
            if (isNaN(water) || isNaN(elec) || isNaN(gas)) {
                alert('لطفاً هر سه مقدار مصرف را وارد کنید.');
                return;
            }
            saveTodayConsumption(water, elec, gas);
            renderChart();
            alert('مصرف امروز ذخیره شد.');
            document.getElementById('waterConsumption').value = '';
            document.getElementById('electricityConsumption').value = '';
            document.getElementById('gasConsumption').value = '';
            generateSuggestions();
            document.getElementById('consumptionPlanDisplay').innerHTML = generateConsumptionPlan();
        });
    }
    const crisisToggle = document.getElementById('crisisModeToggle');
    if (crisisToggle) {
        crisisToggle.addEventListener('change', (e) => {
            setCrisisMode(e.target.checked);
            document.body.classList.toggle('crisis', e.target.checked);
            generateAlerts();
            generateSuggestions();
            document.getElementById('consumptionPlanDisplay').innerHTML = generateConsumptionPlan();
            document.getElementById('mealSuggestionsDisplay').innerHTML = generateMealSuggestions();
            localStorage.setItem('crisis_mode', e.target.checked);
        });
    }
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => logout());
}

function populateScenarioDropdown() {
    const scenarios = window.crisisScenarios || [];
    const select = document.getElementById('scenarioSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- انتخاب کنید --</option>';
    scenarios.forEach(scenario => {
        const option = document.createElement('option');
        option.value = scenario.id;
        option.textContent = scenario.name;
        select.appendChild(option);
    });
    select.addEventListener('change', (e) => {
        const selectedId = parseInt(e.target.value);
        const scenario = scenarios.find(s => s.id === selectedId);
        const tipDiv = document.getElementById('scenarioTip');
        if (scenario) {
            tipDiv.innerHTML = `<strong>توصیه:</strong> ${scenario.tip}<br><strong>اولویت منابع:</strong> ${scenario.priority_resources.join(' → ')}`;
        } else {
            tipDiv.innerHTML = '';
        }
        generateSuggestions();
        document.getElementById('consumptionPlanDisplay').innerHTML = generateConsumptionPlan();
        document.getElementById('mealSuggestionsDisplay').innerHTML = generateMealSuggestions();
    });
}

async function initDashboard() {
    if (!checkAuth()) return;
    const loggedInUser = getLoggedInUser();
    if (loggedInUser && !store.currentUserProfile) {
        const profile = getUserProfile(loggedInUser);
        if (profile) setCurrentUserProfile(profile);
    }
    try {
        const response = await fetch('assets/data/crisis_scenarios.json');
        window.crisisScenarios = await response.json();
    } catch(e) { console.warn('خطا در بارگذاری سناریوها'); window.crisisScenarios = []; }
    loadInventory();
    loadConsumptionData();
    renderInventoryTable();
    renderChart();
    generateAlerts();
    bindDashboardUI();
    initDrawer();
    updateDrawerItems();
    populateScenarioDropdown();
    generateSuggestions();
    document.getElementById('consumptionPlanDisplay').innerHTML = generateConsumptionPlan();
    document.getElementById('mealSuggestionsDisplay').innerHTML = generateMealSuggestions();
    // AI
    const aiBtn = document.getElementById('aiSuggestionBtn');
    if (aiBtn) aiBtn.addEventListener('click', handleAISuggestion);
    const savedCrisis = localStorage.getItem('crisis_mode');
    const crisisToggle = document.getElementById('crisisModeToggle');
    if (savedCrisis === 'true' && crisisToggle) {
        crisisToggle.checked = true;
        setCrisisMode(true);
        document.body.classList.add('crisis');
        generateAlerts();
        generateSuggestions();
        document.getElementById('consumptionPlanDisplay').innerHTML = generateConsumptionPlan();
        document.getElementById('mealSuggestionsDisplay').innerHTML = generateMealSuggestions();
    }
    const userDisplay = document.getElementById('userDisplay');
    const userAvatar = document.getElementById('userAvatar');
    if (userDisplay && loggedInUser) userDisplay.innerText = loggedInUser;
    if (userAvatar && loggedInUser) {
        const avatarBase64 = getUserAvatar(loggedInUser);
        if (avatarBase64) userAvatar.src = avatarBase64;
        else {
            const firstChar = loggedInUser.charAt(0).toUpperCase();
            userAvatar.src = `https://ui-avatars.com/api/?background=1e466e&color=fff&rounded=true&size=36&name=${firstChar}`;
        }
        const profileClickable = document.getElementById('profileClickable');
        if (profileClickable) {
            profileClickable.style.cursor = 'pointer';
            profileClickable.addEventListener('click', () => window.location.href = 'profile.html');
        }
    }
}

function initIndex() {
    checkAuth();
    initDrawer();
    updateDrawerItems();
}

if (window.location.pathname.includes('login.html')) {
    import('./modules/auth.js').then(module => module.initAuthPage());
} else if (window.location.pathname.includes('dashboard.html')) {
    document.addEventListener('DOMContentLoaded', initDashboard);
} else if (window.location.pathname.includes('profile.html') || window.location.pathname.includes('food.html') || window.location.pathname.includes('energy.html')) {
    // handled by their own scripts
} else {
    document.addEventListener('DOMContentLoaded', initIndex);
}

addListener('inventory', () => {
    if (window.location.pathname.includes('dashboard.html')) {
        renderInventoryTable();
        generateAlerts();
        generateSuggestions();
        document.getElementById('consumptionPlanDisplay').innerHTML = generateConsumptionPlan();
        document.getElementById('mealSuggestionsDisplay').innerHTML = generateMealSuggestions();
    }
});
addListener('crisisMode', () => {
    if (window.location.pathname.includes('dashboard.html')) {
        generateAlerts();
        generateSuggestions();
        document.getElementById('consumptionPlanDisplay').innerHTML = generateConsumptionPlan();
        document.getElementById('mealSuggestionsDisplay').innerHTML = generateMealSuggestions();
    }
});
addListener('consumptionData', () => {
    if (window.location.pathname.includes('dashboard.html')) {
        renderChart();
        generateSuggestions();
        document.getElementById('consumptionPlanDisplay').innerHTML = generateConsumptionPlan();
    }
});
addListener('currentUserProfile', () => {
    if (window.location.pathname.includes('dashboard.html')) {
        generateAlerts();
        generateSuggestions();
        document.getElementById('consumptionPlanDisplay').innerHTML = generateConsumptionPlan();
        document.getElementById('mealSuggestionsDisplay').innerHTML = generateMealSuggestions();
    }
});
