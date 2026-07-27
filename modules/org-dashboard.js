// modules/org-dashboard.js
// پنل مدیریت سازمانی - استفاده از org-store و org-consumption

import { getOrgSession, orgLogout } from './org-auth.js';
import { orgStore } from './org-store.js';
import { loadOrgConsumptionData, getOrgAverageConsumption } from './org-consumption.js';

// ============================================================
// دریافت همه کاربران از localStorage اصلی (برای نمایش در پنل)
// ============================================================
function getAllUsers() {
    try {
        const users = JSON.parse(localStorage.getItem('app_users') || '{}');
        return Object.keys(users).map(username => ({
            username,
            ...users[username]
        }));
    } catch {
        return [];
    }
}

// ============================================================
// بارگذاری داده‌های مصرف همه کاربران
// ============================================================
function loadAllUsersConsumption() {
    const allData = {};
    try {
        const users = JSON.parse(localStorage.getItem('app_users') || '{}');
        Object.keys(users).forEach(username => {
            const key = `daily_consumption_${username}`;
            const stored = localStorage.getItem(key);
            if (stored) {
                allData[username] = JSON.parse(stored);
            }
        });
    } catch (e) {
        console.warn('⚠️ خطا در بارگذاری داده‌های مصرف:', e);
    }
    return allData;
}

// ============================================================
// محاسبه آمار کل
// ============================================================
function calculateStatistics(consumptionData) {
    const stats = {
        totalUsers: 0,
        totalWater: 0,
        totalElectricity: 0,
        totalGas: 0,
        avgWater: 0,
        avgElectricity: 0,
        avgGas: 0,
        dailyConsumption: { water: [], electricity: [], gas: [], dates: [] }
    };
    
    let userCount = 0;
    let waterSum = 0, elecSum = 0, gasSum = 0;
    const dailyMap = {};
    
    for (const [username, data] of Object.entries(consumptionData)) {
        if (data && data.dates && data.dates.length > 0) {
            userCount++;
            const totalWater = data.water.reduce((a, b) => a + b, 0);
            const totalElec = data.electricity.reduce((a, b) => a + b, 0);
            const totalGas = data.gas.reduce((a, b) => a + b, 0);
            waterSum += totalWater;
            elecSum += totalElec;
            gasSum += totalGas;
            
            data.dates.forEach((date, index) => {
                if (!dailyMap[date]) {
                    dailyMap[date] = { water: 0, electricity: 0, gas: 0, count: 0 };
                }
                dailyMap[date].water += data.water[index] || 0;
                dailyMap[date].electricity += data.electricity[index] || 0;
                dailyMap[date].gas += data.gas[index] || 0;
                dailyMap[date].count++;
            });
        }
    }
    
    stats.totalUsers = userCount;
    stats.totalWater = Math.round(waterSum * 10) / 10;
    stats.totalElectricity = Math.round(elecSum * 10) / 10;
    stats.totalGas = Math.round(gasSum * 10) / 10;
    stats.avgWater = userCount > 0 ? Math.round((waterSum / userCount) * 10) / 10 : 0;
    stats.avgElectricity = userCount > 0 ? Math.round((elecSum / userCount) * 10) / 10 : 0;
    stats.avgGas = userCount > 0 ? Math.round((gasSum / userCount) * 10) / 10 : 0;
    
    const sortedDates = Object.keys(dailyMap).sort();
    stats.dailyConsumption = {
        dates: sortedDates,
        water: sortedDates.map(d => Math.round(dailyMap[d].water / dailyMap[d].count * 10) / 10),
        electricity: sortedDates.map(d => Math.round(dailyMap[d].electricity / dailyMap[d].count * 10) / 10),
        gas: sortedDates.map(d => Math.round(dailyMap[d].gas / dailyMap[d].count * 10) / 10)
    };
    
    return stats;
}

