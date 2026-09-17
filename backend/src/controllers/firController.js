const FIRDraft = require('../models/FIRDraft');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

// Generate FIR Draft using AI
exports.generateFIR = async (req, res, next) => {
  try {
    // Support BOTH old structured format AND new simple format from mobile app
    const {
      // Old format (FIRFormScreen)
      type, incident, complainant, accused, witnesses, additionalInfo,
      // New simple format (FIRDraftScreen / FIRTypeSelector)
      incidentType, description, location, date, clientName,
    } = req.body;

    // Build a unified prompt regardless of format
    const resolvedType = type || incidentType || 'General Incident';
    const resolvedDesc = (incident?.description) || description || 'Not provided';
    const resolvedLocation = (incident?.location) || location || 'Not provided';
    const resolvedDate = (incident?.date) || date || new Date().toISOString().split('T')[0];
    const resolvedName = complainant?.name || clientName || 'Complainant';

    const prompt = `
As a legal expert in Indian Law, draft a formal First Information Report (FIR) based on these details:

TYPE OF INCIDENT: ${resolvedType}

INCIDENT DETAILS:
Date: ${resolvedDate}
Location: ${resolvedLocation}
Description: ${resolvedDesc}

COMPLAINANT: ${resolvedName}
${complainant?.age ? 'Age: ' + complainant.age : ''}
${complainant?.address ? 'Address: ' + complainant.address : ''}

${accused?.length ? 'ACCUSED:\n' + accused.map(a => `- ${a.name || 'Unknown'}, ${a.address || ''}`).join('\n') : ''}
${witnesses?.length ? 'WITNESSES:\n' + witnesses.map(w => `- ${w.name || 'Unknown'}, ${w.contact || ''}`).join('\n') : ''}
${additionalInfo ? 'ADDITIONAL INFO: ' + additionalInfo : ''}

INSTRUCTIONS:
1. Use formal legal language (IPC/BNS sections if applicable).
2. Structure it like an official FIR format used in Indian Police Stations.
3. Keep it detailed but concise.
4. Include all provided names and locations accurately.
    `.trim();

    const { callAI } = require('../services/aiService');

    // Try AI generation — fallback to template if AI fails
    let aiDraft;
    try {
      aiDraft = await callAI([{ role: 'user', content: prompt }]);
    } catch (aiErr) {
      logger.warn('AI service unavailable for FIR generation, using template:', aiErr.message);
      aiDraft = `
FIRST INFORMATION REPORT (FIR)
================================

FIR No.: [To be assigned by Police Station]
Date: ${resolvedDate}
Time: ${new Date().toLocaleTimeString('en-IN')}
Police Station: [To be filled]

TYPE OF OFFENCE: ${resolvedType}

COMPLAINANT DETAILS:
Name: ${resolvedName}
${complainant?.age ? 'Age: ' + complainant.age : ''}
${complainant?.address ? 'Address: ' + complainant.address : ''}
${complainant?.phone ? 'Phone: ' + complainant.phone : ''}

INCIDENT DETAILS:
Date of Incident: ${resolvedDate}
Place of Occurrence: ${resolvedLocation}

DESCRIPTION OF INCIDENT:
${resolvedDesc}

${accused?.length ? 'DETAILS OF ACCUSED:\n' + accused.map((a, i) => `${i+1}. Name: ${a.name || 'Unknown'}\n   Address: ${a.address || 'Unknown'}`).join('\n') : ''}

${witnesses?.length ? 'WITNESSES:\n' + witnesses.map((w, i) => `${i+1}. Name: ${w.name || 'Unknown'}, Contact: ${w.contact || 'N/A'}`).join('\n') : ''}

${additionalInfo ? 'ADDITIONAL INFORMATION:\n' + additionalInfo : ''}

RELEVANT SECTIONS:
[Applicable IPC/BNS sections to be determined by the investigating officer based on the nature of offence]

DECLARATION:
I hereby declare that the information given above is true and correct to the best of my knowledge and belief.

Complainant's Signature: ________________
Date: ${resolvedDate}

[This is a draft FIR. Please review and submit to the nearest police station.]
      `.trim();
    }

    // Save as draft — always succeeds regardless of AI status
    const draft = await FIRDraft.create({
      user: req.user.id,
      type: resolvedType,
      incident: incident || { date: resolvedDate, location: resolvedLocation, description: resolvedDesc },
      complainant: complainant || { name: resolvedName },
      accused: accused || [],
      witnesses: witnesses || [],
      additionalInfo: additionalInfo || '',
      aiDraft,
    });

    res.status(201).json({ success: true, data: draft });
  } catch (err) {
    next(err);
  }
};


// Get User's Drafts
exports.getMyDrafts = async (req, res, next) => {
  try {
    const drafts = await FIRDraft.find({ user: req.user.id }).lean().sort('-createdAt');
    res.json({ success: true, data: drafts });
  } catch (err) {
    next(err);
  }
};

// Get Specific Draft
exports.getDraft = async (req, res, next) => {
  try {
    const draft = await FIRDraft.findOne({ _id: req.params.id, user: req.user.id });
    if (!draft) return next(new AppError('Draft not found', 404));
    res.json({ success: true, data: draft });
  } catch (err) {
    next(err);
  }
};

// Update Draft
exports.updateDraft = async (req, res, next) => {
  try {
    const update = {};
    if (req.body.aiDraft !== undefined) {
      const aiDraft = String(req.body.aiDraft).trim();
      if (aiDraft.length < 20 || aiDraft.length > 20000) {
        return next(new AppError('FIR draft must be between 20 and 20,000 characters.', 400));
      }
      update.aiDraft = aiDraft;
    }
    if (req.body.status !== undefined) {
      if (!['draft', 'finalized'].includes(req.body.status)) {
        return next(new AppError('Clients can only save or finalize their FIR draft.', 400));
      }
      update.status = req.body.status;
    }
    if (!Object.keys(update).length) {
      return next(new AppError('No editable FIR draft fields were provided.', 400));
    }

    const draft = await FIRDraft.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!draft) return next(new AppError('Draft not found', 404));
    res.json({ success: true, data: draft });
  } catch (err) {
    next(err);
  }
};

// Delete Draft
exports.deleteDraft = async (req, res, next) => {
  try {
    const draft = await FIRDraft.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    if (!draft) return next(new AppError('Draft not found', 404));
    res.json({ success: true, message: 'Draft deleted successfully' });
  } catch (err) {
    next(err);
  }
};
