// ============================================================
// app.js - فایل ورودی اصلی سامانه تدبیر منزل (نسخه نهایی)
// ============================================================

import { checkAuth, getLoggedInUser, logout, getUserProfile, getUserAvatar } from './modules/auth.js';
import { loadInventory, addItem, editItem, deleteItem, consumeIngredients } from './modules/inventory.js';
import { loadConsumptionData, saveTodayConsumption } from './modules/consumption.js';
import { store, setCrisisMode, addListener, setCurrentUserProfile } from './modules/store.js';
import { generateSuggestions } from './modules/suggestion.js';
import { generateConsumptionPlan, getMealDetails } from './modules/consumption-planner.js';
import { generateMealSuggestions, refreshMealSuggestions, initMealPlanner } from './modules/meal-planner.js';
import { getSmartSuggestions } from './modules/ai.js';
import { analyzeInventoryNutrition } from './modules/food.js';

// ===== غیرفعال کردن پیام Puter.js =====
if (typeof puter !== 'undefined') {
    puter.quiet = true;
}

// ============================================================
// 1. PWA: ثبت Service Worker
// ============================================================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(() => console.log('✅ Service Worker ثبت شد'))
        .catch(err => console.log('❌ خطا در ثبت Service Worker:', err));
}

// ============================================================
// 2. توابع مربوط به هوش مصنوعی (AI)
// ============================================================
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
        let text = '';
        if (typeof suggestion === 'string') {
            text = suggestion;
        } else if (suggestion && typeof suggestion === 'object') {
            text = JSON.stringify(suggestion);
        } else {
            text = String(suggestion || 'پاسخی دریافت نشد.');
        }
        display.innerHTML = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    } catch (error) {
        display.innerHTML = '❌ خطا در دریافت پیشنهادات. لطفاً دوباره تلاش کنید.';
        console.error('❌ خطا در handleAISuggestion:', error);
    } finally {
        btn.style.display = 'inline-block';
        loadingBtn.style.display = 'none';
    }
}

// ============================================================
// 3. رندر جدول ذخایر (اکنون async)
// ============================================================
async function renderInventoryTable() {
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
        editBtn.onclick = async () => {
            const newName = prompt('نام جدید:', item.name);
            const newQty = parseFloat(prompt('مقدار جدید:', item.quantity));
            const newUnit = prompt('واحد جدید:', item.unit);
            const newExpiry = prompt('تاریخ انقضا (YYYY-MM-DD):', item.expiry);
            if (newName && !isNaN(newQty) && newQty > 0 && newUnit) {
                editItem(item.id, newName.trim(), newQty, newUnit.trim(), newExpiry || '');
                await renderInventoryTable();
                generateAlerts();
                document.getElementById('consumptionPlanDisplay').innerHTML = await generateConsumptionPlan(
                    parseInt(document.getElementById('planDaysSelect')?.value || 7)
                );
                generateSuggestions();
                await updateNutritionAnalysis();
                refreshMealSuggestions();
            } else alert('ورودی نامعتبر');
        };
        const delBtn = document.createElement('button');
        delBtn.innerText = '🗑️';
        delBtn.className = 'delete-btn';
        delBtn.onclick = async () => {
            if (confirm('آیا از حذف این قلم اطمینان دارید؟')) {
                deleteItem(item.id);
                await renderInventoryTable();
                generateAlerts();
                document.getElementById('consumptionPlanDisplay').innerHTML = await generateConsumptionPlan(
                    parseInt(document.getElementById('planDaysSelect')?.value || 7)
                );
                generateSuggestions();
                await updateNutritionAnalysis();
                refreshMealSuggestions();
            }
        };
        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(delBtn);
    });
}

// ============================================================
// 4. تولید هشدارها (ساده - بدون async)
// ============================================================
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

// ============================================================
// 5. رندر نمودار مصرف (بدون async)
// ============================================================
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

