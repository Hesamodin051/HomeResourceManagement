// modules/dataLoader.js
let foodData = [];
let healthData = [];
let crisisScenarios = [];
let alertMessages = [];

export async function loadFoodData() {
    try {
        const response = await fetch('assets/data/food_items.json');
        foodData = await response.json();
        console.log('داده‌های غذایی بارگذاری شد:', foodData.length);
    } catch (error) {
        console.error('خطا در بارگذاری food_items.json:', error);
        foodData = [];
    }
    return foodData;
}

export async function loadHealthData() {
    try {
        const response = await fetch('assets/data/health_medication_items.json');
        healthData = await response.json();
        console.log('داده‌های بهداشتی بارگذاری شد:', healthData.length);
    } catch (error) {
        console.error('خطا در بارگذاری health_medication_items.json:', error);
        healthData = [];
    }
    return healthData;
}

export async function loadCrisisScenarios() {
    try {
        const response = await fetch('assets/data/crisis_scenarios.json');
        crisisScenarios = await response.json();
        console.log('سناریوهای بحران بارگذاری شد:', crisisScenarios.length);
    } catch (error) {
        console.error('خطا در بارگذاری crisis_scenarios.json:', error);
        crisisScenarios = [];
    }
    return crisisScenarios;
}

export async function loadAlertMessages() {
    try {
        const response = await fetch('assets/data/alert_messages.json');
        alertMessages = await response.json();
        console.log('پیام‌های هشدار بارگذاری شد:', alertMessages.length);
    } catch (error) {
        console.error('خطا در بارگذاری alert_messages.json:', error);
        alertMessages = [];
    }
    return alertMessages;
}

export function getFoodData() { return foodData; }
export function getHealthData() { return healthData; }
export function getCrisisScenarios() { return crisisScenarios; }
export function getAlertMessages() { return alertMessages; }
