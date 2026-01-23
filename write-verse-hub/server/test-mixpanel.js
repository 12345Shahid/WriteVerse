import 'dotenv/config';
import Mixpanel from 'mixpanel';

console.log('Checking Mixpanel Configuration...');

if (!process.env.MIXPANEL_TOKEN) {
    console.error('❌ ERROR: MIXPANEL_TOKEN is missing from .env file');
    process.exit(1);
}

console.log(`✅ Token found: ${process.env.MIXPANEL_TOKEN.substring(0, 5)}...`);

const mixpanel = Mixpanel.init(process.env.MIXPANEL_TOKEN);

console.log('🚀 Sending "Test Integration Event" to Mixpanel...');

mixpanel.track('Test Integration Event', {
    distinct_id: 'test_admin_user',
    source: 'manual_test_script',
    timestamp: new Date()
}, (err) => {
    if (err) {
        console.error('❌ FAILED to send event:', err);
    } else {
        console.log('✅ SUCCESS: Event sent! Check your Mixpanel Dashboard (Live View).');
    }
});
