
/**
 * Formats a timestamp (Firestore Timestamp, serialized Timestamp, Date object, or string)
 * into a human-readable date string.
 * @param {any} timestamp - The timestamp to format
 * @param {boolean} includeTime - Whether to include time in the output
 * @returns {string} - Formatted date string or 'N/A'
 */
export const formatTimestamp = (timestamp, includeTime = true) => {
  if (!timestamp) return 'N/A';

  let date;

  // Handle Firestore Timestamp object
  if (typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } 
  // Handle serialized Firestore Timestamp object { seconds, nanoseconds }
  else if (typeof timestamp.seconds === 'number') {
    date = new Date(timestamp.seconds * 1000);
  }
  // Handle numeric timestamp (seconds or milliseconds)
  else if (typeof timestamp === 'number') {
    // Assume seconds if less than a certain threshold (e.g., year 3000 in ms)
    if (timestamp < 10000000000) {
      date = new Date(timestamp * 1000);
    } else {
      date = new Date(timestamp);
    }
  }
  // Handle Date object or string
  else {
    date = new Date(timestamp);
  }

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Invalid Date';
  }

  return includeTime 
    ? date.toLocaleString('en-GB') 
    : date.toLocaleDateString('en-GB');
};

/**
 * Formats an amount as currency (KES)
 * @param {number} amount - The amount to format
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount || 0);
};
