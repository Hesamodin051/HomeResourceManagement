// energy.js
import { getLoggedInUser } from './modules/auth.js';
import { initDrawer, updateDrawerItems } from './modules/drawer.js';
import { store } from './modules/store.js'; // برای دسترسی به تعداد اعضای خانواده

// ===== کلیدهای ذخیره‌سازی وابسته به کاربر =====
function getUserKey(baseKey) {
    const user = getLoggedInUser() || 'default';
    return `${baseKey}_${user}`;
}

function getMeterKey() { return getUserKey('meter_readings'); }
function getSettingsKey() { return getUserKey('energy_settings'); }

// ===== متغیرها و تنظیمات =====
let meterReadings = [];
let dailyConsumption = [];
let chartInstance = null;

const DEFAULT_WATER_PRICE_PER_LITER = 0.2; // دیگر استفاده نمی‌شود، اما برای سازگاری نگه می‌داریم
const DEFAULT_ELECTRICITY_PRICE = 162; // قیمت هر کیلووات برق (تومان)
const DEFAULT_GAS_PRICE = 157; // قیمت هر مترمکعب گاز (تومان)

// ===== تعرفه‌های پلکانی آب به سبک ایران =====
// این تعرفه‌ها بر اساس ابلاغیه‌های شرکت آب و فاضلاب (سال ۱۴۰۳) تنظیم شده است.
// قیمت‌ها به تومان به ازای هر متر مکعب می‌باشد.
function getDefaultWaterTiers() {
    return [
        { limit: 5, price: 150 },    // پله اول: تا ۵ مترمکعب (با احتساب افزایش جمعیت)
        { limit: 10, price: 600 },   // پله دوم: ۵ تا ۱۰ مترمکعب
        { limit: 20, price: 1800 },  // پله سوم: ۱۰ تا ۲۰ مترمکعب
        { limit: Infinity, price: 3000 } // پله چهارم: بیش از ۲۰ مترمکعب
    ];
}

const DEFAULT_FIXED_CHARGE = 2000; // هزینه ثابت اشتراک آب به تومان
const DEFAULT_VAT_RATE = 0.09; // مالیات بر ارزش افزوده ۹ درصد

let settings = {
    waterThreshold: 500,
    electricityThreshold: 30,
    gasThreshold: 50,
    waterPrice: DEFAULT_WATER_PRICE_PER_LITER,
    electricityPrice: DEFAULT_ELECTRICITY_PRICE,
    gasPrice: DEFAULT_GAS_PRICE,
    waterUnit: 'liter',
    waterTiers: getDefaultWaterTiers(),
    fixedCharge: DEFAULT_FIXED_CHARGE,
    vatRate: DEFAULT_VAT_RATE,
    baseAllowance: 5 // مترمکعب پایه برای خانواده ۴ نفره
};

// ===== محاسبه قبض آب با تعرفه‌های پلکانی ایران =====
function calculateWaterBill(monthlyLiters, familySize = 4) {
    // تبدیل لیتر به متر مکعب
    const monthlyM3 = monthlyLiters / 1000;
    
    // محاسبه سقف پله اول بر اساس تعداد اعضا
    // هر نفر اضافه بر ۴ نفر، ۱ مترمکعب به پله اول اضافه می‌شود
    let firstTierLimit = settings.baseAllowance + Math.max(0, (familySize - 4));
    // حداقل پله اول ۵ مترمکعب
    if (firstTierLimit < 5) firstTierLimit = 5;
    
    // ساخت پله‌ها با توجه به سقف پله اول
    const tiers = settings.waterTiers.map(t => ({ ...t }));
    // تنظیم پله اول بر اساس جمعیت
    if (tiers.length > 0) {
        tiers[0].limit = firstTierLimit;
    }
    
    let remaining = monthlyM3;
    let previousLimit = 0;
    let totalCost = 0;
    let tierDetails = [];
    
    for (const tier of tiers) {
        if (remaining <= 0) break;
        const volumeInTier = Math.min(remaining, tier.limit - previousLimit);
        if (volumeInTier > 0) {
            const cost = volumeInTier * tier.price;
            totalCost += cost;
            tierDetails.push({
                range: `${previousLimit + 1} - ${tier.limit === Infinity ? '∞' : tier.limit}`,
                volume: Math.round(volumeInTier * 100) / 100,
                price: tier.price,
                cost: Math.round(cost)
            });
            remaining -= volumeInTier;
        }
        previousLimit = tier.limit;
    }
    
    // اضافه کردن هزینه ثابت اشتراک
    const fixedCharge = settings.fixedCharge || DEFAULT_FIXED_CHARGE;
    totalCost += fixedCharge;
    
    // مالیات بر ارزش افزوده
    const vat = totalCost * (settings.vatRate || DEFAULT_VAT_RATE);
    const finalCost = totalCost + vat;
    
    return {
        consumptionM3: Math.round(monthlyM3 * 100) / 100,
        baseCost: Math.round(totalCost - vat - fixedCharge), // هزینه مصرف قبل از مالیات و ثابت
        fixedCharge: Math.round(fixedCharge),
        vat: Math.round(vat),
        totalCost: Math.round(finalCost),
        tierDetails: tierDetails,
        tiers: tiers,
        firstTierLimit: firstTierLimit
    };
}

