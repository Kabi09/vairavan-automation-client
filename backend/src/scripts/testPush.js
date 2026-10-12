import { initializeFirebase, getMessaging } from '../config/firebase.js';

const KNOWN_DEVICE_TOKEN =
  'dSY_jvddTBiSu796uQ4xDh:APA91bEB_vzZEJeydqT_a9K-1VqyUdOIhYBJUkH06zIG67_TgdxasKrPrHacZoQwI1ymG-Tcx9coTI8b-YlG5hYEzyUmwKP3Zm8C6iMnDyN3vseg2DynGiI';

async function runTest() {
  console.log('====================================================');
  console.log('📱 MOBILE PUSH NOTIFICATION MANUAL TESTER');
  console.log('====================================================');
  console.log('Target Device Token:', KNOWN_DEVICE_TOKEN.substring(0, 25) + '...');

  // Initialize Firebase Admin SDK
  initializeFirebase();
  const messaging = getMessaging();

  if (!messaging) {
    console.error('❌ Failed to initialize Firebase Messaging instance.');
    process.exit(1);
  }

  const delaySeconds = 5;
  console.log(`\n⏳ Sending notification in ${delaySeconds} seconds.`);
  console.log('👉 Choose what to test right now:');
  console.log('   1. Screen OFF: Press your phone power button to lock it now.');
  console.log('   2. Background: Minimize the app and go to your phone home screen.');
  console.log('   3. Foreground: Keep the app open on your phone screen.\n');

  for (let i = delaySeconds; i > 0; i--) {
    process.stdout.write(`   ⏱️  Dispatching in ${i}... \r`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log('\n🚀 Dispatching high-priority push notification now...');

  const timeString = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const message = {
    token: KNOWN_DEVICE_TOKEN,
    notification: {
      title: '🔔 Duty Manager Test Alert',
      body: `Live notification received at ${timeString}. Push delivery is working!`,
    },
    data: {
      type: 'manual_test',
      timestamp: Date.now().toString(),
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'default',
        priority: 'max',
        defaultSound: true,
        defaultVibrateTimings: true,
      },
    },
  };

  try {
    const messageId = await messaging.send(message);
    console.log('\n✅ Push notification successfully sent to Google FCM!');
    console.log(`   Message ID: ${messageId}`);
    console.log('\n📱 Check your phone:');
    console.log('   - Screen should turn on / wake up');
    console.log('   - Notification sound and vibration should play');
    console.log('   - Heads-up alert should appear in your notification shade');
    console.log('====================================================\n');
  } catch (error) {
    console.error('\n❌ FCM Delivery Error:', error.message);
  }
}

runTest();
