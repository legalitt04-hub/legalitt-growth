// src/routes/legalAdvice.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const ctrl = require('../controllers/legalAdviceController');

// All routes require authentication
router.use(protect);

router.post('/request',          ctrl.createLegalRequest);
router.post('/confirm-payment',  ctrl.confirmLegalPayment);
router.get('/my-requests',       ctrl.getMyRequests);
router.get('/request/:id',       ctrl.getRequestDetail);
router.post('/request/:id/ai-draft', ctrl.generateAdvocateLegalNoticeDraft);
router.patch('/request/:id/draft', ctrl.saveAdvocateLegalNoticeDraft);
router.post('/request/:id/advocate-document', ctrl.submitAdvocateLegalNoticeDocument);

module.exports = router;