// ===== بارگذاری تنظیمات =====
function loadSettings() {
    const stored = localStorage.getItem(getSettingsKey());
    if (stored) {
        const saved = JSON.parse(stored);
        // قیمت‌های ساده
        settings.waterPrice = (saved.waterPrice && saved.waterPrice !== 0) ? saved.waterPrice : DEFAULT_WATER_PRICE_PER_LITER;
        settings.electricityPrice = (saved.electricityPrice && saved.electricityPrice !== 0) ? saved.electricityPrice : DEFAULT_ELECTRICITY_PRICE;
        settings.gasPrice = (saved.gasPrice && saved.gasPrice !== 0) ? saved.gasPrice : DEFAULT_GAS_PRICE;
        // آستانه‌ها
        settings.waterThreshold = saved.waterThreshold || 500;
        settings.electricityThreshold = saved.electricityThreshold || 30;
        settings.gasThreshold = saved.gasThreshold || 50;
        settings.waterUnit = saved.waterUnit || 'liter';
        // تعرفه‌های آب
        if (saved.waterTiers && Array.isArray(saved.waterTiers) && saved.waterTiers.length > 0) {
            settings.waterTiers = saved.waterTiers;
        } else {
            settings.waterTiers = getDefaultWaterTiers();
        }
        settings.fixedCharge = saved.fixedCharge || DEFAULT_FIXED_CHARGE;
        settings.vatRate = saved.vatRate || DEFAULT_VAT_RATE;
        settings.baseAllowance = saved.baseAllowance || 5;
    } else {
        // مقادیر پیش‌فرض
        settings.waterTiers = getDefaultWaterTiers();
        settings.fixedCharge = DEFAULT_FIXED_CHARGE;
        settings.vatRate = DEFAULT_VAT_RATE;
        settings.baseAllowance = 5;
    }
    // اعمال به المان‌ها
    document.getElementById('waterThreshold').value = settings.waterThreshold;
    document.getElementById('electricityThreshold').value = settings.electricityThreshold;
    document.getElementById('gasThreshold').value = settings.gasThreshold;
    document.getElementById('waterPrice').value = settings.waterPrice;
    document.getElementById('electricityPrice').value = settings.electricityPrice;
    document.getElementById('gasPrice').value = settings.gasPrice;
    document.getElementById('waterUnit').value = settings.waterUnit;
}

