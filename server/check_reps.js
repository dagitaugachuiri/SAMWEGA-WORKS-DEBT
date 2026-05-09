const admin = require('./services/firebase-admin');
const db = admin.firestore();

async function checkDebts() {
  try {
    const snapshot = await db.collection('debts').limit(20).get();
    const salesReps = new Set();
    snapshot.forEach(doc => {
      salesReps.add(doc.data().salesRep);
    });
    console.log('Unique Sales Reps in first 20 debts:', Array.from(salesReps));
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDebts();
