const admin = require('./services/firebase-admin');
const db = admin.firestore();

async function checkUser() {
  try {
    const userDoc = await db.collection('users').doc('9gKDtIfLxJNojMziihjx4A9CbS63').get();
    if (userDoc.exists) {
      console.log('User Profile:', userDoc.data());
    } else {
      console.log('User not found.');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUser();
