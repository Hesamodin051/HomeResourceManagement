// ============================================================
// app.js - فایل ورودی اصلی سامانه تدبیر منزل (نسخه نهایی با Hugging Face)
// ============================================================

import { checkAuth, getLoggedInUser, logout, getUserProfile, getUserAvatar } from './modules/auth.js';
import { loadInventory, addItem, editItem, deleteItem, consumeIngredients } from './modules/inventory.js';
import { loadConsumptionData, saveTodayConsumption } from './modules/consumption.js';
import { store, setCrisisMode, addListener, setCurrentUserProfile } from './modules/store.js';
import { generateSuggestions } from './modules/suggestion.js';
import { generateConsumptionPlan, getMealDetails, getAlternativeMeal } from './modules/consumption-planner.js';
import { getSmartSuggestions } from './modules/ai.js';
import { loadRecipes } from './modules/recipe-planner.js';

// ===== غیرفعال کردن پیام Puter.js =====
if (typeof puter !== 'undefined') {
    puter.quiet = true;
}

// ===== پرچم برای جلوگیری از درخواست‌های همزمان در بارگذاری اولیه =====
let isInitialLoad = true;

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
// 3. رندر جدول ذخایر
// ============================================================
function renderInventoryTable() {
    const tbody = document.getElementById('inventoryBody');
    if (!tbody) {
        console.warn('⚠️ المان inventoryBody پیدا نشد.');
        return;
    }
    tbody.innerHTML = '';
    const inventory = store.inventory || [];
    if (inventory.length === 0) {
        const row = tbody.insertRow();
        const cell = row.insertCell(0);
        cell.colSpan = 5;
        cell.textContent = 'هیچ ماده غذایی ثبت نشده است.';
        cell.style.textAlign = 'center';
        cell.style.color = '#94a3b8';
        cell.style.padding = '1rem 0';
        return;
    }
    inventory.forEach(item => {
        const row = tbody.insertRow();
        row.insertCell(0).innerText = item.name;
        row.insertCell(1).innerText = item.quantity;
        row.insertCell(2).innerText = item.unit;
        row.insertCell(3).innerText = item.expiry || '—';
        const actionsCell = row.insertCell(4);
        const editBtn = document.createElement('button');
        editBtn.innerText = '✏️';
        editBtn.className = 'edit-btn';
        editBtn.onclick = function() {
            const newName = prompt('نام جدید:', item.name);
            const newQty = parseFloat(prompt('مقدار جدید:', item.quantity));
            const newUnit = prompt('واحد جدید:', item.unit);
            const newExpiry = prompt('تاریخ انقضا (YYYY-MM-DD):', item.expiry);
            if (newName && !isNaN(newQty) && newQty > 0 && newUnit) {
                editItem(item.id, newName.trim(), newQty, newUnit.trim(), newExpiry || '');
                refreshAll();
            } else alert('ورودی نامعتبر');
        };
        const delBtn = document.createElement('button');
        delBtn.innerText = '🗑️';
        delBtn.className = 'delete-btn';
        delBtn.onclick = function() {
            if (confirm('آیا از حذف این قلم اطمینان دارید؟')) {
                deleteItem(item.id);
                refreshAll();
            }
        };
        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(delBtn);
    });
}

// ============================================================
// 4. تولید هشدارها
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
// 5. رندر نمودار مصرف
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
// 6. به‌روزرسانی الگوی مصرف (با Debounce)
// ============================================================
let planUpdateTimeout = null;

