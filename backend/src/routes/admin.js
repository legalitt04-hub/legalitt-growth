const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const { protect, authorize } = require('../middlewares/auth');
const adminController = require('../controllers/adminController');
const adsController   = require('../controllers/adsController');
const roleController  = require('../controllers/roleController');

const os = require('os');
const upload = multer({ dest: os.tmpdir() });

// All admin routes require auth + admin role
const validAdminRoles = ['admin', 'super_admin', 'superadmin', 'support_executive', 'support', 'accounts', 'forensic_expert', 'property_verification'];
router.use(protect, authorize(...validAdminRoles));

// ─── Dashboard ────────────────────────────────────────────────────────────────
router.get('/stats',                adminController.getDashboardStats);
router.get('/revenue',              adminController.getRevenueAnalytics);
router.get('/activity',             adminController.getActivityGraph);
router.get('/health',               adminController.getSystemHealth);
router.get('/recent-registrations', adminController.getRecentRegistrations);
router.get('/logs',                 adminController.getSystemLogs);

// ─── Platform Earnings ────────────────────────────────────────────────────────
router.get('/earnings',             adminController.getPlatformEarnings);

// ─── Users Management ──────────────────────────────────────────────────
router.get('/users',                       adminController.getUsersList);
router.get('/clients',                     adminController.getUsersList);  // alias for /users (client-facing naming)
router.get('/users/:id',                   adminController.getUserDetail);
router.post('/users',                      adminController.createUser);
router.patch('/users/:id',                 upload.single('avatar'), adminController.updateUser);
router.delete('/users/:id',               adminController.deleteUser);
router.patch('/users/:id/toggle',          adminController.toggleUserBan);
router.patch('/users/:id/role',            adminController.updateUserRole);
router.post('/users/:id/reset-password',   adminController.resetUserPassword);

// ─── Advocates Management ────────────────────────────────────────────────
router.get('/advocates',                    adminController.getAdvocatesList);
router.post('/advocates',                   adminController.createAdvocate);
router.post('/advocates/bulk-upload',       upload.single('file'), adminController.bulkUploadAdvocates);
router.get('/advocates/:id',                adminController.getAdvocateDetail);
router.get('/advocates/:id/earnings',       adminController.getAdvocateEarnings);
router.patch('/advocates/:id',              upload.single('avatar'), adminController.updateAdvocate);
router.delete('/advocates/:id',            adminController.deleteAdvocate);
router.patch('/advocates/:id/verify',       adminController.verifyAdvocate);
router.patch('/advocates/:id/suspend',      adminController.suspendAdvocate);

// ─── Settings Management ────────────────────────────────────────────────────────
router.get('/settings',               adminController.getSettings);
router.put('/settings',               adminController.updateSettings);

// ─── Legal Requests (Legal Advice + Legal Notice) ────────────────────────────
router.get('/legal-requests',         adminController.getLegalRequests);

// ─── New Modules (Phase 3 Integration) ────────────────────────────────────────
const adminModuleController = require('../controllers/adminModuleController');
router.get('/cases',                  adminModuleController.getCases);
router.put('/cases/:id',              adminModuleController.updateCase);
router.delete('/cases/:id',           adminModuleController.deleteCase);
router.get('/services',               adminModuleController.getServices);
router.put('/services/:id',           adminModuleController.updateService);
router.get('/documents',              adminModuleController.getDocuments);
router.post('/documents/upload-for-booking', upload.single('file'), adminModuleController.uploadDocForBooking);
router.get('/support-tickets',              adminModuleController.getSupportTickets);
router.put('/support-tickets/:id',          adminModuleController.updateSupportTicket);
router.post('/support-tickets/:id/reply',   adminModuleController.replyToTicket);
router.get('/ai-drafts',              adminModuleController.getAIDrafts);
router.get('/notifications/templates',adminModuleController.getNotificationTemplates);

// ─── Production 17-Module Routes ─────────────────────────────────────────────
router.get('/categories',             adminModuleController.getCategories);
router.get('/service-categories',     adminModuleController.getCategories);  // alias for admin panel
router.post('/categories',            adminModuleController.createCategory);
router.put('/categories/:id',         adminModuleController.updateCategory);
router.delete('/categories/:id',      adminModuleController.deleteCategory);


router.get('/coupons',                adminModuleController.getCoupons);
router.post('/coupons',               adminModuleController.createCoupon);
router.delete('/coupons/:id',         adminModuleController.deleteCoupon);

router.get('/reviews',                adminModuleController.getReviews);
router.delete('/reviews/:id',         adminModuleController.deleteReview);

router.get('/audit-logs',             adminModuleController.getAuditLogs);
router.get('/admins',                 adminModuleController.getAdmins);

// ─── Booking Assignment (Legal Advice Flow) ───────────────────────────────────
const bookingAssignController = require('../controllers/bookingAssignController');
router.get('/bookings',                    bookingAssignController.getPendingBookings);
router.get('/bookings/:id',                bookingAssignController.getBookingDetail);
router.post('/bookings/:id/assign',        bookingAssignController.assignAdvocate);
router.get('/bookings/:id/nearby-advocates', bookingAssignController.getNearbyAdvocatesForBooking);
router.patch('/bookings/:id/status',       bookingAssignController.updateBookingStatus);

// ─── Advocate Approval & Rejection ────────────────────────────────────────────
const adminAdvocateController = require('../controllers/adminAdvocateController');
router.get('/pending-advocates',                adminAdvocateController.getAdvocates);
router.get('/pending-advocates/:id',            adminAdvocateController.getAdvocateDetail);
router.patch('/pending-advocates/:id/approve',  adminAdvocateController.approveAdvocate);
router.patch('/pending-advocates/:id/reject',   adminAdvocateController.rejectAdvocate);
router.patch('/advocates/:id/rating',           adminAdvocateController.updateAdvocateRating);