function saveManualSettings() {
    // قیمت‌های ساده
    let waterPrice = parseFloat(document.getElementById('waterPrice').value);
    let electricityPrice = parseFloat(document.getElementById('electricityPrice').value);
    let gasPrice = parseFloat(document.getElementById('gasPrice').value);
    if (isNaN(waterPrice) || waterPrice === 0) waterPrice = DEFAULT_WATER_PRICE_PER_LITER;
    if (isNaN(electricityPrice) || electricityPrice === 0) electricityPrice = DEFAULT_ELECTRICITY_PRICE;
    if (isNaN(gasPrice) || gasPrice === 0) gasPrice = DEFAULT_GAS_PRICE;
    
    settings.waterThreshold = parseFloat(document.getElementById('waterThreshold').value) || 500;
    settings.electricityThreshold = parseFloat(document.getElementById('electricityThreshold').value) || 30;
    settings.gasThreshold = parseFloat(document.getElementById('gasThreshold').value) || 50;
    settings.waterPrice = waterPrice;
    settings.electricityPrice = electricityPrice;
    settings.gasPrice = gasPrice;
    settings.waterUnit = document.getElementById('waterUnit').value;
    
    // تعرفه‌های آب را از localStorage ذخیره می‌کنیم (فعلاً همان‌ها را نگه می‌داریم)
    // در این نسخه کاربر نمی‌تواند از طریق UI پله‌ها را ویرایش کند، اما در آینده قابل توسعه است.
    
    localStorage.setItem(getSettingsKey(), JSON.stringify(settings));
    document.getElementById('waterPrice').disabled = true;
    document.getElementById('electricityPrice').disabled = true;
    document.getElementById('gasPrice').disabled = true;
    document.getElementById('waterUnit').disabled = true;
    document.getElementById('saveManualPriceBtn').style.display = 'none';
    document.getElementById('enableManualPriceBtn').style.display = 'inline-block';
    alert('تنظیمات تعرفه ذخیره شد.');
    calculateBillPrediction();
}

function enableManualEdit() {
    document.getElementById('waterPrice').disabled = false;
    document.getElementById('electricityPrice').disabled = false;
    document.getElementById('gasPrice').disabled = false;
    document.getElementById('waterUnit').disabled = false;
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
    if (meterReadings.length < 2) {
        dailyConsumption = [];
        return;
    }
    const sorted = [...meterReadings].sort((a, b) => new Date(a.date) - new Date(b.date));
    dailyConsumption = [];
    for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
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

// ===== رندر تاریخچه =====
function renderHistory() {
    const container = document.getElementById('meterHistoryList');
    if (!container) return;
    if (meterReadings.length === 0) {
        container.innerHTML = '<p>هیچ ثبت کنتوری انجام نشده است.</p>';
        return;
    }
    const sorted = [...meterReadings].sort((a, b) => new Date(b.date) - new Date(a.date));
    container.innerHTML = sorted.map((reading, idx) => {
        const originalIndex = meterReadings.findIndex(r => r.date === reading.date);
        return `<div class="history-item" data-idx="${originalIndex}">
            <div><strong>${reading.date}</strong> — 💧 آب: ${reading.water} | ⚡ برق: ${reading.electricity} | 🔥 گاز: ${reading.gas}</div>
            <div class="actions"><button class="edit-btn" data-date="${reading.date}">✏️</button><button class="delete-btn" data-date="${reading.date}">🗑️</button></div>
        </div>`;
    }).join('');
    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => editReading(btn.getAttribute('data-date'))));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => deleteReading(btn.getAttribute('data-date'))));
}

function editReading(date) {
    const reading = meterReadings.find(r => r.date === date);
    if (!reading) return;
    document.getElementById('meterDate').value = reading.date;
    document.getElementById('waterMeter').value = reading.water;
    document.getElementById('electricityMeter').value = reading.electricity;
    document.getElementById('gasMeter').value = reading.gas;
    if (confirm('آیا می‌خواهید این رکورد را ویرایش کنید؟ رکورد قبلی حذف می‌شود.')) {
        deleteReading(date, true);
    }
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
    if (!silent) alert('رکورد حذف شد.');
    if (document.getElementById('consumptionTableContainer').style.display === 'block') showConsumptionTable();
}