function updateConsumptionPlan() {
    if (planUpdateTimeout) {
        clearTimeout(planUpdateTimeout);
    }
    planUpdateTimeout = setTimeout(() => {
        const display = document.getElementById('consumptionPlanDisplay');
        if (!display) {
            console.warn('⚠️ المان consumptionPlanDisplay پیدا نشد.');
            planUpdateTimeout = null;
            return;
        }
        const days = parseInt(document.getElementById('planDaysSelect')?.value || 7);
        console.log(`🔄 بروزرسانی الگوی مصرف برای ${days} روز...`);
        
        display.innerHTML = `
            <div class="text-center text-gray-400 py-4">
                <i class="fas fa-spinner fa-spin text-2xl mb-2"></i>
                <p>🤖 در حال دریافت برنامه هوشمند...</p>
            </div>
        `;
        
        generateConsumptionPlan(days)
            .then(html => {
                display.innerHTML = html;
                attachMealClickEvents();
                attachSwapEvents();
                console.log('✅ الگوی مصرف به‌روزرسانی شد.');
            })
            .catch(err => {
                console.error('❌ خطا در به‌روزرسانی الگوی مصرف:', err);
                display.innerHTML = `
                    <div class="text-center text-red-400 py-4">
                        <i class="fas fa-exclamation-triangle text-3xl block mb-2"></i>
                        خطا در دریافت برنامه.
                        <br><span class="text-xs text-gray-400">${err.message || ''}</span>
                    </div>
                `;
            })
            .finally(() => {
                planUpdateTimeout = null;
            });
    }, 800);
}

// ============================================================
// 7. تحلیل ارزش غذایی هوشمند
// ============================================================
async function updateNutritionAnalysis() {
    const display = document.getElementById('nutritionDisplay');
    if (!display) return;
    
    display.innerHTML = `<div class="text-center text-gray-400 py-4"><i class="fas fa-spinner fa-spin text-2xl"></i> در حال تحلیل...</div>`;
    
    try {
        const { analyzeInventoryNutrition } = await import('./modules/food.js');
        const result = await analyzeInventoryNutrition();
        
        if (result.status === 'empty') {
            display.innerHTML = `<div class="text-center text-gray-400 py-4">${result.message}</div>`;
            return;
        }

        const statusColors = {
            good: 'text-green-600 bg-green-50 border-green-200',
            warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
            critical: 'text-red-600 bg-red-50 border-red-200'
        };
        const statusColor = statusColors[result.status] || statusColors.good;

        let vitaminHtml = '';
        if (result.vitamins && Object.keys(result.vitamins).length > 0) {
            const vitList = Object.keys(result.vitamins).slice(0, 8);
            vitaminHtml = vitList.map(v => 
                `<span class="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">${v}</span>`
            ).join('');
        }

        let suggestionHtml = '';
        if (result.suggestions && result.suggestions.length > 0) {
            suggestionHtml = result.suggestions.slice(0, 3).map(s => 
                `<li class="text-xs text-blue-600">${s}</li>`
            ).join('');
        }

        display.innerHTML = `
            <div class="nutrition-analysis">
                <div class="flex items-center gap-3 mb-3">
                    <span class="text-lg">📊</span>
                    <span class="text-sm font-bold text-gray-700">وضعیت تغذیه‌ای</span>
                    <span class="text-xs px-2 py-0.5 rounded-full ${statusColor}">${result.statusMessage}</span>
                    <span class="text-xs text-gray-400">(${result.totalItems} قلم)</span>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
                    <div class="p-2 bg-blue-50 rounded-lg"><span class="text-xs text-gray-500">کالری</span><p class="text-sm font-bold text-blue-600">${result.calories} <span class="text-xs font-normal text-gray-400">/${Math.round(result.familyNeeds?.calories || 0)}</span></p><span class="text-xs text-gray-400">${result.percentages?.calories || 0}%</span></div>
                    <div class="p-2 bg-green-50 rounded-lg"><span class="text-xs text-gray-500">پروتئین</span><p class="text-sm font-bold text-green-600">${result.protein}g <span class="text-xs font-normal text-gray-400">/${Math.round(result.familyNeeds?.protein || 0)}</span></p><span class="text-xs text-gray-400">${result.percentages?.protein || 0}%</span></div>
                    <div class="p-2 bg-yellow-50 rounded-lg"><span class="text-xs text-gray-500">کربوهیدرات</span><p class="text-sm font-bold text-yellow-600">${result.carbs}g <span class="text-xs font-normal text-gray-400">/${Math.round(result.familyNeeds?.carbs || 0)}</span></p><span class="text-xs text-gray-400">${result.percentages?.carbs || 0}%</span></div>
                    <div class="p-2 bg-red-50 rounded-lg"><span class="text-xs text-gray-500">چربی</span><p class="text-sm font-bold text-red-600">${result.fat}g <span class="text-xs font-normal text-gray-400">/${Math.round(result.familyNeeds?.fat || 0)}</span></p><span class="text-xs text-gray-400">${result.percentages?.fat || 0}%</span></div>
                    <div class="p-2 bg-purple-50 rounded-lg"><span class="text-xs text-gray-500">فیبر</span><p class="text-sm font-bold text-purple-600">${result.fiber}g <span class="text-xs font-normal text-gray-400">/${Math.round(result.familyNeeds?.fiber || 0)}</span></p><span class="text-xs text-gray-400">${result.percentages?.fiber || 0}%</span></div>
                </div>
                ${vitaminHtml ? `<div class="flex flex-wrap gap-1 mt-2">${vitaminHtml}</div>` : ''}
                ${suggestionHtml ? `<div class="mt-2 p-2 bg-blue-50 rounded-lg"><p class="text-xs font-medium text-blue-700">💡 پیشنهادات:</p><ul class="text-xs text-blue-600 space-y-0.5">${suggestionHtml}</ul></div>` : ''}
                ${result.deficiencies?.length > 0 ? `<div class="mt-2 text-xs text-red-500">⚠️ کمبود: ${result.deficiencies.slice(0, 5).join('، ')}${result.deficiencies.length > 5 ? ` و ${result.deficiencies.length - 5} مورد دیگر` : ''}</div>` : ''}
            </div>
        `;
    } catch (error) {
        console.error('❌ خطا در تحلیل ارزش غذایی:', error);
        display.innerHTML = `<div class="text-center text-red-400 py-4">خطا در تحلیل ارزش غذایی.</div>`;
    }
}

