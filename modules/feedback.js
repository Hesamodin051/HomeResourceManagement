// modules/feedback.js
const FEEDBACK_KEY = 'food_feedback';

export function getFeedback() {
    const stored = localStorage.getItem(FEEDBACK_KEY);
    return stored ? JSON.parse(stored) : {};
}

function saveFeedback(feedback) {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(feedback));
}

export function addFeedback(foodName, rating, comment = '') {
    const feedback = getFeedback();
    if (!feedback[foodName]) {
        feedback[foodName] = {
            ratings: [],
            comments: [],
            totalRating: 0,
            count: 0
        };
    }
    feedback[foodName].ratings.push(rating);
    feedback[foodName].totalRating += rating;
    feedback[foodName].count += 1;
    if (comment) {
        feedback[foodName].comments.push({
            comment: comment,
            date: new Date().toISOString()
        });
    }
    saveFeedback(feedback);
    return feedback[foodName];
}

export function getAverageRating(foodName) {
    const feedback = getFeedback();
    if (!feedback[foodName] || feedback[foodName].count === 0) {
        return null;
    }
    return feedback[foodName].totalRating / feedback[foodName].count;
}

export function getFoodFeedback(foodName) {
    const feedback = getFeedback();
    return feedback[foodName] || { ratings: [], comments: [], totalRating: 0, count: 0 };
}

export function getMostLikedFoods(limit = 5) {
    const feedback = getFeedback();
    const items = Object.keys(feedback).map(name => ({
        name,
        average: feedback[name].count > 0 ? feedback[name].totalRating / feedback[name].count : 0,
        count: feedback[name].count
    }));
    items.sort((a, b) => b.average - a.average);
    return items.slice(0, limit);
}

export function clearFoodFeedback(foodName) {
    const feedback = getFeedback();
    delete feedback[foodName];
    saveFeedback(feedback);
}