// ============================================================
// 6. اتصال رویدادهای داشبورد (اکنون async)
// ============================================================
async function bindDashboardUI() {
    const saveBtn = document.getElementById('saveConsumptionBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
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
            document.getElementById('consumptionPlanDisplay').innerHTML = await generateConsumptionPlan(
                parseInt(document.getElementById('planDaysSelect')?.value || 7)
            );
        });
    }
    const crisisToggle = document.getElementById('crisisModeToggle');
    if (crisisToggle) {
        crisisToggle.addEventListener('change', async (e) => {
            setCrisisMode(e.target.checked);
            document.body.classList.toggle('crisis', e.target.checked);
            generateAlerts();
            generateSuggestions();
            document.getElementById('consumptionPlanDisplay').innerHTML = await generateConsumptionPlan(
                parseInt(document.getElementById('planDaysSelect')?.value || 7)
            );
            localStorage.setItem('crisis_mode', e.target.checked);
            await updateNutritionAnalysis();
            refreshMealSuggestions();
        });
    }
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => logout());
}

// ============================================================
// 7. سناریوهای بحران (اکنون async)
// ============================================================
async function populateScenarioDropdown() {
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
    select.addEventListener('change', async (e) => {
        const selectedId = parseInt(e.target.value);
        const scenario = scenarios.find(s => s.id === selectedId);
        const tipDiv = document.getElementById('scenarioTip');
        if (scenario) {
            tipDiv.innerHTML = `<strong>توصیه:</strong> ${scenario.tip}<br><strong>اولویت منابع:</strong> ${scenario.priority_resources.join(' → ')}`;
            tipDiv.style.display = 'block';
        } else {
            tipDiv.innerHTML = '';
            tipDiv.style.display = 'none';
        }
        generateSuggestions();
        document.getElementById('consumptionPlanDisplay').innerHTML = await generateConsumptionPlan(
            parseInt(document.getElementById('planDaysSelect')?.value || 7)
        );
    });
}

// ============================================================
// 8. تحلیل ارزش غذایی (async)
// ============================================================
async function updateNutritionAnalysis() {
    const display = document.getElementById('nutritionDisplay');
    if (!display) return;

    const inventory = store.inventory;
    if (!inventory || inventory.length === 0) {
        display.innerHTML = `
            <div class="text-center text-gray-400 py-4">
                <i class="fas fa-info-circle text-secondary ml-2"></i>
                هنوز مواد غذایی ثبت نشده است.
            </div>
        `;
        return;
    }

    try {
        const { analyzeInventoryNutrition } = await import('./modules/food.js');
        const nutrition = await analyzeInventoryNutrition();
        
        if (!nutrition || nutrition.calories === 0) {
            display.innerHTML = `
                <div class="text-center text-gray-400 py-4">
                    <i class="fas fa-info-circle text-secondary ml-2"></i>
                    اطلاعات ارزش غذایی برای مواد ثبت‌شده موجود نیست.
                    <br><span class="text-xs">برای دریافت اطلاعات، به صفحه مدیریت مواد غذایی بروید و روی دکمه 📥 کلیک کنید.</span>
                </div>
            `;
            return;
        }

        const vitaminHtml = Object.keys(nutrition.vitamins || {}).length > 0 ? `
            <div class="flex flex-wrap gap-1 mt-3">
                ${Object.keys(nutrition.vitamins).map(v => `<span class="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">${v}</span>`).join('')}
            </div>
        ` : '';

        display.innerHTML = `
            <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div class="text-center p-3 bg-blue-50 rounded-xl">
                    <span class="text-xs text-gray-500">کالری</span>
                    <p class="text-xl font-bold text-blue-600">${nutrition.calories}</p>
                    <span class="text-xs text-gray-400">کیلوکالری</span>
                </div>
                <div class="text-center p-3 bg-green-50 rounded-xl">
                    <span class="text-xs text-gray-500">پروتئین</span>
                    <p class="text-xl font-bold text-green-600">${nutrition.protein}g</p>
                </div>
                <div class="text-center p-3 bg-yellow-50 rounded-xl">
                    <span class="text-xs text-gray-500">کربوهیدرات</span>
                    <p class="text-xl font-bold text-yellow-600">${nutrition.carbs}g</p>
                </div>
                <div class="text-center p-3 bg-red-50 rounded-xl">
                    <span class="text-xs text-gray-500">چربی</span>
                    <p class="text-xl font-bold text-red-600">${nutrition.fat}g</p>
                </div>
                <div class="text-center p-3 bg-purple-50 rounded-xl">
                    <span class="text-xs text-gray-500">فیبر</span>
                    <p class="text-xl font-bold text-purple-600">${nutrition.fiber}g</p>
                </div>
            </div>
            ${vitaminHtml}
            <div class="text-xs text-gray-400 mt-3 text-center">تحلیل بر اساس ${inventory.length} قلم مواد غذایی</div>
        `;
    } catch (error) {
        console.error('خطا در تحلیل ارزش غذایی:', error);
        display.innerHTML = `
            <div class="text-center text-red-400 py-4">
                <i class="fas fa-exclamation-triangle ml-2"></i>
                خطا در تحلیل ارزش غذایی. لطفاً مجدداً تلاش کنید.
            </div>
        `;
    }
}