// ─── Withdrawal Management ────────────────────────────────────────────────────
router.get('/withdrawals',                      adminAdvocateController.getWithdrawals);
router.patch('/withdrawals/:id/process',        adminAdvocateController.processWithdrawal);

// ─── Call History (Admin) ─────────────────────────────────────────────────────
const callLogCtrl = require('../controllers/callLogController');
router.get('/call-history',                     callLogCtrl.getAdminCallHistory);

// ─── Chat History (Admin) ─────────────────────────────────────────────────────
router.get('/chat-history',                     callLogCtrl.getAdminChatHistory);
router.get('/chat-history/:chatId/messages',    callLogCtrl.getAdminChatMessages);

// ─── Ads Management ───────────────────────────────────────────────────────────
router.get('/ads',                 adsController.getAds);
router.post('/ads',                adsController.createAd);
router.patch('/ads/:id',           adsController.updateAd);
router.delete('/ads/:id',          adsController.deleteAd);
router.patch('/ads/:id/toggle',    adsController.toggleAdStatus);
router.post('/ads/:id/record',     adsController.recordEvent);

// ─── Role-Based Access Management ────────────────────────────────────────────
router.get('/roles/permissions',           roleController.getRolePermissions);
router.get('/roles/accounts',              roleController.getAdminAccounts);
router.post('/roles/accounts',             roleController.createAdminAccount);
router.patch('/roles/accounts/:id',        roleController.updateAdminAccount);
router.delete('/roles/accounts/:id',       roleController.deleteAdminAccount);
router.post('/roles/accounts/:id/reset-password', roleController.resetAdminPassword);

// ─── Phase 4: User Notes ─────────────────────────────────────────────────────
router.get('/users/:id/notes',           adminController.getUserNotes);
router.post('/users/:id/notes',          adminController.addUserNote);
router.delete('/users/:id/notes/:noteId', adminController.deleteUserNote);

// ─── Phase 4: Payment History ─────────────────────────────────────────────────
router.get('/payment-history',           adminController.getPaymentHistory);
router.get('/payments',                  adminController.getPaymentHistory); // alias for admin panel


// ─── Phase 4: Transaction History ────────────────────────────────────────────
router.get('/transactions',              adminController.getTransactionHistory);

// ─── Phase 4: Upload Document for Client ─────────────────────────────────────
router.post('/upload-for-client',             upload.single('file'), adminController.uploadDocumentForClient);
router.post('/upload-client-document',        upload.single('document'), adminController.uploadDocumentForClient); // alias (Cases page)
router.post('/documents/upload-for-booking',  upload.single('file'), adminController.uploadDocumentForClient);    // alias (Documents page)

// ─── Phase 4: Create Case + Register Client ──────────────────────────────────
router.post('/create-case-for-client',   adminController.createCaseForClient);
router.post('/bookings/:id/internal-notes', adminController.addBookingInternalNote);
router.get('/bookings/:id/chat-messages', adminController.getAdminBookingChatMessages);

// ─── Compatibility Aliases ────────────────────────────────────────────────────
// /admin/consultations → same as /admin/bookings (used by Documents page)
router.get('/consultations',             bookingAssignController.getPendingBookings);
// /admin/logs → same as /admin/audit-logs (used by Settings page)
router.get('/logs',                      adminModuleController.getAuditLogs);


// ─── FIR Drafts (Admin) ───────────────────────────────────────────────────────
router.get('/fir-drafts',                       adminModuleController.getFIRDrafts);
router.get('/fir-drafts/:id',                   adminModuleController.getFIRDraft);
router.put('/fir-drafts/:id/status',            adminModuleController.updateFIRDraftStatus);
router.post('/fir-drafts/:id/upload',           upload.single('document'), adminModuleController.uploadFIRDraftDocument);
router.delete('/fir-drafts/:id',                adminModuleController.deleteFIRDraft);

// ─── Property Research (Admin) ────────────────────────────────────────────────
router.get('/property-research',                adminModuleController.getPropertyResearch);
router.put('/property-research/:id/status',     adminModuleController.updatePropertyResearchStatus);
router.post('/property-research/:id/upload',    upload.single('document'), adminModuleController.uploadPropertyResearchDocument);

// ─── Document Forensic (Admin) ────────────────────────────────────────────────
router.get('/document-forensic',                adminModuleController.getDocumentForensic);
router.put('/document-forensic/:id/status',     adminModuleController.updateDocumentForensicStatus);
router.post('/document-forensic/:id/upload',    upload.single('document'), adminModuleController.uploadDocumentForensicReport);

const pricingController = require('../controllers/pricingController');
router.put('/pricing/:id', pricingController.updatePrice);

// ─── Legal Notices (Admin) ─────────────────────────────────────────────────────
router.get('/legal-notices',                     adminModuleController.getLegalNotices);
router.get('/legal-notices/:id',                 adminModuleController.getLegalNoticeDetail);
router.put('/legal-notices/:id/status',          adminModuleController.updateLegalNoticeStatus);
router.post('/legal-notices/:id/upload',         upload.single('document'), adminModuleController.uploadLegalNoticeDocument);
router.post('/legal-notices/:id/ai-draft',       adminModuleController.generateLegalNoticeAIDraft);
router.post('/legal-notices/:id/assign',         adminModuleController.assignAdvocateToLegalNotice);
router.delete('/legal-notices/:id',              adminModuleController.deleteLegalNotice);

module.exports = router;

