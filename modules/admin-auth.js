// modules/admin-auth.js
// احراز هویت سازمان‌ها برای پنل مدیریت

const ORGANIZATIONS_KEY = 'admin_organizations';
const ADMIN_SESSION_KEY = 'admin_session';

// ============================================================
// بارگذاری اطلاعات سازمان‌ها
// ============================================================
async function loadOrganizations() {
    try {
        const response = await fetch('assets/data/organizations.json');
        if (!response.ok) throw new Error('فایل سازمان‌ها پیدا نشد');
        const data = await response.json();
        // ذخیره در localStorage برای دسترسی سریع
        localStorage.setItem(ORGANIZATIONS_KEY, JSON.stringify(data));
        return data;
    } catch (error) {
        console.error('❌ خطا در بارگذاری سازمان‌ها:', error);
        // استفاده از داده‌های پیش‌فرض اگر فایل موجود نباشد
        const defaultData = getDefaultOrganizations();
        localStorage.setItem(ORGANIZATIONS_KEY, JSON.stringify(defaultData));
        return defaultData;
    }
}

// ============================================================
// داده‌های پیش‌فرض سازمان‌ها (در صورت عدم وجود فایل)
// ============================================================
function getDefaultOrganizations() {
    return {
        organizations: [
            {
                id: 'org_water',
                name: 'آب و فاضلاب',
                code: 'WATER2024',
                password: 'water@admin',
                role: 'water_company',
                permissions: ['view_water', 'view_users', 'view_reports']
            },
            {
                id: 'org_electricity',
                name: 'شرکت برق',
                code: 'ELEC2024',
                password: 'elec@admin',
                role: 'electricity_company',
                permissions: ['view_electricity', 'view_users', 'view_reports']
            },
            {
                id: 'org_chamber',
                name: 'اتاق بازرگانی',
                code: 'CHAMBER2024',
                password: 'chamber@admin',
                role: 'chamber',
                permissions: ['view_all', 'view_users', 'view_reports', 'export_data']
            },
            {
                id: 'org_budget',
                name: 'سازمان برنامه و بودجه',
                code: 'BUDGET2024',
                password: 'budget@admin',
                role: 'budget_org',
                permissions: ['view_all', 'view_users', 'view_reports', 'export_data', 'set_limits']
            }
        ]
    };
}

// ============================================================
// ورود سازمانی
// ============================================================
export async function adminLogin(orgName, orgCode, password) {
    try {
        // بارگذاری سازمان‌ها
        const data = await loadOrganizations();
        const orgs = data.organizations || [];
        
        // جستجوی سازمان
        const org = orgs.find(o => 
            o.name === orgName && 
            o.code === orgCode && 
            o.password === password
        );
        
        if (!org) {
            return { 
                success: false, 
                message: 'نام سازمان، کد یا رمز عبور اشتباه است.' 
            };
        }
        
        // ذخیره جلسه در sessionStorage
        const session = {
            organizationId: org.id,
            organizationName: org.name,
            role: org.role,
            permissions: org.permissions || [],
            loggedInAt: new Date().toISOString()
        };
        sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
        
        return { 
            success: true, 
            message: 'ورود موفق',
            organization: org
        };
    } catch (error) {
        console.error('❌ خطا در ورود سازمانی:', error);
        return { 
            success: false, 
            message: 'خطا در ارتباط با سرور. لطفاً دوباره تلاش کنید.' 
        };
    }
}

// ============================================================
// دریافت جلسه فعال
// ============================================================
export function getAdminSession() {
    const session = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!session) return null;
    try {
        return JSON.parse(session);
    } catch {
        return null;
    }
}

// ============================================================
// خروج از پنل مدیریت
// ============================================================
export function adminLogout() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    window.location.href = 'admin-login.html';
}

// ============================================================
// بررسی احراز هویت
// ============================================================
export function checkAdminAuth() {
    const session = getAdminSession();
    const currentPath = window.location.pathname;
    
    // اگر در صفحات مدیریت هستیم و وارد نشده‌ایم
    if (currentPath.includes('admin-dashboard.html') || currentPath.includes('admin-')) {
        if (!session) {
            window.location.href = 'admin-login.html';
            return false;
        }
        return true;
    }
    return true;
}

// ============================================================
// دریافت اطلاعات سازمان جاری
// ============================================================
export async function getCurrentOrganization() {
    const session = getAdminSession();
    if (!session) return null;
    
    try {
        const data = await loadOrganizations();
        const orgs = data.organizations || [];
        return orgs.find(o => o.id === session.organizationId) || null;
    } catch {
        return null;
    }
}
