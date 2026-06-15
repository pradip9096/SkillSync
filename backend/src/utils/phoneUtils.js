/**
 * Validate Indian Phone Numbers (10 digits starting with 6-9)
 */
const isValidIndianPhone = (phone) => {
  if (!phone) return false;
  // Allows optional +91 or 91 prefix, followed by 10 digits starting with 6-9
  const regex = /^(?:\+91|91)?[6-9]\d{9}$/;
  return regex.test(phone.toString().replace(/\s/g, ''));
};

module.exports = {
  isValidIndianPhone
};