// ============================================================
// 9. مدیریت مدال تأیید مصرف
// ============================================================
function getFamilySize() {
    return store.currentUserProfile?.familySize || 4;
}

function showConsumeModal(mealData) {
    const modal = document.getElementById('consumeModal');
    const body = document.getElementById('consumeModalBody');
    const title = document.getElementById('consumeModalTitle');
    
    if (!modal || !body) return;
    
    const familySize = getFamilySize();
    title.textContent = `🍽️ ${mealData.mealName} - ${mealData.mealType} (${mealData.dayName})`;
    
    let html = `
        <p class="text-sm text-gray-600 mb-4">مواد اولیه مورد نیاز برای ${familySize} نفر:</p>
        <div class="space-y-3">
    `;
    
    mealData.ingredients.forEach((ing, index) => {
        const needed = (ing.quantity * familySize).toFixed(2);
        html += `
            <div class="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <span class="w-1/3 text-sm font-medium text-gray-700">${ing.name}</span>
                <input type="number" id="ing_${index}" value="${needed}" step="0.01" min="0" 
                       class="input-modern w-24 text-center" data-ingredient="${ing.name}" />
                <span class="text-sm text-gray-500">${ing.unit}</span>
                <span class="text-xs text-gray-400">(نیاز: ${needed} ${ing.unit})</span>
            </div>
        `;
    });
    
    html += `
        </div>
        <div class="flex gap-3 mt-6">
            <button id="confirmConsumeBtn" class="btn-gradient flex-1 justify-center">
                <i class="fas fa-check ml-2"></i> تأیید و مصرف
            </button>
            <button id="cancelConsumeBtn" class="btn-outline flex-1 justify-center">
                <i class="fas fa-times ml-2"></i> لغو
            </button>
        </div>
        <div id="consumeMessage" class="mt-3 text-center text-sm hidden"></div>
    `;
    
    body.innerHTML = html;
    modal.classList.remove('hidden');
    
    document.getElementById('closeConsumeModal').addEventListener('click', closeConsumeModal);
    document.getElementById('cancelConsumeBtn').addEventListener('click', closeConsumeModal);
    document.getElementById('confirmConsumeBtn').addEventListener('click', handleConsumeConfirm);
}

function closeConsumeModal() {
    document.getElementById('consumeModal').classList.add('hidden');
}

async function handleConsumeConfirm() {
    const mealData = window._currentMealData;
    if (!mealData) return;
    
    const messageDiv = document.getElementById('consumeMessage');
    const ingredients = mealData.ingredients.map((ing, index) => {
        const input = document.getElementById(`ing_${index}`);
        const newQty = parseFloat(input.value) || 0;
        return {
            ...ing,
            quantity: newQty / getFamilySize()
        };
    });
    
    if (!confirm(`آیا از مصرف ${mealData.mealName} برای ${getFamilySize()} نفر اطمینان دارید؟`)) return;
    
    const result = consumeIngredients(ingredients, getFamilySize());
    
    if (result.success) {
        messageDiv.className = 'mt-3 text-center text-sm text-green-600 p-2 bg-green-50 rounded-lg';
        messageDiv.textContent = `✅ ${result.message}`;
        setTimeout(() => {
            closeConsumeModal();
            regeneratePlan();
        }, 1500);
    } else {
        messageDiv.className = 'mt-3 text-center text-sm text-red-600 p-2 bg-red-50 rounded-lg';
        messageDiv.textContent = `❌ ${result.message}`;
    }
}

