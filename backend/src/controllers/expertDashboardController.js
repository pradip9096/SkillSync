const expertService = require('../services/ExpertService');

const getExpertBookings = async (req, res) => {
  try {
    const result = await expertService.getExpertBookings({
      authUser: req.user,
      page: req.query.page,
      limit: req.query.limit
    });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error retrieving bookings' });
  }
};

const getExpertProfile = async (req, res) => {
  try {
    const expert = await expertService.getExpertProfile({ authUser: req.user });
    res.status(200).json({ success: true, data: expert });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error retrieving profile' });
  }
};

const updateExpertProfile = async (req, res) => {
  try {
    const updatedExpert = await expertService.updateExpertProfile({ authUser: req.user, payload: req.body });
    res.status(200).json({ success: true, data: updatedExpert });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error updating profile' });
  }
};

const blockSlot = async (req, res) => {
  try {
    const io = req.app.get('io');
    const block = await expertService.blockSlot({ authUser: req.user, payload: req.body, io });
    res.status(201).json({ success: true, data: block });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error blocking slot' });
  }
};

const unblockSlot = async (req, res) => {
  try {
    const io = req.app.get('io');
    const result = await expertService.unblockSlot({ authUser: req.user, payload: req.body, io });
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error unblocking slot' });
  }
};

const uploadGalleryImage = async (req, res) => {
  try {
    const gallery = await expertService.uploadGalleryImage({ authUser: req.user, file: req.file });
    res.status(200).json({ success: true, gallery });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error uploading gallery image' });
  }
};

const deleteGalleryImage = async (req, res) => {
  try {
    const gallery = await expertService.deleteGalleryImage({ authUser: req.user, filename: req.params.filename });
    res.status(200).json({ success: true, gallery });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error deleting gallery image' });
  }
};

const rateClient = async (req, res) => {
  try {
    const result = await expertService.rateClient({ authUser: req.user, bookingId: req.params.id, payload: req.body });
    res.status(200).json({ success: true, data: result.clientUser, review: result.review });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error rating client' });
  }
};

const getExpertAnalytics = async (req, res) => {
  try {
    const analytics = await expertService.getExpertAnalytics({ authUser: req.user });
    res.status(200).json({ success: true, analytics });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.message || 'Server error retrieving analytics data' });
  }
};

module.exports = {
  getExpertBookings,
  getExpertProfile,
  updateExpertProfile,
  blockSlot,
  unblockSlot,
  uploadGalleryImage,
  deleteGalleryImage,
  rateClient,
  getExpertAnalytics
};
