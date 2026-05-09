const admin = require('./services/firebase-admin');
const db = admin.firestore();

async function trimSalesReps() {
  try {
    console.log('Starting trimming of salesRep names...');
    const snapshot = await db.collection('debts').get();
    let count = 0;
    
    const batch = db.batch();
    let batchCount = 0;
    
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (data.salesRep && (data.salesRep !== data.salesRep.trim())) {
        const trimmed = data.salesRep.trim();
        batch.update(doc.ref, { salesRep: trimmed });
        count++;
        batchCount++;
        
        if (batchCount === 500) {
          await batch.commit();
          batchCount = 0;
          console.log(`Committed 500 records...`);
        }
      }
    }
    
    if (batchCount > 0) {
      await batch.commit();
    }
    
    console.log(`Finished trimming. Total updated: ${count}`);
  } catch (error) {
    console.error('Error:', error);
  }
}

trimSalesReps();