// ============================================================
// رندر داشبورد سازمانی
// ============================================================
export function renderOrgDashboard() {
    const session = getOrgSession();
    if (!session) {
        window.location.href = 'org-login.html';
        return;
    }
    
    document.getElementById('orgNameDisplay').textContent = session.organizationName || 'سازمان';
    
    // بارگذاری داده‌های مصرف سازمانی (برای نمودارهای سازمانی)
    loadOrgConsumptionData();
    
    const consumptionData = loadAllUsersConsumption();
    const users = getAllUsers();
    const stats = calculateStatistics(consumptionData);
    
    renderOrgStats(stats);
    renderOrgCharts(stats);
    renderOrgUsersTable(users, consumptionData);
    renderOrgAlerts(users, consumptionData);
    renderOrgForecast(stats);
}

// ============================================================
// رندر کارت‌های آماری
// ============================================================
function renderOrgStats(stats) {
    const container = document.getElementById('orgStatsCards');
    if (!container) return;
    
    const cards = [
        { label: 'تعداد کاربران', value: stats.totalUsers, icon: 'fa-users', color: 'blue' },
        { label: 'کل مصرف آب (L)', value: stats.totalWater.toLocaleString(), icon: 'fa-water', color: 'blue' },
        { label: 'کل مصرف برق (kW)', value: stats.totalElectricity.toLocaleString(), icon: 'fa-bolt', color: 'yellow' },
        { label: 'کل مصرف گاز (m³)', value: stats.totalGas.toLocaleString(), icon: 'fa-fire', color: 'orange' },
        { label: 'میانگین آب هر کاربر', value: stats.avgWater + ' L', icon: 'fa-chart-simple', color: 'cyan' },
        { label: 'میانگین برق هر کاربر', value: stats.avgElectricity + ' kW', icon: 'fa-chart-simple', color: 'yellow' }
    ];
    
    container.innerHTML = cards.map(card => `
        <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
            <div class="flex items-center justify-between">
                <div>
                    <p class="text-xs text-gray-400">${card.label}</p>
                    <p class="text-2xl font-bold text-primary mt-1">${card.value}</p>
                </div>
                <div class="w-10 h-10 rounded-full bg-${card.color}-50 flex items-center justify-center text-${card.color}-500">
                    <i class="fas ${card.icon}"></i>
                </div>
            </div>
        </div>
    `).join('');
}

// ============================================================
// رندر نمودارها
// ============================================================
function renderOrgCharts(stats) {
    // نمودار میانگین مصرف روزانه
    const ctx = document.getElementById('orgDailyChart');
    if (ctx && stats.dailyConsumption.dates.length > 0) {
        if (window.orgDailyChartInstance) window.orgDailyChartInstance.destroy();
        window.orgDailyChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: stats.dailyConsumption.dates.slice(-14),
                datasets: [
                    {
                        label: 'آب (لیتر)',
                        data: stats.dailyConsumption.water.slice(-14),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59,130,246,0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'برق (کیلووات)',
                        data: stats.dailyConsumption.electricity.slice(-14),
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245,158,11,0.1)',
                        fill: true,
                        tension: 0.3
                    },
                    {
                        label: 'گاز (مترمکعب)',
                        data: stats.dailyConsumption.gas.slice(-14),
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16,185,129,0.1)',
                        fill: true,
                        tension: 0.3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { 
                        position: 'top',
                        labels: { font: { family: 'Vazirmatn' } }
                    }
                },
                scales: {
                    x: { ticks: { font: { family: 'Vazirmatn' } } },
                    y: { ticks: { font: { family: 'Vazirmatn' } } }
                }
            }
        });
    }
    
    // نمودار توزیع مصرف
    const pieCtx = document.getElementById('orgDistributionChart');
    if (pieCtx) {
        if (window.orgPieChartInstance) window.orgPieChartInstance.destroy();
        window.orgPieChartInstance = new Chart(pieCtx, {
            type: 'pie',
            data: {
                labels: ['آب', 'برق', 'گاز'],
                datasets: [{
                    data: [
                        stats.totalWater || 1,
                        stats.totalElectricity || 1,
                        stats.totalGas || 1
                    ],
                    backgroundColor: ['#3b82f6', '#f59e0b', '#10b981'],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { 
                        position: 'top',
                        labels: { font: { family: 'Vazirmatn' } }
                    }
                }
            }
        });
    }
}

