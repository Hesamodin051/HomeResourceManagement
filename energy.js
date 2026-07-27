// energy.js
import { getLoggedInUser } from './modules/auth.js';
import { initDrawer, updateDrawerItems } from './modules/drawer.js';
import { store } from './modules/store.js';

// ===== کلیدهای ذخیره‌سازی =====
function getUserKey(baseKey) {
    const user = getLoggedInUser() || 'default';
    return `${baseKey}_${user}`;
}
function getMeterKey() { return getUserKey('meter_readings'); }
function getSettingsKey() { return getUserKey('energy_settings'); }

// ===== متغیرها =====
let meterReadings = [];
let dailyConsumption = [];
let chartInstance = null;

// ===== تعرفه‌های پلکانی پیش‌فرض =====

// تعرفه آب (مترمکعب → تومان)
function getDefaultWaterTiers() {
    return [
        { limit: 5, price: 150 },
        { limit: 10, price: 600 },
        { limit: 20, price: 1800 },
        { limit: Infinity, price: 3000 }
    ];
}

// تعرفه برق (کیلووات‌ساعت → تومان)
function getDefaultElectricityTiers() {
    return [
        { limit: 100, price: 162 },
        { limit: 200, price: 324 },
        { limit: 400, price: 648 },
        { limit: 800, price: 1296 },
        { limit: Infinity, price: 2592 }
    ];
}

// تعرفه گاز (مترمکعب → تومان)
function getDefaultGasTiers() {
    return [
        { limit: 20, price: 157 },
        { limit: 40, price: 314 },
        { limit: 80, price: 628 },
        { limit: 120, price: 1256 },
        { limit: Infinity, price: 2512 }
    ];
}

const DEFAULT_FIXED_CHARGE = 2000; // هزینه ثابت اشتراک آب (تومان)
const DEFAULT_VAT_RATE = 0.09; // مالیات ۹٪

// ===== تنظیمات =====
let settings = {
    waterThreshold: 500,
    electricityThreshold: 30,
    gasThreshold: 50,
    waterUnit: 'liter',
    waterTiers: getDefaultWaterTiers(),
    electricityTiers: getDefaultElectricityTiers(),
    gasTiers: getDefaultGasTiers(),
    fixedCharge: DEFAULT_FIXED_CHARGE,
    vatRate: DEFAULT_VAT_RATE,
    baseAllowance: 5
};

// ===== محاسبه قبض آب (پلکانی) =====
function calculateWaterBill(monthlyLiters, familySize = 4) {
    const monthlyM3 = monthlyLiters / 1000;
    const firstTierLimit = Math.max(5, settings.baseAllowance + Math.max(0, familySize - 4));
    const tiers = settings.waterTiers.map(t => ({ ...t }));
    tiers[0].limit = firstTierLimit;

    let remaining = monthlyM3, prev = 0, total = 0, details = [];
    for (const tier of tiers) {
        if (remaining <= 0) break;
        const vol = Math.min(remaining, tier.limit - prev);
        if (vol > 0) {
            const cost = vol * tier.price;
            total += cost;
            details.push({ range: `${prev+1} - ${tier.limit===Infinity?'∞':tier.limit}`, volume: Math.round(vol*100)/100, price: tier.price, cost: Math.round(cost) });
            remaining -= vol;
        }
        prev = tier.limit;
    }
    const fixed = settings.fixedCharge || DEFAULT_FIXED_CHARGE;
    total += fixed;
    const vat = total * (settings.vatRate || DEFAULT_VAT_RATE);
    return {
        consumptionM3: Math.round(monthlyM3 * 100) / 100,
        baseCost: Math.round(total - vat - fixed),
        fixedCharge: Math.round(fixed),
        vat: Math.round(vat),
        totalCost: Math.round(total + vat),
        tierDetails: details,
        firstTierLimit: firstTierLimit
    };
}

