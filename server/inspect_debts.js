const admin = require('./services/firebase-admin');
require('dotenv').config();

const db = admin.firestore();

async function checkDebts() {
    console.log('Checking all debts in collection...');
    try {
        const debtsSnapshot = await db.collection('debts').get();
        console.log(`Total debts in collection: ${debtsSnapshot.size}`);

        if (debtsSnapshot.empty) {
            console.log('No debts found in the collection.');
            return;
        }

        const owners = new Set();
        const userIds = new Set();
        
        debtsSnapshot.docs.slice(0, 10).forEach(doc => {
            const data = doc.data();
            console.log(`- Debt ID: ${doc.id}, userId: ${data.userId}, storeOwner: ${data.storeOwner?.name || 'N/A'}`);
            if (data.userId) userIds.add(data.userId);
            if (data.storeOwner?.name) owners.add(data.storeOwner.name);
        });

        console.log('\nSummary:');
        console.log(`Unique userIds found in first 10: ${Array.from(userIds).join(', ')}`);
        
        // Also check users collection to see roles
        console.log('\nChecking users roles:');
        const usersSnapshot = await db.collection('users').get();
        usersSnapshot.forEach(doc => {
            console.log(`- User: ${doc.data().email}, role: ${doc.data().role}, uid: ${doc.id}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        process.exit();
    }
}

checkDebts();