async function regeneratePlan() {
    const days = parseInt(document.getElementById('planDaysSelect')?.value || 7);
    const display = document.getElementById('consumptionPlanDisplay');
    if (display) {
        display.innerHTML = await generateConsumptionPlan(days);
        attachMealClickEvents();
    }
    await renderInventoryTable();
    generateAlerts();
    await updateNutritionAnalysis();
    refreshMealSuggestions();
}

function attachMealClickEvents() {
    document.querySelectorAll('.day-card .meal-item').forEach(el => {
        el.addEventListener('click', function() {
            const dayIndex = parseInt(this.dataset.dayIndex);
            const mealType = this.dataset.mealType;
            const planData = window.currentPlanData;
            if (!planData || !planData.plan) return;
            const mealDetails = getMealDetails(dayIndex, mealType, planData.plan);
            if (mealDetails) {
                window._currentMealData = mealDetails;
                showConsumeModal(mealDetails);
            }
        });
    });
}

// ============================================================
// 10. مقداردهی اولیه داشبورد
// ============================================================
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
    await renderInventoryTable();
    renderChart();
    generateAlerts();
    await bindDashboardUI();
    await populateScenarioDropdown();
    generateSuggestions();
    
    // ===== الگوی مصرف =====
    const planDisplay = document.getElementById('consumptionPlanDisplay');
    if (planDisplay) {
        const days = parseInt(document.getElementById('planDaysSelect')?.value || 7);
        planDisplay.innerHTML = await generateConsumptionPlan(days);
        attachMealClickEvents();
    }

    // ===== پیشنهادات غذایی =====
    await generateMealSuggestions(1);

    // ===== تحلیل ارزش غذایی =====
    await updateNutritionAnalysis();
    
    // ===== رویدادها =====
    document.getElementById('generatePlanBtn')?.addEventListener('click', async function() {
        const days = parseInt(document.getElementById('planDaysSelect').value);
        document.getElementById('consumptionPlanDisplay').innerHTML = await generateConsumptionPlan(days);
        attachMealClickEvents();
    });

    document.getElementById('refreshMealSuggestionsBtn')?.addEventListener('click', function() {
        refreshMealSuggestions();
    });
    
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
        document.getElementById('consumptionPlanDisplay').innerHTML = await generateConsumptionPlan(
            parseInt(document.getElementById('planDaysSelect')?.value || 7)
        );
        attachMealClickEvents();
        await updateNutritionAnalysis();
        await generateMealSuggestions(1);
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

    initMealPlanner();
}

// ============================================================
// 11. مقداردهی اولیه صفحه اصلی (index.html)
// ============================================================
function initIndex() {
    checkAuth();
    console.log('✅ صفحه اصلی بارگذاری شد.');
}

// ============================================================
// 12. چت‌بات هوشمند
// ============================================================
async function loadChatbotWidget() {
    try {
        if (typeof puter === 'undefined') {
            console.warn('⚠️ Puter.js بارگذاری نشده است. چت‌بات غیرفعال می‌شود.');
            return;
        }

        const chatbotModule = await import('./modules/chatbot.js');
        const chatbotApi = chatbotModule.default || chatbotModule;

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

        let isOpen = false;

        fab.addEventListener('click', () => {
            isOpen = !isOpen;
            windowEl.classList.toggle('open', isOpen);
            if (isOpen) {
                input.focus();
                const badge = document.getElementById('chatbotBadge');
                if (badge) badge.style.display = 'none';
            }
        });

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                isOpen = false;
                windowEl.classList.remove('open');
            });
        }

        async function sendUserMessage() {
            const text = input.value.trim();
            if (!text) return;

            addMessageToUI('user', text);
            input.value = '';
            input.style.height = 'auto';

            typingIndicator.style.display = 'flex';
            sendBtn.disabled = true;

            try {
                const response = await chatbotApi.sendMessage(text);
                addMessageToUI('assistant', response);
            } catch (error) {
                addMessageToUI('assistant', '❌ خطا در دریافت پاسخ. لطفاً دوباره تلاش کنید.');
                console.error(error);
            } finally {
                typingIndicator.style.display = 'none';
                sendBtn.disabled = false;
                messages.scrollTop = messages.scrollHeight;
            }
        }

        sendBtn.addEventListener('click', sendUserMessage);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendUserMessage();
            }
        });

        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 80) + 'px';
        });

        document.querySelectorAll('.chatbot-quick-suggestions button').forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.getAttribute('data-question');
                if (question) {
                    input.value = question;
                    sendUserMessage();
                }
            });
        });

        function addMessageToUI(role, content) {
            const div = document.createElement('div');
            div.className = `message ${role}`;
            div.innerHTML = content.replace(/\n/g, '<br>') + `<span class="time">${new Date().toLocaleTimeString('fa-IR')}</span>`;
            messages.insertBefore(div, typingIndicator);
            messages.scrollTop = messages.scrollHeight;
        }

        if (chatbotApi.getHistory && typeof chatbotApi.getHistory === 'function') {
            const history = chatbotApi.getHistory();
            history.forEach(msg => {
                if (msg.role !== 'system') {
                    addMessageToUI(msg.role, msg.content);
                }
            });
        }

        console.log('✅ چت‌بات هوشمند با موفقیت بارگذاری شد.');

    } catch (error) {
        console.error('❌ خطا در بارگذاری چت‌بات:', error);
    }
}