// ============================================================
// 8. تابع به‌روزرسانی همه بخش‌ها
// ============================================================
function refreshAll() {
    renderInventoryTable();
    generateAlerts();
    generateSuggestions();
    updateConsumptionPlan();
    updateNutritionAnalysis();
}

// ============================================================
// 9. تعویض وعده غذایی (با Hugging Face)
// ============================================================
async function swapMeal(dayIndex, mealType, currentName) {
    const inventory = store.inventory || [];
    const foodNames = inventory.map(item => item.name);
    if (foodNames.length === 0) {
        alert('هیچ ماده‌ای در انبار ثبت نشده است. لطفاً ابتدا مواد غذایی را اضافه کنید.');
        return;
    }
    
    let options = foodNames.map(name => `<option value="${name}">${name}</option>`).join('');
    const additionalOptions = `
        <option value="__chatbot__">🤖 دریافت پیشنهاد از Hugging Face</option>
        <option value="__custom__">✏️ وارد کردن دستی</option>
    `;
    const selectHTML = `
        <div class="p-4">
            <p class="text-sm text-gray-600 mb-2">غذای جدید برای وعده‌ی ${mealType} (جایگزین "${currentName}"):</p>
            <select id="mealSwapSelect" class="input-modern w-full">${options}${additionalOptions}</select>
            <div class="flex gap-3 mt-4">
                <button id="confirmSwapBtn" class="btn-gradient flex-1 justify-center">تأیید</button>
                <button id="cancelSwapBtn" class="btn-outline flex-1 justify-center">لغو</button>
            </div>
        </div>
    `;
    
    const modal = document.getElementById('consumeModal');
    const body = document.getElementById('consumeModalBody');
    const title = document.getElementById('consumeModalTitle');
    if (!modal || !body) return;
    title.textContent = '🔄 تعویض وعده';
    body.innerHTML = selectHTML;
    modal.classList.remove('hidden');
    
    document.getElementById('cancelSwapBtn').addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    document.getElementById('confirmSwapBtn').addEventListener('click', async () => {
        const select = document.getElementById('mealSwapSelect');
        const selected = select.value;
        let newMealName = '';
        
        if (selected === '__chatbot__') {
            const inventoryList = inventory.map(item => 
                `- ${item.name}: ${item.quantity} ${item.unit}`
            ).join('\n');
            const familySize = getFamilySize();
            
            try {
                // ===== استفاده از Hugging Face برای پیشنهاد =====
                const { getAlternativeMealAI } = await import('./modules/huggingface.js');
                newMealName = await getAlternativeMealAI(mealType, inventoryList, familySize);
                if (!newMealName || newMealName.length < 2) {
                    newMealName = 'غذای ساده';
                }
                console.log('✅ پیشنهاد از Hugging Face دریافت شد:', newMealName);
            } catch (e) {
                console.error('❌ خطا در دریافت پیشنهاد از Hugging Face:', e);
                alert('خطا در دریافت پیشنهاد از هوش مصنوعی. لطفاً دستی وارد کنید.');
                return;
            }
        } else if (selected === '__custom__') {
            newMealName = prompt('نام غذای جدید را وارد کنید:');
            if (!newMealName) return;
        } else {
            newMealName = selected;
        }
        
        const planData = window.currentPlanData;
        if (planData?.plan?.[dayIndex]) {
            planData.plan[dayIndex].meals[mealType] = { name: newMealName, cook_time: Math.floor(Math.random() * 30 + 15) };
            const days = parseInt(document.getElementById('planDaysSelect')?.value || 7);
            const display = document.getElementById('consumptionPlanDisplay');
            if (display) {
                const html = await generateConsumptionPlan(days);
                display.innerHTML = html;
                attachMealClickEvents();
                attachSwapEvents();
            }
            alert(`✅ وعده "${currentName}" با "${newMealName}" جایگزین شد.`);
        }
        modal.classList.add('hidden');
    });
}