// ===== ذخیره کنتور =====
function saveMeterReading() {
    try {
        const date = document.getElementById('meterDate').value;
        const water = parseFloat(document.getElementById('waterMeter').value);
        const elec = parseFloat(document.getElementById('electricityMeter').value);
        const gas = parseFloat(document.getElementById('gasMeter').value);
        
        if (!date) {
            alert('تاریخ را انتخاب کنید.');
            return;
        }
        if (isNaN(water) || isNaN(elec) || isNaN(gas)) {
            alert('لطفاً هر سه عدد کنتور را وارد کنید.');
            return;
        }
        
        const sorted = [...meterReadings].sort((a, b) => new Date(a.date) - new Date(b.date));
        const prev = sorted.findLast(r => new Date(r.date) < new Date(date));
        if (prev) {
            if (!validateIncreasing(water, prev.water, 'آب')) return;
            if (!validateIncreasing(elec, prev.electricity, 'برق')) return;
            if (!validateIncreasing(gas, prev.gas, 'گاز')) return;
        }
        
        const existingIndex = meterReadings.findIndex(r => r.date === date);
        if (existingIndex !== -1) {
            meterReadings[existingIndex] = { date, water, electricity: elec, gas };
        } else {
            meterReadings.push({ date, water, electricity: elec, gas });
        }
        saveMeterData();
        calculateDailyConsumption();
        updateChartByPeriod();
        renderHistory();
        calculateBillPrediction();
        alert('اطلاعات کنتور ذخیره شد.');
        
        document.getElementById('waterMeter').value = '';
        document.getElementById('electricityMeter').value = '';
        document.getElementById('gasMeter').value = '';
        document.getElementById('meterDate').value = new Date().toISOString().slice(0, 10);
        if (document.getElementById('consumptionTableContainer').style.display === 'block') showConsumptionTable();
    } catch (error) {
        console.error('خطا در saveMeterReading:', error);
        alert('خطایی رخ داد: ' + error.message);
    }
}

function resetAllData() {
    if (confirm('آیا مطمئن هستید؟ تمام داده‌های کنتورها پاک می‌شوند.')) {
        meterReadings = [];
        saveMeterData();
        calculateDailyConsumption();
        updateChartByPeriod();
        renderHistory();
        calculateBillPrediction();
        document.getElementById('consumptionTableContainer').style.display = 'none';
        alert('همه داده‌ها پاک شدند.');
    }
}

// ===== نمودار =====
function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
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
        empty.fillText('داده کافی برای نمایش نمودار وجود ندارد (حداقل دو روز ثبت کنتور لازم است)', 20, 100);
        return;
    }
    chartInstance = new Chart(ctx, {
        type: chartType,
        data: {
            labels: data.labels,
            datasets: [
                { label: 'آب (لیتر/روز)', data: data.water, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.3)', fill: chartType === 'line' ? true : false, tension: 0.3 },
                { label: 'برق (کیلووات/روز)', data: data.electricity, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.3)', fill: chartType === 'line' ? true : false, tension: 0.3 },
                { label: 'گاز (مترمکعب/روز)', data: data.gas, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.3)', fill: chartType === 'line' ? true : false, tension: 0.3 }
            ]
        },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } }
    });
}

function updateChartByPeriod() {
    const period = document.getElementById('periodSelect').value;
    const chartType = document.getElementById('chartTypeSelect').value;
    renderChartByPeriod(period, chartType);
}