// ============================================================
// 13. مدیریت مسیرها
// ============================================================
const currentPath = window.location.pathname;

if (currentPath.includes('login.html')) {
    import('./modules/auth.js').then(module => module.initAuthPage());
} else if (currentPath.includes('dashboard.html')) {
    document.addEventListener('DOMContentLoaded', initDashboard);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadChatbotWidget);
    } else {
        loadChatbotWidget();
    }
} else if (currentPath.includes('profile.html') || 
           currentPath.includes('food.html') || 
           currentPath.includes('energy.html') ||
           currentPath.includes('reports.html') ||
           currentPath.includes('notifications.html') ||
           currentPath.includes('help.html') ||
           currentPath.includes('contact.html') ||
           currentPath.includes('chat-history.html') ||
           currentPath.includes('medications.html')) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadChatbotWidget);
    } else {
        loadChatbotWidget();
    }
} else {
    console.log('ℹ️ index.html - app.js اجرا نمی‌شود.');
}

// ============================================================
// 14. شنونده‌های تغییرات store (اکنون async)
// ============================================================
addListener('inventory', async () => {
    if (window.location.pathname.includes('dashboard.html')) {
        await renderInventoryTable();
        generateAlerts();
        generateSuggestions();
        document.getElementById('consumptionPlanDisplay').innerHTML = await generateConsumptionPlan(
            parseInt(document.getElementById('planDaysSelect')?.value || 7)
        );
        attachMealClickEvents();
        await updateNutritionAnalysis();
        refreshMealSuggestions();
    }
});

addListener('crisisMode', async () => {
    if (window.location.pathname.includes('dashboard.html')) {
        generateAlerts();
        generateSuggestions();
        document.getElementById('consumptionPlanDisplay').innerHTML = await generateConsumptionPlan(
            parseInt(document.getElementById('planDaysSelect')?.value || 7)
        );
        attachMealClickEvents();
        await updateNutritionAnalysis();
        refreshMealSuggestions();
    }
});

addListener('consumptionData', async () => {
    if (window.location.pathname.includes('dashboard.html')) {
        renderChart();
        generateSuggestions();
        document.getElementById('consumptionPlanDisplay').innerHTML = await generateConsumptionPlan(
            parseInt(document.getElementById('planDaysSelect')?.value || 7)
        );
        attachMealClickEvents();
    }
});

addListener('currentUserProfile', async () => {
    if (window.location.pathname.includes('dashboard.html')) {
        generateAlerts();
        generateSuggestions();
        document.getElementById('consumptionPlanDisplay').innerHTML = await generateConsumptionPlan(
            parseInt(document.getElementById('planDaysSelect')?.value || 7)
        );
        attachMealClickEvents();
        await updateNutritionAnalysis();
        refreshMealSuggestions();
    }
});

console.log('🚀 سامانه تدبیر منزل با موفقیت بارگذاری شد.');
