const express = require('express');
const router = express.Router();
const firController = require('../controllers/firController');
const { protect } = require('../middlewares/auth');
const { firRateLimiter } = require('../middlewares/rateLimiter');
const upload = require('../middlewares/upload');

router.use(protect); // All FIR routes need authentication

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
  res.json({ 
    success: true, 
    data: { 
      url: `/uploads/${req.file.filename}`, 
      name: req.file.originalname,
      type: req.file.mimetype 
    } 
  });
});

router.post('/generate', firRateLimiter, firController.generateFIR);
router.get('/my', firController.getMyDrafts);
router.get('/:id', firController.getDraft);
router.put('/:id', firController.updateDraft);
router.delete('/:id', firController.deleteDraft);

module.exports = router;