// ===== محاسبه قبض برق (پلکانی) =====
function calculateElectricityBill(monthlyKwh) {
    const tiers = settings.electricityTiers || getDefaultElectricityTiers();
    let remaining = monthlyKwh, prev = 0, total = 0, details = [];
    for (const tier of tiers) {
        if (remaining <= 0) break;
        const vol = Math.min(remaining, tier.limit - prev);
        if (vol > 0) {
            const cost = vol * tier.price;
            total += cost;
            details.push({ range: `${prev+1} - ${tier.limit===Infinity?'∞':tier.limit}`, volume: Math.round(vol*100)/100, price: tier.price, cost: Math.round(cost) });
            remaining -= vol;
        }
        prev = tier.limit;
    }
    const vat = total * (settings.vatRate || DEFAULT_VAT_RATE);
    return {
        consumptionKwh: Math.round(monthlyKwh * 100) / 100,
        baseCost: Math.round(total),
        vat: Math.round(vat),
        totalCost: Math.round(total + vat),
        tierDetails: details
    };
}

// ===== محاسبه قبض گاز (پلکانی) =====
function calculateGasBill(monthlyM3) {
    const tiers = settings.gasTiers || getDefaultGasTiers();
    let remaining = monthlyM3, prev = 0, total = 0, details = [];
    for (const tier of tiers) {
        if (remaining <= 0) break;
        const vol = Math.min(remaining, tier.limit - prev);
        if (vol > 0) {
            const cost = vol * tier.price;
            total += cost;
            details.push({ range: `${prev+1} - ${tier.limit===Infinity?'∞':tier.limit}`, volume: Math.round(vol*100)/100, price: tier.price, cost: Math.round(cost) });
            remaining -= vol;
        }
        prev = tier.limit;
    }
    const vat = total * (settings.vatRate || DEFAULT_VAT_RATE);
    return {
        consumptionM3: Math.round(monthlyM3 * 100) / 100,
        baseCost: Math.round(total),
        vat: Math.round(vat),
        totalCost: Math.round(total + vat),
        tierDetails: details
    };
}

// ===== بارگذاری تنظیمات =====
function loadSettings() {
    const stored = localStorage.getItem(getSettingsKey());
    if (stored) {
        const saved = JSON.parse(stored);
        settings.waterThreshold = saved.waterThreshold || 500;
        settings.electricityThreshold = saved.electricityThreshold || 30;
        settings.gasThreshold = saved.gasThreshold || 50;
        settings.waterUnit = saved.waterUnit || 'liter';
        settings.waterTiers = saved.waterTiers || getDefaultWaterTiers();
        settings.electricityTiers = saved.electricityTiers || getDefaultElectricityTiers();
        settings.gasTiers = saved.gasTiers || getDefaultGasTiers();
        settings.fixedCharge = saved.fixedCharge || DEFAULT_FIXED_CHARGE;
        settings.vatRate = saved.vatRate || DEFAULT_VAT_RATE;
        settings.baseAllowance = saved.baseAllowance || 5;
    }
    document.getElementById('waterThreshold').value = settings.waterThreshold;
    document.getElementById('electricityThreshold').value = settings.electricityThreshold;
    document.getElementById('gasThreshold').value = settings.gasThreshold;
}

// ===== ذخیره تنظیمات دستی =====
function saveManualSettings() {
    settings.waterThreshold = parseFloat(document.getElementById('waterThreshold').value) || 500;
    settings.electricityThreshold = parseFloat(document.getElementById('electricityThreshold').value) || 30;
    settings.gasThreshold = parseFloat(document.getElementById('gasThreshold').value) || 50;
    // تعرفه‌ها را هم می‌توان در آینده از طریق UI ویرایش کرد، فعلاً از localStorage ذخیره می‌شوند.
    localStorage.setItem(getSettingsKey(), JSON.stringify(settings));
    alert('تنظیمات ذخیره شد.');
    calculateBillPrediction();
}

function enableManualEdit() {
    document.getElementById('saveManualPriceBtn').style.display = 'inline-block';
    document.getElementById('enableManualPriceBtn').style.display = 'none';
}

// ===== بارگذاری داده‌های کنتور =====
function loadMeterData() {
    const stored = localStorage.getItem(getMeterKey());
    meterReadings = stored ? JSON.parse(stored) : [];
    calculateDailyConsumption();
    renderHistory();
    updateChartByPeriod();
    calculateBillPrediction();
}

