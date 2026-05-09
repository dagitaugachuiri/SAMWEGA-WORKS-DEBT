const admin = require('./services/firebase-admin');
const db = admin.firestore();

async function checkDebts() {
  try {
    const snapshot = await db.collection('debts').limit(5).get();
    if (snapshot.empty) {
      console.log('No debts found.');
      return;
    }
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`ID: ${doc.id}, userId: ${data.userId}, salesRep: ${data.salesRep}`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDebts();