// ============================================================
// رندر جدول کاربران
// ============================================================
function renderOrgUsersTable(users, consumptionData) {
    const tbody = document.getElementById('orgUsersTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (users.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-gray-400 py-8">
                    <i class="fas fa-users text-4xl block mb-2 opacity-50"></i>
                    هیچ کاربری ثبت نشده است.
                </td>
            </tr>
        `;
        return;
    }
    
    users.forEach(user => {
        const data = consumptionData[user.username] || { dates: [], water: [], electricity: [], gas: [] };
        const totalWater = data.water.reduce((a, b) => a + b, 0) || 0;
        const totalElec = data.electricity.reduce((a, b) => a + b, 0) || 0;
        const totalGas = data.gas.reduce((a, b) => a + b, 0) || 0;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="px-4 py-3 font-medium">${user.username}</td>
            <td class="px-4 py-3">${user.familySize || 'نامشخص'}</td>
            <td class="px-4 py-3 text-blue-600">${totalWater.toFixed(1)} L</td>
            <td class="px-4 py-3 text-yellow-600">${totalElec.toFixed(1)} kW</td>
            <td class="px-4 py-3 text-green-600">${totalGas.toFixed(1)} m³</td>
            <td class="px-4 py-3">
                <button onclick="window.viewOrgUserDetails('${user.username}')" class="text-blue-500 hover:text-blue-700 text-sm">
                    <i class="fas fa-eye"></i> جزئیات
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// ============================================================
// نمایش جزئیات کاربر
// ============================================================
window.viewOrgUserDetails = function(username) {
    const consumptionData = loadAllUsersConsumption();
    const data = consumptionData[username] || { dates: [], water: [], electricity: [], gas: [] };
    const users = getAllUsers();
    const user = users.find(u => u.username === username);
    
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 z-50 flex items-center justify-center';
    modal.id = 'orgUserDetailModal';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-xl font-bold text-primary">📊 جزئیات کاربر: ${username}</h3>
                <button onclick="this.closest('#orgUserDetailModal').remove()" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            <div class="space-y-3">
                <div class="grid grid-cols-2 gap-3">
                    <div class="bg-gray-50 p-3 rounded-xl"><span class="text-xs text-gray-400">تعداد اعضا</span><p class="font-bold">${user?.familySize || 'نامشخص'}</p></div>
                    <div class="bg-gray-50 p-3 rounded-xl"><span class="text-xs text-gray-400">تعداد ثبت مصرف</span><p class="font-bold">${data.dates.length || 0} روز</p></div>
                    <div class="bg-blue-50 p-3 rounded-xl"><span class="text-xs text-gray-400">کل مصرف آب</span><p class="font-bold text-blue-600">${data.water.reduce((a,b) => a+b, 0).toFixed(1)} L</p></div>
                    <div class="bg-yellow-50 p-3 rounded-xl"><span class="text-xs text-gray-400">کل مصرف برق</span><p class="font-bold text-yellow-600">${data.electricity.reduce((a,b) => a+b, 0).toFixed(1)} kW</p></div>
                    <div class="bg-green-50 p-3 rounded-xl"><span class="text-xs text-gray-400">کل مصرف گاز</span><p class="font-bold text-green-600">${data.gas.reduce((a,b) => a+b, 0).toFixed(1)} m³</p></div>
                    <div class="bg-purple-50 p-3 rounded-xl"><span class="text-xs text-gray-400">میانگین روزانه</span><p class="font-bold text-purple-600">${(data.water.reduce((a,b) => a+b, 0) / (data.dates.length || 1)).toFixed(1)} L</p></div>
                </div>
                ${data.dates.length > 0 ? `
                    <div class="mt-3">
                        <p class="text-sm font-medium text-gray-700 mb-2">📈 روند مصرف اخیر</p>
                        <canvas id="orgUserDetailChart" height="150"></canvas>
                    </div>
                ` : `
                    <div class="text-center text-gray-400 py-4">هیچ داده‌ای برای این کاربر ثبت نشده است.</div>
                `}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    if (data.dates.length > 0) {
        setTimeout(() => {
            const ctx = document.getElementById('orgUserDetailChart');
            if (ctx) {
                new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: data.dates.slice(-7),
                        datasets: [
                            { label: 'آب', data: data.water.slice(-7), borderColor: '#3b82f6', tension: 0.3 },
                            { label: 'برق', data: data.electricity.slice(-7), borderColor: '#f59e0b', tension: 0.3 },
                            { label: 'گاز', data: data.gas.slice(-7), borderColor: '#10b981', tension: 0.3 }
                        ]
                    },
                    options: {
                        responsive: true,
                        plugins: { legend: { position: 'top', labels: { font: { family: 'Vazirmatn' } } } },
                        scales: { x: { ticks: { font: { family: 'Vazirmatn' } } } }
                    }
                });
            }
        }, 100);
    }
};

// ============================================================
// رندر هشدارهای مصرف
// ============================================================
function renderOrgAlerts(users, consumptionData) {
    const container = document.getElementById('orgAlertsList');
    if (!container) return;
    
    const alerts = [];
    
    users.forEach(user => {
        const data = consumptionData[user.username] || { dates: [], water: [], electricity: [], gas: [] };
        if (data.dates.length > 0) {
            const lastIndex = data.dates.length - 1;
            const lastWater = data.water[lastIndex] || 0;
            const lastElec = data.electricity[lastIndex] || 0;
            const lastGas = data.gas[lastIndex] || 0;
            const avgWater = data.water.reduce((a, b) => a + b, 0) / data.dates.length || 1;
            const avgElec = data.electricity.reduce((a, b) => a + b, 0) / data.dates.length || 1;
            const avgGas = data.gas.reduce((a, b) => a + b, 0) / data.dates.length || 1;
            
            if (lastWater > avgWater * 1.5) {
                alerts.push({
                    user: user.username,
                    type: 'water',
                    message: `مصرف آب ${(lastWater - avgWater).toFixed(1)} لیتر بیشتر از میانگین (${Math.round(lastWater/avgWater * 100)}%)`,
                    level: 'warning'
                });
            }
            if (lastElec > avgElec * 1.5) {
                alerts.push({
                    user: user.username,
                    type: 'electricity',
                    message: `مصرف برق ${(lastElec - avgElec).toFixed(1)} کیلووات بیشتر از میانگین (${Math.round(lastElec/avgElec * 100)}%)`,
                    level: 'warning'
                });
            }
            if (lastGas > avgGas * 1.5) {
                alerts.push({
                    user: user.username,
                    type: 'gas',
                    message: `مصرف گاز ${(lastGas - avgGas).toFixed(1)} مترمکعب بیشتر از میانگین (${Math.round(lastGas/avgGas * 100)}%)`,
                    level: 'warning'
                });
            }
        }
    });
    
    if (alerts.length === 0) {
        container.innerHTML = `
            <div class="text-center text-gray-400 py-4">
                <i class="fas fa-check-circle text-2xl text-green-500 mb-2 block"></i>
                همه کاربران در محدوده مصرف متعادل هستند.
            </div>
        `;
        return;
    }
    
    container.innerHTML = alerts.map(alert => `
        <div class="flex items-center gap-3 p-3 rounded-lg ${alert.level === 'warning' ? 'bg-yellow-50 border border-yellow-200' : 'bg-red-50 border border-red-200'}">
            <i class="fas fa-exclamation-triangle ${alert.level === 'warning' ? 'text-yellow-500' : 'text-red-500'}"></i>
            <div class="flex-1">
                <p class="text-sm font-medium text-gray-700">${alert.user}</p>
                <p class="text-xs text-gray-500">${alert.message}</p>
            </div>
            <span class="text-xs px-2 py-1 rounded-full ${alert.type === 'water' ? 'bg-blue-100 text-blue-700' : alert.type === 'electricity' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}">
                ${alert.type === 'water' ? '💧' : alert.type === 'electricity' ? '⚡' : '🔥'}
            </span>
        </div>
    `).join('');
}

// ============================================================
// پیش‌بینی مصرف
// ============================================================
function renderOrgForecast(stats) {
    const container = document.getElementById('orgForecastContainer');
    if (!container) return;
    
    const last7Water = stats.dailyConsumption.water.slice(-7) || [];
    const last7Elec = stats.dailyConsumption.electricity.slice(-7) || [];
    const last7Gas = stats.dailyConsumption.gas.slice(-7) || [];
    
    const avgWater = last7Water.length > 0 ? last7Water.reduce((a, b) => a + b, 0) / last7Water.length : 0;
    const avgElec = last7Elec.length > 0 ? last7Elec.reduce((a, b) => a + b, 0) / last7Elec.length : 0;
    const avgGas = last7Gas.length > 0 ? last7Gas.reduce((a, b) => a + b, 0) / last7Gas.length : 0;
    
    const forecast30days = {
        water: Math.round(avgWater * 30 * 10) / 10,
        electricity: Math.round(avgElec * 30 * 10) / 10,
        gas: Math.round(avgGas * 30 * 10) / 10
    };
    
    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-blue-50 rounded-xl p-4 text-center">
                <p class="text-xs text-gray-500">پیش‌بینی مصرف آب (۳۰ روز)</p>
                <p class="text-2xl font-bold text-blue-600">${forecast30days.water} L</p>
                <p class="text-xs text-gray-400">میانگین روزانه: ${Math.round(avgWater * 10) / 10} L</p>
            </div>
            <div class="bg-yellow-50 rounded-xl p-4 text-center">
                <p class="text-xs text-gray-500">پیش‌بینی مصرف برق (۳۰ روز)</p>
                <p class="text-2xl font-bold text-yellow-600">${forecast30days.electricity} kW</p>
                <p class="text-xs text-gray-400">میانگین روزانه: ${Math.round(avgElec * 10) / 10} kW</p>
            </div>
            <div class="bg-green-50 rounded-xl p-4 text-center">
                <p class="text-xs text-gray-500">پیش‌بینی مصرف گاز (۳۰ روز)</p>
                <p class="text-2xl font-bold text-green-600">${forecast30days.gas} m³</p>
                <p class="text-xs text-gray-400">میانگین روزانه: ${Math.round(avgGas * 10) / 10} m³</p>
            </div>
        </div>
    `;
}

// ============================================================
// صادرات CSV
// ============================================================
window.exportOrgCSV = function() {
    const users = getAllUsers();
    const consumptionData = loadAllUsersConsumption();
    
    if (users.length === 0) {
        alert('هیچ داده‌ای برای صادرات وجود ندارد.');
        return;
    }
    
    let csv = 'نام کاربری,تعداد اعضا,مصرف آب (L),مصرف برق (kW),مصرف گاز (m³)\n';
    users.forEach(user => {
        const data = consumptionData[user.username] || { water: [], electricity: [], gas: [] };
        const totalWater = data.water.reduce((a, b) => a + b, 0) || 0;
        const totalElec = data.electricity.reduce((a, b) => a + b, 0) || 0;
        const totalGas = data.gas.reduce((a, b) => a + b, 0) || 0;
        csv += `${user.username},${user.familySize || 0},${totalWater.toFixed(1)},${totalElec.toFixed(1)},${totalGas.toFixed(1)}\n`;
    });
    
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `org_report_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
};

// ============================================================
// فیلتر کردن جدول کاربران
// ============================================================
window.filterOrgUsers = function(query) {
    const rows = document.querySelectorAll('#orgUsersTableBody tr');
    const search = query.toLowerCase().trim();
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
};

// ============================================================
// مقداردهی اولیه
// ============================================================
export function initOrgDashboard() {
    const session = getOrgSession();
    if (!session) {
        window.location.href = 'org-login.html';
        return;
    }
    
    document.getElementById('orgLogoutBtn')?.addEventListener('click', orgLogout);
    document.getElementById('orgExportCSVBtn')?.addEventListener('click', window.exportOrgCSV);
    document.getElementById('orgSearchInput')?.addEventListener('input', function(e) {
        window.filterOrgUsers(e.target.value);
    });
    document.getElementById('orgRefreshBtn')?.addEventListener('click', function() {
        renderOrgDashboard();
    });
    
    renderOrgDashboard();
}
