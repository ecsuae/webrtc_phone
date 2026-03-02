// Generate VAPID keys for web push notifications

const webpush = require('web-push');

console.log('');
console.log('════════════════════════════════════════');
console.log('  Generating VAPID Keys');
console.log('════════════════════════════════════════');
console.log('');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('Public Key:');
console.log(vapidKeys.publicKey);
console.log('');
console.log('Private Key:');
console.log(vapidKeys.privateKey);
console.log('');
console.log('════════════════════════════════════════');
console.log('  Add these to your .env file:');
console.log('════════════════════════════════════════');
console.log('');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@srve.cc`);
console.log('');
console.log('════════════════════════════════════════');
console.log('  Update www/app/push.js:');
console.log('════════════════════════════════════════');
console.log('');
console.log(`const VAPID_PUBLIC_KEY = '${vapidKeys.publicKey}';`);
console.log('');
