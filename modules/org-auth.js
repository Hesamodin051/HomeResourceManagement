// modules/org-auth.js
// احراز هویت سازمانی - بدون تداخل با فایل‌های اصلی

import { orgStore, setOrganizations, setCurrentOrganization, clearOrgData } from './org-store.js';
import { loadOrgUsers } from './org-consumption.js';

const ORG_SESSION_KEY = 'org_session';

async function loadOrganizations() {
    try {
        const response = await fetch('assets/data/organizations.json');
        if (!response.ok) throw new Error('فایل سازمان‌ها پیدا نشد');
        const data = await response.json();
        setOrganizations(data.organizations || []);
        return data;
    } catch (error) {
        console.error('❌ خطا در بارگذاری سازمان‌ها:', error);
        const defaultData = getDefaultOrganizations();
        setOrganizations(defaultData);
        return { organizations: defaultData };
    }
}

function getDefaultOrganizations() {
    return [
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
    ];
}

export async function orgLogin(orgName, orgCode, password) {
    try {
        const data = await loadOrganizations();
        const orgs = orgStore.organizations || [];
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
        
        const session = {
            organizationId: org.id,
            organizationName: org.name,
            role: org.role,
            permissions: org.permissions || [],
            loggedInAt: new Date().toISOString()
        };
        sessionStorage.setItem(ORG_SESSION_KEY, JSON.stringify(session));
        
        setCurrentOrganization(org);
        loadOrgUsers();
        
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

export function getOrgSession() {
    const session = sessionStorage.getItem(ORG_SESSION_KEY);
    if (!session) return null;
    try {
        return JSON.parse(session);
    } catch {
        return null;
    }
}

export function orgLogout() {
    sessionStorage.removeItem(ORG_SESSION_KEY);
    clearOrgData();
    window.location.href = 'org-login.html';
}

export function checkOrgAuth() {
    const session = getOrgSession();
    const currentPath = window.location.pathname;
    if (currentPath.includes('org-dashboard.html')) {
        if (!session) {
            window.location.href = 'org-login.html';
            return false;
        }
        return true;
    }
    return true;
}