function saveMeterData() {
    localStorage.setItem(getMeterKey(), JSON.stringify(meterReadings));
}

function calculateDailyConsumption() {
    if (meterReadings.length < 2) { dailyConsumption = []; return; }
    const sorted = [...meterReadings].sort((a, b) => new Date(a.date) - new Date(b.date));
    dailyConsumption = [];
    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i-1], curr = sorted[i];
        const daysDiff = (new Date(curr.date) - new Date(prev.date)) / 86400000;
        if (daysDiff <= 0) continue;
        dailyConsumption.push({
            date: curr.date,
            water: (curr.water - prev.water) / daysDiff,
            electricity: (curr.electricity - prev.electricity) / daysDiff,
            gas: (curr.gas - prev.gas) / daysDiff
        });
    }
}

function validateIncreasing(current, previous, type) {
    if (!previous) return true;
    if (current < previous) {
        alert(`عدد کنتور ${type} نباید از مقدار قبلی (${previous}) کمتر باشد.`);
        return false;
    }
    return true;
}

// ===== تاریخچه =====
function renderHistory() {
    const container = document.getElementById('meterHistoryList');
    if (!container) return;
    if (meterReadings.length === 0) {
        container.innerHTML = '<p>هیچ ثبت کنتوری انجام نشده است.</p>';
        return;
    }
    const sorted = [...meterReadings].sort((a, b) => new Date(b.date) - new Date(a.date));
    container.innerHTML = sorted.map((reading) => `
        <div class="history-item">
            <div><strong>${reading.date}</strong> — 💧 آب: ${reading.water} | ⚡ برق: ${reading.electricity} | 🔥 گاز: ${reading.gas}</div>
            <div class="actions">
                <button class="edit-btn" data-date="${reading.date}">✏️</button>
                <button class="delete-btn" data-date="${reading.date}">🗑️</button>
            </div>
        </div>
    `).join('');
    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => editReading(btn.dataset.date)));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => deleteReading(btn.dataset.date)));
}

function editReading(date) {
    const reading = meterReadings.find(r => r.date === date);
    if (!reading) return;
    document.getElementById('meterDate').value = reading.date;
    document.getElementById('waterMeter').value = reading.water;
    document.getElementById('electricityMeter').value = reading.electricity;
    document.getElementById('gasMeter').value = reading.gas;
    if (confirm('ویرایش؟ رکورد قبلی حذف می‌شود.')) deleteReading(date, true);
}

function deleteReading(date, silent = false) {
    const idx = meterReadings.findIndex(r => r.date === date);
    if (idx === -1) return;
    meterReadings.splice(idx, 1);
    saveMeterData();
    calculateDailyConsumption();
    updateChartByPeriod();
    renderHistory();
    calculateBillPrediction();
    if (!silent) alert('حذف شد.');
    if (document.getElementById('consumptionTableContainer').style.display === 'block') showConsumptionTable();
}

// ===== ذخیره کنتور =====
function saveMeterReading() {
    const date = document.getElementById('meterDate').value;
    const water = parseFloat(document.getElementById('waterMeter').value);
    const elec = parseFloat(document.getElementById('electricityMeter').value);
    const gas = parseFloat(document.getElementById('gasMeter').value);
    if (!date || isNaN(water) || isNaN(elec) || isNaN(gas)) {
        alert('تمامی فیلدها را پر کنید.');
        return;
    }
    const sorted = [...meterReadings].sort((a,b) => new Date(a.date) - new Date(b.date));
    const prev = sorted.findLast(r => new Date(r.date) < new Date(date));
    if (prev) {
        if (!validateIncreasing(water, prev.water, 'آب')) return;
        if (!validateIncreasing(elec, prev.electricity, 'برق')) return;
        if (!validateIncreasing(gas, prev.gas, 'گاز')) return;
    }
    const idx = meterReadings.findIndex(r => r.date === date);
    if (idx !== -1) meterReadings[idx] = { date, water, electricity: elec, gas };
    else meterReadings.push({ date, water, electricity: elec, gas });
    saveMeterData();
    calculateDailyConsumption();
    updateChartByPeriod();
    renderHistory();
    calculateBillPrediction();
    alert('ذخیره شد.');
    document.getElementById('waterMeter').value = '';
    document.getElementById('electricityMeter').value = '';
    document.getElementById('gasMeter').value = '';
    document.getElementById('meterDate').value = new Date().toISOString().slice(0,10);
    if (document.getElementById('consumptionTableContainer').style.display === 'block') showConsumptionTable();
}

