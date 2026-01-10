// West Bengal PIN code ranges (specific to West Bengal only)
const WEST_BENGAL_PIN_RANGES = [
  { start: 700000, end: 743999 }, // West Bengal specific range
  // Note: 744000-799999 includes other states like Tripura (799xxx), Assam (781xxx-788xxx), etc.
];

/**
 * Check if a PIN code belongs to West Bengal
 * @param {string} pincode - 6-digit PIN code
 * @returns {boolean} - true if PIN code is from West Bengal
 */
const isWestBengalPincode = (pincode) => {
  if (!pincode || typeof pincode !== 'string') {
    return false;
  }

  // Remove any non-numeric characters and ensure it's 6 digits
  const cleanPincode = pincode.replace(/\D/g, '');
  if (cleanPincode.length !== 6) {
    return false;
  }

  const pincodeNumber = parseInt(cleanPincode, 10);
  
  // Check if the PIN code falls within West Bengal ranges
  return WEST_BENGAL_PIN_RANGES.some(range => 
    pincodeNumber >= range.start && pincodeNumber <= range.end
  );
};

/**
 * Calculate shipping charges based on PIN code
 * @param {string} pincode - 6-digit PIN code
 * @param {number} subtotal - Order subtotal amount (after discount)
 * @returns {number} - Shipping charges
 */
const calculateShippingCharges = (pincode, subtotal = 0) => {
  // Free shipping for orders above ₹2000
  if (subtotal >= 2000) {
    return 0;
  }

  // Check if PIN code is from West Bengal
  if (isWestBengalPincode(pincode)) {
    return 70; // ₹70 for West Bengal
  } else {
    return 100; // ₹100 for other states
  }
};

/**
 * Get shipping info text based on PIN code
 * @param {string} pincode - 6-digit PIN code
 * @param {number} subtotal - Order subtotal amount
 * @returns {object} - Shipping info with charges and description
 */
const getShippingInfo = (pincode, subtotal = 0) => {
  const charges = calculateShippingCharges(pincode, subtotal);
  
  if (charges === 0) {
    return {
      charges: 0,
      description: 'FREE Shipping',
      region: 'All India'
    };
  }

  const isWB = isWestBengalPincode(pincode);
  
  return {
    charges,
    description: `₹${charges} Shipping`,
    region: isWB ? 'West Bengal' : 'Other States'
  };
};

/**
 * Validate PIN code format
 * @param {string} pincode - PIN code to validate
 * @returns {object} - Validation result with isValid and message
 */
const validatePincode = (pincode) => {
  if (!pincode) {
    return { isValid: false, message: 'PIN code is required' };
  }

  const cleanPincode = pincode.replace(/\D/g, '');
  
  if (cleanPincode.length !== 6) {
    return { isValid: false, message: 'PIN code must be 6 digits' };
  }

  if (cleanPincode.startsWith('0')) {
    return { isValid: false, message: 'PIN code cannot start with 0' };
  }

  return { isValid: true, message: 'Valid PIN code' };
};

module.exports = {
  isWestBengalPincode,
  calculateShippingCharges,
  getShippingInfo,
  validatePincode
};
