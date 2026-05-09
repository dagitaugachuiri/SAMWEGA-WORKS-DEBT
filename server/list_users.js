const admin = require('./services/firebase-admin');
const db = admin.firestore();

async function listUsers() {
  try {
    const snapshot = await db.collection('users').limit(10).get();
    snapshot.forEach(doc => {
      console.log(`ID: ${doc.id}, Name: ${doc.data().name}, Email: ${doc.data().email}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

listUsers();