function resetAllData() {
    if (confirm('همه داده‌ها پاک شوند؟')) {
        meterReadings = [];
        saveMeterData();
        calculateDailyConsumption();
        updateChartByPeriod();
        renderHistory();
        calculateBillPrediction();
        document.getElementById('consumptionTableContainer').style.display = 'none';
        alert('پاک شد.');
    }
}

// ===== نمودار =====
function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getChartDataByPeriod(period) {
    if (dailyConsumption.length === 0) return { labels: [], water: [], electricity: [], gas: [] };
    if (period === 'daily') {
        return {
            labels: dailyConsumption.map(d => d.date),
            water: dailyConsumption.map(d => d.water),
            electricity: dailyConsumption.map(d => d.electricity),
            gas: dailyConsumption.map(d => d.gas)
        };
    } else if (period === 'weekly') {
        const map = new Map();
        dailyConsumption.forEach(d => {
            const w = getWeekNumber(new Date(d.date));
            const key = `${new Date(d.date).getFullYear()}-${w}`;
            if (!map.has(key)) map.set(key, { water: 0, elec: 0, gas: 0 });
            const v = map.get(key);
            v.water += d.water;
            v.elec += d.electricity;
            v.gas += d.gas;
        });
        const sorted = Array.from(map.keys()).sort();
        return {
            labels: sorted.map(k => `هفته ${k.split('-')[1]} (${k.split('-')[0]})`),
            water: sorted.map(k => map.get(k).water),
            electricity: sorted.map(k => map.get(k).elec),
            gas: sorted.map(k => map.get(k).gas)
        };
    } else {
        const map = new Map();
        dailyConsumption.forEach(d => {
            const m = new Date(d.date).getMonth() + 1;
            const y = new Date(d.date).getFullYear();
            const key = `${y}-${m}`;
            if (!map.has(key)) map.set(key, { water: 0, elec: 0, gas: 0, cnt: 0 });
            const v = map.get(key);
            v.water += d.water;
            v.elec += d.electricity;
            v.gas += d.gas;
            v.cnt++;
        });
        const sorted = Array.from(map.keys()).sort();
        return {
            labels: sorted.map(k => k.replace('-', '/')),
            water: sorted.map(k => map.get(k).water / map.get(k).cnt),
            electricity: sorted.map(k => map.get(k).elec / map.get(k).cnt),
            gas: sorted.map(k => map.get(k).gas / map.get(k).cnt)
        };
    }
}