// ===== پیش‌بینی قبض (با محاسبه دقیق آب) =====
function calculateBillPrediction() {
    const display = document.getElementById('billPredictionDisplay');
    if (!display) return;
    if (dailyConsumption.length === 0) {
        display.innerHTML = 'داده کافی برای پیش‌بینی وجود ندارد. حداقل دو روز ثبت کنتور لازم است.';
        return;
    }
    const predictionPeriod = document.getElementById('predictionPeriod').value;
    const avgWater = dailyConsumption.reduce((s, d) => s + d.water, 0) / dailyConsumption.length;
    const avgElec = dailyConsumption.reduce((s, d) => s + d.electricity, 0) / dailyConsumption.length;
    const avgGas = dailyConsumption.reduce((s, d) => s + d.gas, 0) / dailyConsumption.length;
    
    let daysMultiplier = 1;
    let periodName = '';
    switch (predictionPeriod) {
        case 'daily': daysMultiplier = 1; periodName = 'روزانه'; break;
        case 'weekly': daysMultiplier = 7; periodName = 'هفتگی'; break;
        case 'monthly': daysMultiplier = 30; periodName = 'ماهانه'; break;
        default: daysMultiplier = 30; periodName = 'ماهانه';
    }
    
    // محاسبه آب با تعرفه پلکانی
    const familySize = store.currentUserProfile?.familySize || 4;
    const monthlyWaterLiters = avgWater * daysMultiplier;
    const waterBill = calculateWaterBill(monthlyWaterLiters, familySize);
    
    // محاسبه برق و گاز با قیمت ساده (برای برق و گاز هم می‌توان تعرفه پلکانی پیاده‌سازی کرد، اما فعلاً ساده)
    const elecCost = avgElec * daysMultiplier * settings.electricityPrice;
    const gasCost = avgGas * daysMultiplier * settings.gasPrice;
    
    // هزینه کل
    const totalCost = waterBill.totalCost + elecCost + gasCost;
    
    // ساخت نمایش
    let html = `
        <div class="space-y-2">
            <div class="font-bold text-primary">📊 پیش‌بینی قبض ${periodName}</div>
            <div class="grid grid-cols-2 gap-2 text-sm">
                <div class="bg-blue-50 p-2 rounded">
                    💧 آب: <span class="font-bold">${waterBill.totalCost.toLocaleString()}</span> تومان
                </div>
                <div class="bg-yellow-50 p-2 rounded">
                    ⚡ برق: <span class="font-bold">${Math.round(elecCost).toLocaleString()}</span> تومان
                </div>
                <div class="bg-green-50 p-2 rounded">
                    🔥 گاز: <span class="font-bold">${Math.round(gasCost).toLocaleString()}</span> تومان
                </div>
                <div class="bg-purple-50 p-2 rounded font-bold">
                    💰 جمع: <span class="font-bold text-primary">${Math.round(totalCost).toLocaleString()}</span> تومان
                </div>
            </div>
            <div class="text-xs text-gray-500 mt-2">
                <details>
                    <summary class="cursor-pointer">🔍 جزئیات قبض آب (${waterBill.consumptionM3} مترمکعب)</summary>
                    <div class="mt-1 space-y-1">
                        ${waterBill.tierDetails.map(t => 
                            `<div>پله ${t.range}: ${t.volume} m³ × ${t.price} = ${t.cost.toLocaleString()} تومان</div>`
                        ).join('')}
                        <div>هزینه ثابت اشتراک: ${waterBill.fixedCharge.toLocaleString()} تومان</div>
                        <div>مالیات (۹٪): ${waterBill.vat.toLocaleString()} تومان</div>
                        <div class="font-bold">جمع آب: ${waterBill.totalCost.toLocaleString()} تومان</div>
                        <div class="text-gray-400 text-[10px]">پله اول بر اساس ${familySize} نفر: ${waterBill.firstTierLimit} مترمکعب</div>
                    </div>
                </details>
            </div>
            <div class="text-[10px] text-gray-400 mt-1">* تخمین بر اساس تعرفه‌های روز (قابل تنظیم دستی)</div>
        </div>
    `;
    
    display.innerHTML = html;
}

// ===== جدول مصرف =====
function showConsumptionTable() {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    if (!start || !end) {
        alert('تاریخ شروع و پایان را انتخاب کنید.');
        return;
    }
    if (new Date(start) > new Date(end)) {
        alert('تاریخ شروع باید قبل از پایان باشد.');
        return;
    }
    const filtered = dailyConsumption.filter(d => d.date >= start && d.date <= end);
    const tbody = document.getElementById('consumptionTableBody');
    if (!tbody) return;
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6">هیچ داده‌ای یافت نشد.</td></tr>';
        document.getElementById('averageDisplay').innerHTML = '';
        document.getElementById('consumptionTableContainer').style.display = 'block';
        return;
    }
    let totalW = 0, totalE = 0, totalG = 0;
    // برای نمایش هزینه‌ها در جدول از قیمت‌های ساده استفاده می‌کنیم
    const rows = filtered.map(day => {
        const waterCost = day.water * (settings.waterPrice / 1000);
        const elecCost = day.electricity * settings.electricityPrice;
        const gasCost = day.gas * settings.gasPrice;
        const total = waterCost + elecCost + gasCost;
        let alertMsg = '';
        if (day.water > settings.waterThreshold && settings.waterThreshold > 0) alertMsg += '⚠️ آب ';
        if (day.electricity > settings.electricityThreshold && settings.electricityThreshold > 0) alertMsg += '⚠️ برق ';
        if (day.gas > settings.gasThreshold && settings.gasThreshold > 0) alertMsg += '⚠️ گاز ';
        if (alertMsg === '') alertMsg = '✓';
        totalW += day.water;
        totalE += day.electricity;
        totalG += day.gas;
        return `<tr><td>${day.date}</td><td>${day.water.toFixed(2)} لیتر</td><td>${day.electricity.toFixed(2)} کیلووات</td><td>${day.gas.toFixed(2)} مترمکعب</td><td>${Math.round(total).toLocaleString()} تومان</td><td>${alertMsg}</td></tr>`;
    }).join('');
    tbody.innerHTML = rows;
    const avgW = totalW / filtered.length;
    const avgE = totalE / filtered.length;
    const avgG = totalG / filtered.length;
    document.getElementById('averageDisplay').innerHTML = `میانگین مصرف روزانه در این بازه: آب: ${avgW.toFixed(2)} لیتر | برق: ${avgE.toFixed(2)} کیلووات | گاز: ${avgG.toFixed(2)} مترمکعب`;
    document.getElementById('consumptionTableContainer').style.display = 'block';
}

