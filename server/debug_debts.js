const admin = require('./services/firebase-admin');
require('dotenv').config();

const db = admin.firestore();

async function checkDebts() {
  try {
    const snapshot = await db.collection('debts').limit(10).get();
    if (snapshot.empty) {
      console.log('No debts found in the collection.');
    } else {
      console.log(`Found ${snapshot.size} debts:`);
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`- ID: ${doc.id}, userId: ${data.userId}, storeOwner: ${data.storeOwner?.name}`);
      });
    }
    
    // Also check total count
    const totalSnapshot = await db.collection('debts').count().get();
    console.log(`Total debts in DB: ${totalSnapshot.data().count}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkDebts();
