import Mixpanel from 'mixpanel';

let mixpanel = null;

// Initialize if token exists
if (process.env.MIXPANEL_TOKEN) {
    mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN);
    console.log('[Mixpanel] Initialized Server-Side Tracking');
} else {
    console.warn('[Mixpanel] No Token provided. Tracking disabled.');
}

export const trackEvent = (eventName, distinctId, properties = {}) => {
    if (!mixpanel) return;
    
    try {
        mixpanel.track(eventName, {
            distinct_id: distinctId,
            ...properties
        });
    } catch (err) {
        console.warn('[Mixpanel] Error tracking event:', err.message);
    }
};

export const identifyUser = (distinctId, properties = {}) => {
    if (!mixpanel) return;
    try {
        mixpanel.people.set(distinctId, properties);
    } catch (e) {}
};