function exportToCSV() {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    if (!start || !end) {
        alert('ابتدا بازه را انتخاب کنید.');
        return;
    }
    const filtered = dailyConsumption.filter(d => d.date >= start && d.date <= end);
    if (filtered.length === 0) {
        alert('هیچ داده‌ای در بازه وجود ندارد.');
        return;
    }
    let csv = [["تاریخ", "آب (لیتر/روز)", "برق (کیلووات/روز)", "گاز (مترمکعب/روز)", "هزینه (تومان)"]];
    filtered.forEach(day => {
        const waterCost = day.water * (settings.waterPrice / 1000);
        const elecCost = day.electricity * settings.electricityPrice;
        const gasCost = day.gas * settings.gasPrice;
        const total = waterCost + elecCost + gasCost;
        csv.push([day.date, day.water.toFixed(2), day.electricity.toFixed(2), day.gas.toFixed(2), Math.round(total).toFixed(0)]);
    });
    const blob = new Blob(["\uFEFF" + csv.map(r => r.join(",")).join("\n")], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'consumption_data.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ===== اتصال رویدادها =====
function bindEvents() {
    const saveBtn = document.getElementById('saveMeterBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveMeterReading);
    const resetBtn = document.getElementById('resetAllDataBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetAllData);
    const periodSelect = document.getElementById('periodSelect');
    if (periodSelect) periodSelect.addEventListener('change', updateChartByPeriod);
    const chartTypeSelect = document.getElementById('chartTypeSelect');
    if (chartTypeSelect) chartTypeSelect.addEventListener('change', updateChartByPeriod);
    const showTableBtn = document.getElementById('showTableBtn');
    if (showTableBtn) showTableBtn.addEventListener('click', showConsumptionTable);
    const exportBtn = document.getElementById('exportCSVBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportToCSV);
    const predPeriod = document.getElementById('predictionPeriod');
    if (predPeriod) predPeriod.addEventListener('change', calculateBillPrediction);
    const enableBtn = document.getElementById('enableManualPriceBtn');
    if (enableBtn) enableBtn.addEventListener('click', enableManualEdit);
    const saveManualBtn = document.getElementById('saveManualPriceBtn');
    if (saveManualBtn) saveManualBtn.addEventListener('click', saveManualSettings);
    
    const thresholdInputs = ['waterThreshold', 'electricityThreshold', 'gasThreshold'];
    thresholdInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => {
            settings[id] = parseFloat(el.value) || 0;
            localStorage.setItem(getSettingsKey(), JSON.stringify(settings));
        });
    });
}

function setDefaultRangeDates() {
    const start = document.getElementById('startDate');
    const end = document.getElementById('endDate');
    if (start && !start.value) {
        const today = new Date();
        start.value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
    }
    if (end && !end.value) {
        end.value = new Date().toISOString().slice(0, 10);
    }
}

// ===== راه‌اندازی =====
function init() {
    if (!getLoggedInUser()) {
        window.location.href = 'index.html';
        return;
    }
    initDrawer();
    updateDrawerItems();
    loadSettings();
    loadMeterData();
    bindEvents();
    setDefaultRangeDates();
    if (!document.getElementById('meterDate').value) {
        document.getElementById('meterDate').value = new Date().toISOString().slice(0, 10);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
