/**
 * Serializes a booking document to strip out sensitive fields before sending it to the client.
 * Specifically removes the RAZORPAY_KEY_ID or any other internal backend fields.
 * 
 * @param {Object} booking - The Mongoose booking document.
 * @returns {Object} The sanitized booking object.
 */
const serializeBookingDTO = (booking) => {
  // Convert mongoose document to plain object if necessary
  const bookingObj = booking.toObject ? booking.toObject() : { ...booking };
  
  // Explicitly delete sensitive fields
  delete bookingObj.RAZORPAY_KEY_ID;
  
  // Strip out Mongoose internal version key if present
  delete bookingObj.__v;
  
  return bookingObj;
};

module.exports = { serializeBookingDTO };