// ============================================================
// 10. اتصال رویدادهای کلیک روی وعده و تعویض
// ============================================================
function attachMealClickEvents() {
    document.querySelectorAll('.day-card .meal-item').forEach(el => {
        el.removeEventListener('click', mealClickHandler);
        el.addEventListener('click', mealClickHandler);
    });
}

function mealClickHandler(e) {
    const el = e.currentTarget;
    const dayIndex = parseInt(el.dataset.dayIndex);
    const mealType = el.dataset.mealType;
    const planData = window.currentPlanData;
    if (!planData?.plan) return;
    const mealDetails = getMealDetails(dayIndex, mealType, planData.plan);
    if (mealDetails) {
        window._currentMealData = mealDetails;
        showConsumeModal(mealDetails);
    }
}

function attachSwapEvents() {
    document.querySelectorAll('.swap-meal-btn').forEach(btn => {
        btn.removeEventListener('click', swapHandler);
        btn.addEventListener('click', swapHandler);
    });
}

function swapHandler(e) {
    const btn = e.currentTarget;
    const dayIndex = parseInt(btn.dataset.day);
    const mealType = btn.dataset.meal;
    const currentName = btn.dataset.current;
    swapMeal(dayIndex, mealType, currentName);
}

// ============================================================
// 11. مدیریت مدال تأیید مصرف
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
        <div class="flex justify-end mb-3">
            <button id="rejectMealBtn" class="btn-danger !py-1 !px-3 text-sm">
                <i class="fas fa-times ml-1"></i> رد و پیشنهاد جایگزین
            </button>
        </div>
        <p class="text-sm text-gray-600 mb-3">مواد اولیه مورد نیاز برای ${familySize} نفر:</p>
        <div class="space-y-2">
    `;
    mealData.ingredients.forEach((ing, index) => {
        const needed = (ing.quantity * familySize).toFixed(2);
        html += `
            <div class="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                <span class="w-1/3 text-sm font-medium text-gray-700">${ing.name}</span>
                <input type="number" id="ing_${index}" value="${needed}" step="0.01" min="0" class="input-modern w-24 text-center" data-ingredient="${ing.name}" />
                <span class="text-sm text-gray-500">${ing.unit}</span>
                <span class="text-xs text-gray-400">(نیاز: ${needed} ${ing.unit})</span>
            </div>
        `;
    });
    html += `
        </div>
        <div class="flex gap-3 mt-4">
            <button id="confirmConsumeBtn" class="btn-gradient flex-1 justify-center"><i class="fas fa-check ml-2"></i> تأیید و مصرف</button>
            <button id="cancelConsumeBtn" class="btn-outline flex-1 justify-center"><i class="fas fa-times ml-2"></i> لغو</button>
        </div>
        <div id="consumeMessage" class="mt-3 text-center text-sm hidden"></div>
    `;
    body.innerHTML = html;
    modal.classList.remove('hidden');

    document.getElementById('closeConsumeModal').addEventListener('click', closeConsumeModal);
    document.getElementById('cancelConsumeBtn').addEventListener('click', closeConsumeModal);
    document.getElementById('confirmConsumeBtn').addEventListener('click', handleConsumeConfirm);
    document.getElementById('rejectMealBtn').addEventListener('click', function() {
        if (confirm(`آیا از رد وعده "${mealData.mealName}" و دریافت پیشنهاد جایگزین اطمینان دارید؟`)) {
            handleRejectMeal(mealData);
        }
    });
}

function closeConsumeModal() {
    document.getElementById('consumeModal').classList.add('hidden');
}

async function handleRejectMeal(mealData) {
    const newMealName = await getAlternativeMeal(mealData.mealType, mealData.dayIndex);
    const planData = window.currentPlanData;
    if (planData?.plan?.[mealData.dayIndex]) {
        const day = planData.plan[mealData.dayIndex];
        if (day) {
            day.meals[mealData.mealType] = { name: newMealName, cook_time: Math.floor(Math.random() * 30 + 15) };
            const display = document.getElementById('consumptionPlanDisplay');
            if (display) {
                const days = parseInt(document.getElementById('planDaysSelect')?.value || 7);
                display.innerHTML = await generateConsumptionPlan(days);
                attachMealClickEvents();
                attachSwapEvents();
                alert(`✅ وعده "${mealData.mealName}" با "${newMealName}" جایگزین شد.`);
            }
        }
    }
    closeConsumeModal();
}

async function handleConsumeConfirm() {
    const mealData = window._currentMealData;
    if (!mealData) return;
    const messageDiv = document.getElementById('consumeMessage');
    const ingredients = mealData.ingredients.map((ing, index) => {
        const input = document.getElementById(`ing_${index}`);
        const newQty = parseFloat(input.value) || 0;
        return { ...ing, quantity: newQty / getFamilySize() };
    });
    if (!confirm(`آیا از مصرف ${mealData.mealName} برای ${getFamilySize()} نفر اطمینان دارید؟`)) return;
    const result = consumeIngredients(ingredients, getFamilySize());
    if (result.success) {
        messageDiv.className = 'mt-3 text-center text-sm text-green-600 p-2 bg-green-50 rounded-lg';
        messageDiv.textContent = `✅ ${result.message}`;
        setTimeout(() => { closeConsumeModal(); refreshAll(); }, 1500);
    } else {
        messageDiv.className = 'mt-3 text-center text-sm text-red-600 p-2 bg-red-50 rounded-lg';
        messageDiv.textContent = `❌ ${result.message}`;
    }
}

// ============================================================
// 12. اتصال رویدادهای داشبورد
// ============================================================
function bindDashboardUI() {
    const saveBtn = document.getElementById('saveConsumptionBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function() {
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
            updateConsumptionPlan();
        });
    }

    const crisisToggle = document.getElementById('crisisModeToggle');
    if (crisisToggle) {
        crisisToggle.addEventListener('change', function(e) {
            setCrisisMode(e.target.checked);
            document.body.classList.toggle('crisis', e.target.checked);
            refreshAll();
            localStorage.setItem('crisis_mode', e.target.checked);
        });
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', () => logout());

    const generatePlanBtn = document.getElementById('generatePlanBtn');
    if (generatePlanBtn) {
        generatePlanBtn.addEventListener('click', function() {
            updateConsumptionPlan();
        });
    }

    const chatbotOpener = document.getElementById('openChatbotForMeal');
    if (chatbotOpener) {
        chatbotOpener.addEventListener('click', () => {
            const fab = document.getElementById('chatbotFab');
            if (fab) fab.click();
        });
    }
}

// ============================================================
// 13. سناریوهای بحران
// ============================================================
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
    select.addEventListener('change', function(e) {
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
        updateConsumptionPlan();
    });
}

// ============================================================
// 14. مقداردهی اولیه داشبورد
// ============================================================
function initDashboard() {
    if (!checkAuth()) return;
    const loggedInUser = getLoggedInUser();
    console.log('👤 کاربر فعلی:', loggedInUser);
    
    if (loggedInUser) {
        store.currentUser = loggedInUser;
    }
    
    if (loggedInUser && !store.currentUserProfile) {
        const profile = getUserProfile(loggedInUser);
        if (profile) setCurrentUserProfile(profile);
    }
    
    fetch('assets/data/crisis_scenarios.json')
        .then(res => res.json())
        .then(data => { window.crisisScenarios = data; })
        .catch(() => { window.crisisScenarios = []; })
        .finally(() => {
            loadInventory();
            await loadRecipes();
            isInitialLoad = true;
            loadConsumptionData();
            isInitialLoad = false;
            
            renderInventoryTable();
            renderChart();
            generateAlerts();
            bindDashboardUI();
            populateScenarioDropdown();
            generateSuggestions();
            updateConsumptionPlan();
            updateNutritionAnalysis();
            
            const aiBtn = document.getElementById('aiSuggestionBtn');
            if (aiBtn) aiBtn.addEventListener('click', handleAISuggestion);
            
            const savedCrisis = localStorage.getItem('crisis_mode');
            const crisisToggle = document.getElementById('crisisModeToggle');
            if (savedCrisis === 'true' && crisisToggle) {
                crisisToggle.checked = true;
                setCrisisMode(true);
                document.body.classList.add('crisis');
                refreshAll();
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
        });
}

// ============================================================
// 15. مقداردهی اولیه صفحه اصلی (index.html)
// ============================================================
function initIndex() {
    checkAuth();
    console.log('✅ صفحه اصلی بارگذاری شد.');
}

// ============================================================
// 16. چت‌بات هوشمند
// ============================================================
function loadChatbotWidget() {
    if (typeof puter === 'undefined') {
        console.warn('⚠️ Puter.js بارگذاری نشده است. چت‌بات غیرفعال می‌شود.');
        return;
    }
    import('./modules/chatbot.js').then(chatbotModule => {
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
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendUserMessage();
            }
        });
        input.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 80) + 'px';
        });
        document.querySelectorAll('.chatbot-quick-suggestions button').forEach(btn => {
            btn.addEventListener('click', function() {
                const question = this.getAttribute('data-question');
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
    }).catch(err => console.error('❌ خطا در بارگذاری چت‌بات:', err));
}

// ============================================================
// 17. مدیریت مسیرها
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
    document.addEventListener('DOMContentLoaded', initIndex);
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadChatbotWidget);
    } else {
        loadChatbotWidget();
    }
}

// ============================================================
// 18. شنونده‌های تغییرات store
// ============================================================
addListener('inventory', function() {
    if (window.location.pathname.includes('dashboard.html') && !isInitialLoad) {
        refreshAll();
    }
});
addListener('crisisMode', function() {
    if (window.location.pathname.includes('dashboard.html') && !isInitialLoad) {
        refreshAll();
    }
});
addListener('consumptionData', function() {
    if (window.location.pathname.includes('dashboard.html') && !isInitialLoad) {
        renderChart();
        generateSuggestions();
        updateConsumptionPlan();
    }
});
addListener('currentUserProfile', function() {
    if (window.location.pathname.includes('dashboard.html') && !isInitialLoad) {
        refreshAll();
    }
});

console.log('🚀 سامانه تدبیر منزل با موفقیت بارگذاری شد.');