function renderChartByPeriod(period, chartType) {
    const ctx = document.getElementById('energyChart');
    if (!ctx) return;
    if (chartInstance) chartInstance.destroy();
    const data = getChartDataByPeriod(period);
    if (data.labels.length === 0) {
        const empty = ctx.getContext('2d');
        empty.clearRect(0, 0, ctx.width, ctx.height);
        empty.fillStyle = '#aaa';
        empty.font = '14px Vazirmatn';
        empty.fillText('داده کافی برای نمایش نمودار وجود ندارد', 20, 100);
        return;
    }
    chartInstance = new Chart(ctx, {
        type: chartType,
        data: {
            labels: data.labels,
            datasets: [
                { label: 'آب (لیتر/روز)', data: data.water, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.3)', fill: chartType === 'line', tension: 0.3 },
                { label: 'برق (کیلووات/روز)', data: data.electricity, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.3)', fill: chartType === 'line', tension: 0.3 },
                { label: 'گاز (مترمکعب/روز)', data: data.gas, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.3)', fill: chartType === 'line', tension: 0.3 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } }
    });
}

function updateChartByPeriod() {
    renderChartByPeriod(document.getElementById('periodSelect').value, document.getElementById('chartTypeSelect').value);
}

// ===== پیش‌بینی قبض (پلکانی برای هر سه) =====
function calculateBillPrediction() {
    const display = document.getElementById('billPredictionDisplay');
    if (!display) return;
    if (dailyConsumption.length === 0) {
        display.innerHTML = 'داده کافی برای پیش‌بینی وجود ندارد.';
        return;
    }
    const period = document.getElementById('predictionPeriod').value;
    const avgWater = dailyConsumption.reduce((s, d) => s + d.water, 0) / dailyConsumption.length;
    const avgElec = dailyConsumption.reduce((s, d) => s + d.electricity, 0) / dailyConsumption.length;
    const avgGas = dailyConsumption.reduce((s, d) => s + d.gas, 0) / dailyConsumption.length;
    let days = 1, name = '';
    switch (period) {
        case 'daily': days = 1; name = 'روزانه'; break;
        case 'weekly': days = 7; name = 'هفتگی'; break;
        case 'monthly': days = 30; name = 'ماهانه'; break;
        default: days = 30; name = 'ماهانه';
    }
    const familySize = store.currentUserProfile?.familySize || 4;
    const waterBill = calculateWaterBill(avgWater * days, familySize);
    const elecBill = calculateElectricityBill(avgElec * days);
    const gasBill = calculateGasBill(avgGas * days);
    const total = waterBill.totalCost + elecBill.totalCost + gasBill.totalCost;

    display.innerHTML = `
        <div class="space-y-2">
            <div class="font-bold text-primary">📊 پیش‌بینی قبض ${name}</div>
            <div class="grid grid-cols-3 gap-2 text-sm">
                <div class="bg-blue-50 p-2 rounded text-center">💧 آب<br><span class="font-bold">${waterBill.totalCost.toLocaleString()}</span> تومان</div>
                <div class="bg-yellow-50 p-2 rounded text-center">⚡ برق<br><span class="font-bold">${elecBill.totalCost.toLocaleString()}</span> تومان</div>
                <div class="bg-green-50 p-2 rounded text-center">🔥 گاز<br><span class="font-bold">${gasBill.totalCost.toLocaleString()}</span> تومان</div>
            </div>
            <div class="bg-purple-50 p-2 rounded text-center font-bold text-primary">💰 جمع کل: ${Math.round(total).toLocaleString()} تومان</div>
            <div class="text-xs text-gray-500">
                <details>
                    <summary class="cursor-pointer">🔍 جزئیات</summary>
                    <div class="mt-1">
                        <div class="font-bold">آب (${waterBill.consumptionM3} m³):</div>
                        ${waterBill.tierDetails.map(t => `<div>پله ${t.range}: ${t.volume} m³ × ${t.price} = ${t.cost.toLocaleString()} تومان</div>`).join('')}
                        <div>هزینه ثابت: ${waterBill.fixedCharge.toLocaleString()} | مالیات: ${waterBill.vat.toLocaleString()}</div>
                        <div class="font-bold mt-1">برق (${elecBill.consumptionKwh} kWh):</div>
                        ${elecBill.tierDetails.map(t => `<div>پله ${t.range}: ${t.volume} kWh × ${t.price} = ${t.cost.toLocaleString()} تومان</div>`).join('')}
                        <div>مالیات: ${elecBill.vat.toLocaleString()}</div>
                        <div class="font-bold mt-1">گاز (${gasBill.consumptionM3} m³):</div>
                        ${gasBill.tierDetails.map(t => `<div>پله ${t.range}: ${t.volume} m³ × ${t.price} = ${t.cost.toLocaleString()} تومان</div>`).join('')}
                        <div>مالیات: ${gasBill.vat.toLocaleString()}</div>
                    </div>
                </details>
            </div>
        </div>
    `;
}

// ===== جدول مصرف =====
function showConsumptionTable() {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    if (!start || !end) { alert('تاریخ را انتخاب کنید.'); return; }
    const filtered = dailyConsumption.filter(d => d.date >= start && d.date <= end);
    const tbody = document.getElementById('consumptionTableBody');
    if (!tbody) return;
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">داده‌ای یافت نشد.</td></tr>';
        document.getElementById('averageDisplay').innerHTML = '';
        document.getElementById('consumptionTableContainer').style.display = 'block';
        return;
    }
    let tw=0, te=0, tg=0;
    const rows = filtered.map(day => {
        // برای جدول از قیمت‌های ساده (میانگین) استفاده می‌کنیم تا محاسبه سریع باشد
        const cost = day.water * (settings.waterTiers[0]?.price / 1000 || 0.15) + day.electricity * (settings.electricityTiers[0]?.price || 162) + day.gas * (settings.gasTiers[0]?.price || 157);
        let alertMsg = '';
        if (day.water > settings.waterThreshold) alertMsg += '⚠️ آب ';
        if (day.electricity > settings.electricityThreshold) alertMsg += '⚠️ برق ';
        if (day.gas > settings.gasThreshold) alertMsg += '⚠️ گاز ';
        if (!alertMsg) alertMsg = '✓';
        tw += day.water; te += day.electricity; tg += day.gas;
        return `<tr><td>${day.date}</td><td>${day.water.toFixed(2)} L</td><td>${day.electricity.toFixed(2)} kW</td><td>${day.gas.toFixed(2)} m³</td><td>${Math.round(cost).toLocaleString()}</td><td>${alertMsg}</td></tr>`;
    }).join('');
    tbody.innerHTML = rows;
    document.getElementById('averageDisplay').innerHTML = `میانگین روزانه: آب ${(tw/filtered.length).toFixed(2)} L | برق ${(te/filtered.length).toFixed(2)} kW | گاز ${(tg/filtered.length).toFixed(2)} m³`;
    document.getElementById('consumptionTableContainer').style.display = 'block';
}

function exportToCSV() {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    if (!start || !end) { alert('بازه را انتخاب کنید.'); return; }
    const filtered = dailyConsumption.filter(d => d.date >= start && d.date <= end);
    if (filtered.length === 0) { alert('داده‌ای وجود ندارد.'); return; }
    let csv = [["تاریخ","آب (L)","برق (kW)","گاز (m³)"]];
    filtered.forEach(d => csv.push([d.date, d.water.toFixed(2), d.electricity.toFixed(2), d.gas.toFixed(2)]));
    const blob = new Blob(["\uFEFF" + csv.map(r => r.join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'consumption.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ===== رویدادها =====
function bindEvents() {
    document.getElementById('saveMeterBtn')?.addEventListener('click', saveMeterReading);
    document.getElementById('resetAllDataBtn')?.addEventListener('click', resetAllData);
    document.getElementById('periodSelect')?.addEventListener('change', updateChartByPeriod);
    document.getElementById('chartTypeSelect')?.addEventListener('change', updateChartByPeriod);
    document.getElementById('showTableBtn')?.addEventListener('click', showConsumptionTable);
    document.getElementById('exportCSVBtn')?.addEventListener('click', exportToCSV);
    document.getElementById('predictionPeriod')?.addEventListener('change', calculateBillPrediction);
    document.getElementById('enableManualPriceBtn')?.addEventListener('click', enableManualEdit);
    document.getElementById('saveManualPriceBtn')?.addEventListener('click', saveManualSettings);
    ['waterThreshold','electricityThreshold','gasThreshold'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => {
            settings[id] = parseFloat(document.getElementById(id).value) || 0;
            localStorage.setItem(getSettingsKey(), JSON.stringify(settings));
        });
    });
}

function setDefaultRangeDates() {
    const today = new Date();
    document.getElementById('startDate').value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0,10);
    document.getElementById('endDate').value = today.toISOString().slice(0,10);
}

// ===== راه‌اندازی =====
function init() {
    if (!getLoggedInUser()) { window.location.href = 'index.html'; return; }
    initDrawer();
    updateDrawerItems();
    loadSettings();
    loadMeterData();
    bindEvents();
    setDefaultRangeDates();
    if (!document.getElementById('meterDate').value) {
        document.getElementById('meterDate').value = new Date().toISOString().slice(0,10);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
