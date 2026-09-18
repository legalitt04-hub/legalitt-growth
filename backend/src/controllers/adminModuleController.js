const Case = require('../models/Case');
const Service = require('../models/Service');
const Document = require('../models/Document');
const SupportTicket = require('../models/SupportTicket');
const NotificationTemplate = require('../models/NotificationTemplate');
const FIRDraft = require('../models/FIRDraft');
const Category = require('../models/Category');
const Coupon = require('../models/Coupon');
const AuditLog = require('../models/AuditLog');
const Review = require('../models/Review');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Advocate = require('../models/Advocate');
const Notification = require('../models/Notification');
const { createNotification } = require('../utils/notificationHelper');
const { AppError } = require('../middlewares/errorHandler');

// ─── Cases ────────────────────────────────────────────────────────────────────
exports.getCases = async (req, res, next) => {
  try {
    const { page = 1, limit = 15, status, serviceType, search } = req.query;
    require('../models/User');
    require('../models/Advocate');
    const Booking = require('../models/Booking');

    const bookingFilter = { 'payment.status': { $in: ['paid', 'not_required'] } };
    if (status) {
      if (status === 'open') bookingFilter.status = { $in: ['open', 'confirmed', 'pending_assignment'] };
      else if (status === 'pending') bookingFilter.status = { $in: ['pending', 'pending_assignment'] };
      else if (status === 'in_progress') bookingFilter.status = 'in_progress';
      else if (status === 'resolved') bookingFilter.status = 'completed';
      else if (status === 'closed') bookingFilter.status = 'cancelled';
    }
    if (serviceType) bookingFilter.serviceType = serviceType;

    const skip = (Number(page) - 1) * Number(limit);

    const bookings = await Booking.find(bookingFilter).lean()
      .populate('client', 'name email phone avatar')
      .populate({
        path: 'advocate',
        populate: { path: 'user', select: 'name email phone avatar' }
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Booking.countDocuments(bookingFilter);

    const formattedCases = bookings.map(b => {
      const clientObj = b.client || {};
      const advObj = b.advocate || null;
      return {
        _id: b._id,
        caseNumber: b.bookingId || `LGT-${b._id.toString().slice(-6).toUpperCase()}`,
        title: (b.issue || b.issueDescription || b.notes || `${b.type || b.serviceType || 'Legal'} Case`).split('\n')[0]?.substring(0, 65),
        client: {
          _id: clientObj._id,
          name: clientObj.name || b.recipientDetails?.name || 'Client',
          email: clientObj.email || b.recipientDetails?.email || 'N/A',
          phone: clientObj.phone || b.recipientDetails?.phone || 'N/A',
        },
        advocate: advObj ? {
          _id: advObj._id,
          user: {
            name: advObj.user?.name || 'Assigned Advocate',
            email: advObj.user?.email,
            avatar: advObj.user?.avatar,
          },
          specializations: advObj.specializations || [],
        } : null,
        serviceType: b.serviceType || b.type || 'legal_notice',
        status: b.status === 'confirmed' || b.status === 'pending_assignment' ? 'open' : b.status === 'in_progress' ? 'in_progress' : b.status === 'completed' ? 'resolved' : b.status === 'cancelled' ? 'closed' : 'pending',
        priority: b.priority || 'medium',
        payment: {
          amount: b.payment?.amount ?? b.amount ?? 0,
          status: b.payment?.status || (b.paymentStatus === 'completed' ? 'paid' : 'pending'),
        },
        description: b.issue || b.issueDescription || b.notes || '',
        notes: b.adminNotes || '',
        documents: b.documents || [],
        advocateDocuments: b.advocateDocuments || [],
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      };
    });

    res.json({
      success: true,
      data: formattedCases,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)) || 1,
        hasMore: (Number(page) * Number(limit)) < total,
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.updateCase = async (req, res, next) => {
  try {
    const Booking = require('../models/Booking');
    const { status, notes, adminNotes, advocateId, paymentStatus, priority } = req.body;

    // Map from Case display status → Booking DB status
    const STATUS_MAP = {
      open: 'pending_assignment',
      pending: 'pending',
      in_progress: 'in_progress',
      resolved: 'completed',
      closed: 'cancelled',
    };

    const update = {};
    if (status) update.status = STATUS_MAP[status] || status;
    if (notes !== undefined || adminNotes !== undefined) update.adminNotes = adminNotes || notes;
    if (advocateId !== undefined) update.advocate = advocateId || null;
    if (paymentStatus) update['payment.status'] = paymentStatus;
    if (priority) update.priority = priority;

    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: false }
    )
      .populate('client', 'name email phone avatar')
      .populate({ path: 'advocate', populate: { path: 'user', select: 'name email avatar' } });

    if (!updated) return next(new AppError('Case/Booking not found', 404));
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};


exports.deleteCase = async (req, res, next) => {
  try {
    const Booking = require('../models/Booking');
    const deleted = await Booking.findByIdAndDelete(req.params.id);
    if (!deleted) {
      // Fallback: try Case model
      await Case.findByIdAndDelete(req.params.id);
    }
    res.json({ success: true, message: 'Case deleted' });
  } catch (err) {
    next(err);
  }
};

// ─── Services ─────────────────────────────────────────────────────────────────
exports.getServices = async (req, res, next) => {
  try {
    const [services, requestCounts] = await Promise.all([
      Service.find().lean().sort('-createdAt'),
      Booking.aggregate([{ $group: { _id: '$serviceType', count: { $sum: 1 } } }]),
    ]);
    const counts = Object.fromEntries(requestCounts.map(item => [item._id, item.count]));
    const data = services.map(service => {
      const normalized = String(service.name || '').trim().toLowerCase();
      const serviceKey = normalized.includes('legal advice') ? 'legal_advice'
        : normalized.includes('legal notice') ? 'legal_notice'
        : normalized.includes('property research') ? 'property_research'
        : normalized.includes('fir') ? 'fir_draft'
        : normalized.includes('forensic') ? 'document_forensic'
        : normalized.includes('consultation') ? 'consultation'
        : normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      return { ...service, totalRequests: counts[serviceKey] || 0 };
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.createService = async (req, res, next) => {
  try {
    const { name, description, type = 'Other', basePrice, estimatedDays = 1, category = 'General', requirements = [], isActive = true } = req.body;
    if (!name?.trim() || !description?.trim() || basePrice === undefined) {
      return next(new AppError('Name, description, and base price are required.', 400));
    }
    const service = await Service.create({
      name: name.trim(),
      description: description.trim(),
      type,
      basePrice: Number(basePrice),
      estimatedDays: Number(estimatedDays),
      category: category?.trim() || 'General',
      requirements: Array.isArray(requirements) ? requirements : String(requirements).split(',').map(value => value.trim()).filter(Boolean),
      isActive: Boolean(isActive),
    });
    res.status(201).json({ success: true, data: service });
  } catch (err) {
    next(err);
  }
};

exports.updateService = async (req, res, next) => {
  try {
    const updatedService = await Service.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!updatedService) return next(new AppError('Service not found', 404));
    res.json({ success: true, data: updatedService });
  } catch (err) {
    next(err);
  }
};

// ─── Documents ────────────────────────────────────────────────────────────────
// Returns ALL documents: standalone (Document model) + booking-embedded (both sides)
exports.getDocuments = async (req, res, next) => {
  try {
    const Booking = require('../models/Booking');
    const { search, direction, page = 1, limit = 50 } = req.query;

    // 1. Standalone documents
    const standaloneDocs = await Document.find().lean()
      .populate('uploadedBy', 'name avatar role')
      .populate('owner', 'name avatar role')
      .sort('-createdAt')
      .lean();

    // 2. Booking-embedded documents (client uploaded when creating booking)
    const bookings = await Booking.find({ 'documents.0': { $exists: true } }).lean()
      .populate('client', 'name email avatar')
      .populate({ path: 'advocate', populate: { path: 'user', select: 'name avatar' } })
      .select('documents client advocate serviceType createdAt advocateDocuments')
      .lean();

    // Flatten booking docs into unified format
    const bookingClientDocs = [];
    const bookingAdvocateDocs = [];

    bookings.forEach(b => {
      // Client-uploaded docs (stored in booking.documents)
      (b.documents || []).forEach(doc => {
        bookingClientDocs.push({
          _id: `${b._id}_client_${doc.url?.slice(-8)}`,
          name: doc.name || 'Document',
          url: doc.url,
          type: doc.type || 'pdf',
          uploadedAt: doc.uploadedAt || b.createdAt,
          direction: 'client_to_advocate',
          directionLabel: 'Client → Advocate',
          uploadedBy: b.client,
          recipient: b.advocate?.user || null,
          bookingId: b._id,
          serviceType: b.serviceType,
          source: 'booking',
          category: 'legal',
        });
      });

      // Advocate-uploaded docs (stored in booking.advocateDocuments)
      (b.advocateDocuments || []).forEach(doc => {
        bookingAdvocateDocs.push({
          _id: `${b._id}_adv_${doc.url?.slice(-8)}`,
          name: doc.name || 'Document',
          url: doc.url,
          type: doc.type || 'pdf',
          uploadedAt: doc.uploadedAt || b.createdAt,
          direction: 'advocate_to_client',
          directionLabel: 'Advocate → Client',
          uploadedBy: b.advocate?.user || null,
          recipient: b.client,
          bookingId: b._id,
          serviceType: b.serviceType,
          source: 'booking',
          category: 'legal',
        });
      });
    });

    // Normalize standalone docs
    const normalizedStandalone = standaloneDocs.map(d => ({
      ...d,
      direction: 'standalone',
      directionLabel: 'Standalone Upload',
      source: 'document_model',
    }));

    let allDocs = [...bookingClientDocs, ...bookingAdvocateDocs, ...normalizedStandalone]
      .sort((a, b) => new Date(b.uploadedAt || b.createdAt).getTime() - new Date(a.uploadedAt || a.createdAt).getTime());

    // Filter by direction
    if (direction && direction !== 'all') {
      allDocs = allDocs.filter(d => d.direction === direction);
    }

    // Filter by search
    if (search) {
      const q = search.toLowerCase();
      allDocs = allDocs.filter(d =>
        d.name?.toLowerCase().includes(q) ||
        d.uploadedBy?.name?.toLowerCase().includes(q) ||
        d.recipient?.name?.toLowerCase().includes(q)
      );
    }

    const total = allDocs.length;
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const paginated = allDocs.slice((pageNum - 1) * limitNum, pageNum * limitNum);

    res.json({
      success: true,
      data: paginated,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      counts: {
        clientToAdvocate: bookingClientDocs.length,
        advocateToClient: bookingAdvocateDocs.length,
        standalone: normalizedStandalone.length,
        total,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Upload document on behalf of advocate (attaches to booking.advocateDocuments)
exports.uploadDocForBooking = async (req, res, next) => {
  try {
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const Booking = require('../models/Booking');
    const { bookingId, side = 'client' } = req.body; // side: 'client' | 'advocate'

    if (!req.file) return next(new AppError('No file uploaded.', 400));
    if (!bookingId) return next(new AppError('bookingId is required.', 400));

    const booking = await Booking.findById(bookingId);
    if (!booking) return next(new AppError('Booking not found.', 404));

    const isPdf = req.file.mimetype?.includes('pdf') || req.file.originalname?.toLowerCase().endsWith('.pdf');
    const isImage = req.file.mimetype?.startsWith('image/');
    const resourceType = isImage ? 'image' : isPdf ? 'raw' : 'auto';

    // Upload to Cloudinary
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: `legalitt/admin-doc-uploads/${side}`, resource_type: resourceType, use_filename: true, unique_filename: true },
        (err, res) => err ? reject(err) : resolve(res)
      );
      stream.end(req.file.buffer);
    });

    const docEntry = {
      url: result.secure_url,
      name: req.file.originalname,
      type: req.file.mimetype?.includes('image') ? 'image' : 'pdf',
      uploadedAt: new Date(),
      uploadedByAdmin: req.user._id,
    };

    // Push to the right side
    const field = side === 'advocate' ? 'advocateDocuments' : 'documents';
    await Booking.findByIdAndUpdate(bookingId, { $push: { [field]: docEntry } });

    res.json({ success: true, data: { url: result.secure_url, name: req.file.originalname, side } });
  } catch (err) { next(err); }
};

// ─── Support Tickets ──────────────────────────────────────────────────────────
// Admin: fetch all tickets with optional role/category filter
exports.getSupportTickets = async (req, res, next) => {
  try {
    const { role, category, status, search } = req.query;
    const filter = {};
    if (status)   filter.status   = status;
    if (category) filter.category = category;

    let tickets = await SupportTicket.find(filter).lean()
      .populate('user', 'name email avatar role')
      .populate('assignedTo', 'name email avatar')
      .sort('-createdAt');

    // Filter by user role (client/advocate)
    if (role && role !== 'all') {
      tickets = tickets.filter(t => t.user?.role === role);
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      tickets = tickets.filter(t =>
        t.subject?.toLowerCase().includes(q) ||
        t.user?.name?.toLowerCase().includes(q) ||
        t.user?.email?.toLowerCase().includes(q)
      );
    }

    // Stats
    const [openCount, bugCount, resolvedToday] = await Promise.all([
      SupportTicket.countDocuments({ status: 'open' }),
      SupportTicket.countDocuments({ category: 'bug' }),
      SupportTicket.countDocuments({
        status: 'resolved',
        updatedAt: { $gte: new Date(new Date().setHours(0,0,0,0)) },
      }),
    ]);

    res.json({
      success: true,
      data: tickets,
      stats: { openCount, bugCount, resolvedToday },
    });
  } catch (err) {
    next(err);
  }
};

// Mobile: create a new ticket (any authenticated user)
exports.createSupportTicket = async (req, res, next) => {
  try {
    const { subject, description, category = 'general', priority = 'medium' } = req.body;
    if (!subject || !description) {
      return next(new AppError('Subject and description are required.', 400));
    }
    const ticket = await SupportTicket.create({
      subject, description, category, priority,
      user: req.user._id,
      status: 'open',
    });
    res.status(201).json({ success: true, data: ticket });
  } catch (err) { next(err); }
};

// Mobile: get my own tickets
exports.getMyTickets = async (req, res, next) => {
  try {
    const tickets = await SupportTicket.find({ user: req.user._id }).lean()
      .sort('-createdAt').lean();
    res.json({ success: true, data: tickets });
  } catch (err) { next(err); }
};

// Admin: reply to ticket (pushes message into ticket.messages)
exports.replyToTicket = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) return next(new AppError('Message is required.', 400));

    const ticket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      {
        $push: { messages: { sender: req.user._id, message, isStaff: true, createdAt: new Date() } },
        $set:  { status: 'in-progress' },
      },
      { new: true }
    ).populate('user', 'name email avatar');

    if (!ticket) return next(new AppError('Ticket not found', 404));
    res.json({ success: true, data: ticket });
  } catch (err) { next(err); }
};

exports.updateSupportTicket = async (req, res, next) => {
  try {
    const updatedTicket = await SupportTicket.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    )
      .populate('user', 'name email avatar')
      .populate('assignedTo', 'name email avatar');
      
    if (!updatedTicket) return next(new AppError('Ticket not found', 404));
    res.json({ success: true, data: updatedTicket });
  } catch (err) {
    next(err);
  }
};

// ─── Notifications ────────────────────────────────────────────────────────────
exports.getNotificationTemplates = async (req, res, next) => {
  try {
    const templates = await NotificationTemplate.find().lean().sort('-createdAt');
    res.json({ success: true, data: templates });
  } catch (err) {
    next(err);
  }
};

exports.getNotificationStats = async (req, res, next) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [totalSent, sentToday, unread, activeTemplates] = await Promise.all([
      Notification.countDocuments(),
      Notification.countDocuments({ createdAt: { $gte: startOfToday } }),
      Notification.countDocuments({ read: false }),
      NotificationTemplate.countDocuments({ isActive: true }),
    ]);
    res.json({ success: true, data: { totalSent, sentToday, unread, activeTemplates } });
  } catch (err) { next(err); }
};

exports.createNotificationTemplate = async (req, res, next) => {
  try {
    const template = await NotificationTemplate.create(req.body);
    res.status(201).json({ success: true, data: template });
  } catch (err) { next(err); }
};

exports.updateNotificationTemplate = async (req, res, next) => {
  try {
    const template = await NotificationTemplate.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!template) return next(new AppError('Notification template not found', 404));
    res.json({ success: true, data: template });
  } catch (err) { next(err); }
};

exports.deleteNotificationTemplate = async (req, res, next) => {
  try {
    const template = await NotificationTemplate.findByIdAndDelete(req.params.id);
    if (!template) return next(new AppError('Notification template not found', 404));
    res.json({ success: true, message: 'Notification template deleted' });
  } catch (err) { next(err); }
};

exports.sendBroadcastNotification = async (req, res, next) => {
  try {
    const { title, message, targetAudience = 'all' } = req.body;
    if (!title?.trim() || !message?.trim()) return next(new AppError('Title and message are required', 400));
    const filter = { isActive: true };
    if (targetAudience === 'clients') filter.role = 'client';
    if (targetAudience === 'advocates') filter.role = 'advocate';
    const users = await User.find(filter).select('_id').lean();
    await Promise.all(users.map(user => createNotification({ recipientId: user._id, senderId: req.user._id, title: title.trim(), message: message.trim(), type: 'general' })));
    res.status(201).json({ success: true, data: { recipients: users.length } });
  } catch (err) { next(err); }
};

exports.getCalendarEvents = async (req, res, next) => {
  try {
    const now = new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = req.query.to ? new Date(req.query.to) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return next(new AppError('Invalid calendar date range', 400));
    if (req.query.availabilityDate) {
      const day = new Date(`${req.query.availabilityDate}T00:00:00+05:30`);
      if (Number.isNaN(day.getTime())) return next(new AppError('Invalid availability date', 400));
      const end = new Date(day.getTime() + 86400000);
      const filter = { verificationStatus: 'approved' };
      if (req.query.search) {
        const text = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const users = await require('../models/User').find({ name: { $regex: text, $options: 'i' } }).select('_id').lean();
        filter.user = { $in: users.map(user => user._id) };
      }
      const profiles = await Advocate.find(filter).select('user availability courtHearings').populate('user', 'name').limit(50).lean();
      const busy = await Booking.find({ advocate: { $in: profiles.map(a => a._id) }, date: { $gte: day, $lt: end }, status: { $in: ['confirmed', 'in_progress', 'rescheduled'] }, 'payment.status': { $in: ['paid', 'not_required'] } }).select('advocate timeSlot').lean();
      const weekday = day.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
      const minutes = value => { const parts = String(value || '').match(/^(\d{1,2}):(\d{2})$/); return parts ? Number(parts[1]) * 60 + Number(parts[2]) : null; };
      const availability = profiles.map(profile => {
        const reservations = busy.filter(b => String(b.advocate) === String(profile._id));
        const hearings = (profile.courtHearings || []).filter(h => new Date(h.hearingDate) >= day && new Date(h.hearingDate) < end && !['Cancelled', 'Completed'].includes(h.status));
        return { id: profile._id, name: profile.user?.name || 'Advocate', slots: (profile.availability || []).filter(a => a.day === weekday).flatMap(a => a.slots || []).map(slot => {
          const start = minutes(slot.startTime), finish = minutes(slot.endTime);
          const conflict = reservations.some(b => { const bs = minutes(b.timeSlot?.startTime), be = minutes(b.timeSlot?.endTime); return bs === null || be === null || start === null || finish === null || (start < be && finish > bs); });
          return { startTime: slot.startTime, endTime: slot.endTime, status: slot.isBooked || conflict ? 'Busy' : hearings.length ? 'Check hearing schedule' : 'Available' };
        }), hearings: hearings.map(h => ({ title: h.caseTitle, time: h.hearingTime })) };
      });
      return res.json({ success: true, data: availability, limit: 50 });
    }
    const [bookings, cases, advocates] = await Promise.all([
      Booking.find({ date: { $gte: from, $lte: to }, status: { $nin: ['cancelled', 'pending_payment'] }, 'payment.status': { $in: ['paid', 'not_required'] } })
        .select('date timeSlot consultationMode serviceType status client advocate')
        .populate('client', 'name')
        .populate({ path: 'advocate', populate: { path: 'user', select: 'name' } }).lean(),
      Case.find({ 'timeline.date': { $gte: from, $lte: to } }).select('title courtName timeline advocate')
        .populate({ path: 'advocate', populate: { path: 'user', select: 'name' } }).lean(),
      Advocate.find({ 'courtHearings.hearingDate': { $gte: from, $lte: to } })
        .select('courtHearings user').populate('user', 'name').lean(),
    ]);
    const bookingEvents = bookings.map(booking => ({
      id: `booking-${booking._id}`, sourceId: booking._id, source: 'booking',
      title: `${booking.serviceType?.replace(/_/g, ' ') || 'Consultation'} — ${booking.client?.name || 'Client'}`,
      date: booking.date, startTime: booking.timeSlot?.startTime || '', endTime: booking.timeSlot?.endTime || '',
      mode: booking.consultationMode || 'chat',
      location: booking.consultationMode === 'in_person' ? 'In-person consultation' : `${booking.consultationMode || 'chat'} consultation`,
      advocateName: booking.advocate?.user?.name || '', status: booking.status,
      sessionExpiresAt: booking.sessionExpiresAt || null, // ← for admin timer pill
    }));
    const hearingEvents = cases.flatMap(caseItem => (caseItem.timeline || []).filter(item => item.date >= from && item.date <= to).map(item => ({
      id: `case-${caseItem._id}-${item._id}`, sourceId: caseItem._id, source: 'case', title: `${caseItem.title}: ${item.title}`,
      date: item.date, startTime: '', endTime: '', mode: 'hearing', location: caseItem.courtName || 'Court location not set',
      advocateName: caseItem.advocate?.user?.name || '', status: item.status,
    })));
    const advocateHearingEvents = advocates.flatMap(advocate => (advocate.courtHearings || [])
      .filter(item => item.hearingDate >= from && item.hearingDate <= to)
      .map(item => ({
        id: `advocate-hearing-${advocate._id}-${item._id}`,
        sourceId: advocate._id,
        source: 'advocate_hearing',
        title: `${item.caseTitle} (${item.caseNumber})`,
        date: item.hearingDate,
        startTime: item.hearingTime || '',
        endTime: '',
        mode: 'hearing',
        location: [item.courtName, item.courtLocation, item.courtroom].filter(Boolean).join(', '),
        advocateName: advocate.user?.name || '',
        status: String(item.status || 'Upcoming').toLowerCase(),
      })));
    res.json({ success: true, data: [...bookingEvents, ...hearingEvents, ...advocateHearingEvents].sort((a, b) => new Date(a.date) - new Date(b.date)) });
  } catch (err) { next(err); }
};

// ─── AI Drafts ────────────────────────────────────────────────────────────────
exports.getAIDrafts = async (req, res, next) => {
  try {
    const [firDrafts, bookingDrafts] = await Promise.all([
      FIRDraft.find({ aiDraft: { $exists: true, $nin: [null, ''] } })
        .populate('user', 'name email')
        .sort('-updatedAt')
        .lean(),
      Booking.find({ aiDraft: { $exists: true, $nin: [null, ''] } })
        .populate('client', 'name email')
        .sort('-updatedAt')
        .lean(),
    ]);
    const normalizedFIRDrafts = firDrafts.map(draft => ({
      _id: draft._id,
      source: 'fir_draft',
      title: `${String(draft.type || 'FIR').replace(/_/g, ' ')} FIR Draft`,
      content: draft.aiDraft,
      summary: draft.incident?.description || '',
      status: draft.status,
      user: draft.user,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    }));
    const normalizedBookingDrafts = bookingDrafts.map(booking => ({
      _id: booking._id,
      source: booking.serviceType || 'legal_request',
      title: `${String(booking.serviceType || 'Legal').replace(/_/g, ' ')} AI Draft`,
      content: booking.aiDraft,
      summary: booking.issueDescription || booking.issue || '',
      status: booking.status,
      user: booking.client,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
    }));
    const drafts = [...normalizedFIRDrafts, ...normalizedBookingDrafts]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    res.json({ success: true, data: drafts });
  } catch (err) {
    next(err);
  }
};

// ─── Categories ──────────────────────────────────────────────────────────────
exports.getCategories = async (req, res, next) => {
  try {
    let categories = await Category.find().lean().sort('displayOrder');
    if (categories.length === 0) {
      // Seed default categories if empty
      const defaultCats = [
        { name: 'Property Law', slug: 'property-law', description: 'Real estate, titles, property disputes', basePrice: 999 },
        { name: 'Criminal Law', slug: 'criminal-law', description: 'Bail, FIR, criminal defense', basePrice: 1499 },
        { name: 'Family Law', slug: 'family-law', description: 'Divorce, custody, maintenance', basePrice: 899 },
        { name: 'Cyber Crime', slug: 'cyber-crime', description: 'Online fraud, data theft, IT Act', basePrice: 1199 },
        { name: 'Employment', slug: 'employment', description: 'Labor disputes, wrongful termination', basePrice: 799 },
        { name: 'Consumer Law', slug: 'consumer-law', description: 'Defective products, service claims', basePrice: 499 }
      ];
      categories = await Category.insertMany(defaultCats);
    }
    res.json({ success: true, data: categories });
  } catch (err) { next(err); }
};

exports.createCategory = async (req, res, next) => {
  try {
    const category = await Category.create(req.body);
    res.json({ success: true, data: category });
  } catch (err) { next(err); }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json({ success: true, data: category });
  } catch (err) { next(err); }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) { next(err); }
};

// ─── Coupons ─────────────────────────────────────────────────────────────────
exports.getCoupons = async (req, res, next) => {
  try {
    const coupons = await Coupon.find().lean().sort('-createdAt');
    res.json({ success: true, data: coupons });
  } catch (err) { next(err); }
};

exports.createCoupon = async (req, res, next) => {
  try {
    const coupon = await Coupon.create(req.body);
    res.json({ success: true, data: coupon });
  } catch (err) { next(err); }
};

exports.deleteCoupon = async (req, res, next) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (err) { next(err); }
};

// ─── Reviews ─────────────────────────────────────────────────────────────────
exports.getReviews = async (req, res, next) => {
  try {
    const reviews = await Review.find().lean()
      .populate('client', 'name email avatar')
      .populate({ path: 'advocate', populate: { path: 'user', select: 'name email avatar' } })
      .populate('booking', 'bookingId serviceType')
      .sort('-createdAt');
    res.json({ success: true, data: reviews });
  } catch (err) { next(err); }
};

exports.deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findByIdAndDelete(req.params.id);
    if (!review) return next(new AppError('Review not found', 404));
    const stats = await Review.aggregate([
      { $match: { advocate: review.advocate, isVerified: true } },
      { $group: { _id: '$advocate', average: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    const Advocate = require('../models/Advocate');
    await Advocate.findByIdAndUpdate(review.advocate, {
      'rating.average': stats.length ? Math.round(stats[0].average * 10) / 10 : 0,
      'rating.count': stats[0]?.count || 0,
    });
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) { next(err); }
};

// ─── Audit Logs ──────────────────────────────────────────────────────────────
exports.getAuditLogs = async (req, res, next) => {
  try {
    const logs = await AuditLog.find().lean().populate('user', 'name email role').sort('-createdAt').limit(100);
    res.json({ success: true, data: logs });
  } catch (err) { next(err); }
};

// ─── Admin Management ────────────────────────────────────────────────────────
exports.getAdmins = async (req, res, next) => {
  try {
    const adminRoles = [
      'admin',
      'super_admin',
      'support_executive',
      'accounts',
      'forensic_expert',
      'property_verification',
      'support',
      'superadmin'
    ];
    const admins = await User.find({ role: { $in: adminRoles } }).lean().select('-password').sort('-createdAt');
    res.json({ success: true, data: admins });
  } catch (err) { next(err); }
};

// ─── FIR Drafts Admin ─────────────────────────────────────────────────────────
const toAdminFIRStatus = (status) => ({
  draft: 'pending', finalized: 'in_progress', submitted: 'open', reviewed: 'in_progress',
  pending_assignment: 'pending', pending: 'pending', confirmed: 'open', in_progress: 'in_progress',
  completed: 'resolved', cancelled: 'closed',
}[status] || 'pending');

exports.getFIRDrafts = async (req, res, next) => {
  try {
    const FIRDraft = require('../models/FIRDraft');
    const Booking = require('../models/Booking');
    const [drafts, bookings] = await Promise.all([
      FIRDraft.find()
        .populate('user', 'name email phone')
        .populate({ path: 'advocate', populate: { path: 'user', select: 'name email avatar' } })
        .lean(),
      Booking.find({ serviceType: 'fir_draft', 'payment.status': { $in: ['paid', 'not_required'] } })
        .populate('client', 'name email phone')
        .populate({ path: 'advocate', populate: { path: 'user', select: 'name email avatar' } })
        .lean(),
    ]);

    const mappedDrafts = drafts.map(d => ({
      _id: d._id,
      caseNumber: `FIR-${d._id.toString().slice(-6).toUpperCase()}`,
      title: d.type ? d.type.toUpperCase() + ' FIR' : 'General FIR',
      client: d.user || {},
      user: d.user, // for backward compat
      advocate: d.advocate,
      status: toAdminFIRStatus(d.status),
      serviceType: 'fir_draft',
      priority: 'medium',
      payment: null,
      description: d.incident?.description || d.additionalInfo || '',
      notes: d.additionalInfo || '',
      documents: d.evidence || [],
      adminDocuments: d.adminDocuments || [],
      advocateDocuments: d.advocateDocuments || [],
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      // Custom FIR fields
      firType: d.type,
      incidentLocation: d.incident?.location || '',
      complainantName: d.complainant?.name || '',
      incidentDate: d.incident?.date || ''
    }));

    const mappedBookings = bookings.map(b => ({
      _id: b._id,
      caseNumber: b.bookingId || `FIR-${b._id.toString().slice(-6).toUpperCase()}`,
      title: 'FIR Draft Assistance',
      client: b.client || {},
      user: b.client,
      advocate: b.advocate || null,
      status: toAdminFIRStatus(b.status),
      serviceType: 'fir_draft',
      priority: b.priority || 'medium',
      payment: b.payment || null,
      description: b.issue || '',
      notes: b.adminNotes || b.notes || '',
      documents: b.documents || [],
      adminDocuments: b.adminDocuments || [],
      advocateDocuments: b.advocateDocuments || [],
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));

    let mapped = [...mappedDrafts, ...mappedBookings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const search = String(req.query.search || '').trim().toLowerCase();
    if (search) {
      mapped = mapped.filter(item => [item.caseNumber, item.title, item.client?.name, item.client?.email, item.description]
        .some(value => String(value || '').toLowerCase().includes(search)));
    }
    if (req.query.status) mapped = mapped.filter(item => item.status === req.query.status);
    const total = mapped.length;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 15));
    mapped = mapped.slice((page - 1) * limit, page * limit);

    res.json({ success: true, data: mapped, pagination: { total, page, pages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (err) { next(err); }
};

exports.getFIRDraft = async (req, res, next) => {
  try {
    const FIRDraft = require('../models/FIRDraft');
    const draft = await FIRDraft.findById(req.params.id).populate('user', 'name email phone');
    if (draft) return res.json({ success: true, data: draft });
    const Booking = require('../models/Booking');
    const booking = await Booking.findOne({ _id: req.params.id, serviceType: 'fir_draft' }).populate('client', 'name email phone');
    if (!booking) return res.status(404).json({ success: false, message: 'FIR Draft not found' });
    res.json({ success: true, data: booking });
  } catch (err) { next(err); }
};

exports.updateFIRDraftStatus = async (req, res, next) => {
  try {
    const FIRDraft = require('../models/FIRDraft');
    const Booking = require('../models/Booking');
    const firStatus = ({ pending: 'draft', open: 'submitted', in_progress: 'reviewed', resolved: 'completed', closed: 'completed' })[req.body.status] || req.body.status;
    const updateData = { status: firStatus };
    if (req.body.advocateId !== undefined) {
      updateData.advocate = req.body.advocateId === null ? null : req.body.advocateId;
    }
    const draft = await FIRDraft.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    if (draft) return res.json({ success: true, data: draft });

    const bookingStatus = ({ pending: 'pending_assignment', open: 'confirmed', in_progress: 'in_progress', resolved: 'completed', closed: 'cancelled' })[req.body.status] || req.body.status;
    const bookingUpdate = { status: bookingStatus };
    if (req.body.advocateId !== undefined) bookingUpdate.advocate = req.body.advocateId || null;
    if (req.body.notes !== undefined) bookingUpdate.adminNotes = req.body.notes;
    if (req.body.priority !== undefined) bookingUpdate.priority = req.body.priority;
    if (req.body.paymentStatus !== undefined) bookingUpdate['payment.status'] = req.body.paymentStatus;
    const booking = await Booking.findOneAndUpdate(
      { _id: req.params.id, serviceType: 'fir_draft' }, bookingUpdate, { new: true }
    );
    if (!booking) return res.status(404).json({ success: false, message: 'FIR Draft not found' });
    res.json({ success: true, data: booking });
  } catch (err) { next(err); }
};

exports.uploadFIRDraftDocument = async (req, res, next) => {
  try {
    const cloudinary = require('cloudinary').v2;
    const fs = require('fs');
    const FIRDraft = require('../models/FIRDraft');
    const Booking = require('../models/Booking');

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const isImage = req.file.mimetype?.startsWith('image/');
    const isPdf   = req.file.mimetype?.includes('pdf') || req.file.originalname?.toLowerCase().endsWith('.pdf');
    const resourceType = isImage ? 'image' : isPdf ? 'raw' : 'auto';

    let result;
    if (req.file.path) {
      result = await cloudinary.uploader.upload(req.file.path, { folder: 'legalitt/admin-fir-docs', resource_type: resourceType });
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    } else {
      result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'legalitt/admin-fir-docs', resource_type: resourceType },
          (err, res) => err ? reject(err) : resolve(res)
        );
        stream.end(req.file.buffer);
      });
    }

    const url = result.secure_url;
    
    // Support saving to either adminDocuments or advocateDocuments
    const side = req.body.side || 'admin';
    const docEntry = { url, name: req.file.originalname };
    
    const draft = await FIRDraft.findById(req.params.id).select('_id').lean();
    const field = side === 'advocate' ? 'advocateDocuments' : side === 'client' ? 'evidence' : 'adminDocuments';
    if (draft) {
      await FIRDraft.findByIdAndUpdate(req.params.id, { $push: { [field]: docEntry } });
    } else {
      const bookingField = side === 'advocate' ? 'advocateDocuments' : side === 'client' ? 'documents' : 'adminDocuments';
      const updated = await Booking.findOneAndUpdate(
        { _id: req.params.id, serviceType: 'fir_draft' }, { $push: { [bookingField]: docEntry } }
      );
      if (!updated) return res.status(404).json({ success: false, message: 'FIR Draft not found' });
    }

    res.json({ success: true, data: { url: result.secure_url, name: req.file.originalname } });
  } catch (err) {
    if (req.file?.path) { try { require('fs').unlinkSync(req.file.path); } catch (e) {} }
    next(err);
  }
};

// ─── Delete FIR Draft ─────────────────────────────────────────────────────────
exports.deleteFIRDraft = async (req, res, next) => {
  try {
    const FIRDraft = require('../models/FIRDraft');
    const draft = await FIRDraft.findByIdAndDelete(req.params.id);
    if (!draft) {
      const Booking = require('../models/Booking');
      const booking = await Booking.findOneAndDelete({ _id: req.params.id, serviceType: 'fir_draft' });
      if (!booking) return res.status(404).json({ success: false, message: 'FIR Draft not found.' });
    }
    res.json({ success: true, message: 'FIR Draft deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

// ─── Property Research Admin ──────────────────────────────────────────────────
exports.getPropertyResearch = async (req, res, next) => {
  try {
    const Booking = require('../models/Booking');
    const requests = await Booking.find({ serviceType: 'property_research', 'payment.status': { $in: ['paid', 'not_required'] }, archivedAt: { $exists: false } }).lean()
      .populate('client', 'name email phone')
      .populate({ path: 'advocate', populate: { path: 'user', select: 'name email avatar' } })
      .sort({ createdAt: -1 });

    // Map Booking fields → PropertyResearch interface expected by admin panel
    const mapped = requests.map(b => {
      const meta = b.serviceDetails || b.metadata || {};
      return {
        _id: b._id,
        client: b.client,
        user: b.client, // alias
        // Property fields — stored in serviceDetails or parsed from issue/notes
        propertyAddress: meta.propertyAddress || b.propertyAddress || b.issue || b.issueDescription || b.notes || '—',
        propertyType: meta.propertyType || b.propertyType || '—',
        surveyNumber: meta.surveyNumber || b.surveyNumber || '—',
        registrationNumber: meta.registrationNumber || b.registrationNumber || '—',
        district: meta.district || b.district || '—',
        state: meta.state || b.state || '—',
        purpose: meta.purpose || b.purpose || b.issueDescription || '—',
        advocate: b.advocate,
        status: b.status === 'pending_assignment' ? 'open'
              : b.status === 'pending' ? 'pending'
              : ['confirmed', 'in_progress'].includes(b.status) ? 'in_progress'
              : b.status === 'completed' ? 'resolved'
              : b.status === 'cancelled' ? 'closed'
              : 'open',
        payment: b.payment || (b.amount ? { amount: b.amount, status: b.paymentStatus === 'completed' ? 'paid' : 'pending' } : null),
        documents: b.documents || [],
        adminDocuments: b.adminDocuments || [],
        advocateDocuments: b.advocateDocuments || [],
        notes: b.adminNotes || b.notes || '',
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      };
    });

    res.json({ success: true, data: mapped });
  } catch (err) { next(err); }
};

exports.updatePropertyResearchStatus = async (req, res, next) => {
  try {
    const Booking = require('../models/Booking');
    const STATUS_MAP = { open: 'pending_assignment', pending: 'pending', in_progress: 'in_progress', resolved: 'completed', closed: 'cancelled' };
    const updateData = {};
    if (req.body.status) updateData.status = STATUS_MAP[req.body.status] || req.body.status;
    if (req.body.notes !== undefined) updateData.adminNotes = String(req.body.notes).slice(0, 5000);
    if (req.body.advocateId !== undefined) {
      updateData.advocate = req.body.advocateId === null ? null : req.body.advocateId;
    }
    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('client', 'name email phone');
    if (!updated) return res.status(404).json({ success: false, message: 'Request not found' });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

exports.archivePropertyResearch = async (req, res, next) => {
  try {
    const Booking = require('../models/Booking');
    const archived = await Booking.findOneAndUpdate(
      { _id: req.params.id, serviceType: 'property_research' },
      { $set: { archivedAt: new Date(), archivedBy: req.user._id } },
      { new: true }
    );
    if (!archived) return res.status(404).json({ success: false, message: 'Request not found' });
    res.json({ success: true, message: 'Property research request archived.' });
  } catch (err) { next(err); }
};

exports.uploadPropertyResearchDocument = async (req, res, next) => {
  try {
    const cloudinary = require('cloudinary').v2;
    const fs = require('fs');
    const Booking = require('../models/Booking');

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const isPdf   = req.file.mimetype?.includes('pdf') || req.file.originalname?.toLowerCase().endsWith('.pdf');
    const isImage = req.file.mimetype?.startsWith('image/');
    const resourceType = isImage ? 'image' : isPdf ? 'raw' : 'auto';

    let result;
    if (req.file.path) {
      result = await cloudinary.uploader.upload(req.file.path, { folder: 'legalitt/admin-property-reports', resource_type: resourceType });
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    } else {
      result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'legalitt/admin-property-reports', resource_type: resourceType },
          (err, res) => err ? reject(err) : resolve(res)
        );
        stream.end(req.file.buffer);
      });
    }

    const url = result.secure_url;
    
    // Support saving to either adminDocuments or advocateDocuments
    const side = req.body.side || 'admin';
    const docEntry = { url, name: req.file.originalname, type: isPdf ? 'pdf' : 'image', uploadedAt: new Date() };
    
    if (side === 'advocate') {
      await Booking.findByIdAndUpdate(req.params.id, { $push: { advocateDocuments: docEntry } });
    } else {
      await Booking.findByIdAndUpdate(req.params.id, { $push: { adminDocuments: docEntry } });
    }

    res.json({ success: true, data: { url, name: req.file.originalname } });
  } catch (err) {
    if (req.file?.path) { try { require('fs').unlinkSync(req.file.path); } catch (e) {} }
    next(err);
  }
};

// ─── Document Forensic Admin ──────────────────────────────────────────────────
exports.getDocumentForensic = async (req, res, next) => {
  try {
    const Booking = require('../models/Booking');
    const requests = await Booking.find({
      archivedAt: { $exists: false },
      'payment.status': { $in: ['paid', 'not_required'] },
      $or: [
        { serviceType: 'document_forensic' },
        { serviceType: 'forensic' },
        { serviceType: 'legal_advice', issue: /forensic/i }
      ]
    }).lean()
      .populate('client', 'name email phone')
      .populate({ path: 'advocate', populate: { path: 'user', select: 'name email avatar' } })
      .sort({ createdAt: -1 });
    const mapped = requests.map(b => ({
      ...b,
      status: b.status === 'pending_assignment' ? 'open'
            : b.status === 'pending' ? 'pending'
            : ['confirmed', 'in_progress'].includes(b.status) ? 'in_progress'
            : b.status === 'completed' ? 'resolved'
            : b.status === 'cancelled' ? 'closed'
            : 'open',
      notes: b.adminNotes || b.notes || '',
    }));
    res.json({ success: true, data: mapped });
  } catch (err) { next(err); }
};

exports.updateDocumentForensicStatus = async (req, res, next) => {
  try {
    const Booking = require('../models/Booking');
    const STATUS_MAP = { open: 'pending_assignment', pending: 'pending', in_progress: 'in_progress', resolved: 'completed', closed: 'cancelled' };
    const updateData = {};
    if (req.body.status) updateData.status = STATUS_MAP[req.body.status] || req.body.status;
    if (req.body.notes !== undefined) updateData.adminNotes = String(req.body.notes).slice(0, 5000);
    if (req.body.advocateId !== undefined) {
      updateData.advocate = req.body.advocateId === null ? null : req.body.advocateId;
    }
    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('client', 'name email phone');
    if (!updated) return res.status(404).json({ success: false, message: 'Request not found' });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

exports.archiveDocumentForensic = async (req, res, next) => {
  try {
    const Booking = require('../models/Booking');
    const archived = await Booking.findOneAndUpdate(
      { _id: req.params.id, serviceType: { $in: ['document_forensic', 'forensic'] } },
      { $set: { archivedAt: new Date(), archivedBy: req.user._id } },
      { new: true }
    );
    if (!archived) return res.status(404).json({ success: false, message: 'Request not found' });
    res.json({ success: true, message: 'Document forensic request archived.' });
  } catch (err) { next(err); }
};

exports.uploadDocumentForensicReport = async (req, res, next) => {
  try {
    const cloudinary = require('cloudinary').v2;
    const fs = require('fs');
    const Booking = require('../models/Booking');

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const isPdf   = req.file.mimetype?.includes('pdf') || req.file.originalname?.toLowerCase().endsWith('.pdf');
    const isImage = req.file.mimetype?.startsWith('image/');
    const resourceType = isImage ? 'image' : isPdf ? 'raw' : 'auto';

    let result;
    if (req.file.path) {
      result = await cloudinary.uploader.upload(req.file.path, { folder: 'legalitt/admin-forensic-reports', resource_type: resourceType });
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    } else {
      result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'legalitt/admin-forensic-reports', resource_type: resourceType },
          (err, res) => err ? reject(err) : resolve(res)
        );
        stream.end(req.file.buffer);
      });
    }

    const url = result.secure_url;
    
    // Support saving to either adminDocuments or advocateDocuments
    const side = req.body.side || 'admin';
    const docEntry = { url, name: req.file.originalname, type: isPdf ? 'pdf' : 'image', uploadedAt: new Date() };
    
    if (side === 'advocate') {
      await Booking.findByIdAndUpdate(req.params.id, { $push: { advocateDocuments: docEntry } });
    } else {
      await Booking.findByIdAndUpdate(req.params.id, { $push: { adminDocuments: docEntry } });
    }

    res.json({ success: true, data: { url, name: req.file.originalname } });
  } catch (err) {
    if (req.file?.path) { try { require('fs').unlinkSync(req.file.path); } catch (e) {} }
    next(err);
  }
};

// ─── Legal Notice Admin ───────────────────────────────────────────────────────
exports.getLegalNotices = async (req, res, next) => {
  try {
    const Booking = require('../models/Booking');
    const { status, page = 1, limit = 20, search } = req.query;

    const filter = { serviceType: 'legal_notice', 'payment.status': { $in: ['paid', 'not_required'] } };
    if (status && status !== 'all') filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    let query = Booking.find(filter).lean()
      .populate('client', 'name email phone avatar')
      .populate({ path: 'advocate', populate: { path: 'user', select: 'name email avatar' } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const [bookings, total] = await Promise.all([
      query,
      Booking.countDocuments(filter),
    ]);

    // Map to unified interface
    const mapped = bookings.map(b => ({
      _id: b._id,
      caseNumber: `LN-${b._id.toString().slice(-6).toUpperCase()}`,
      client: b.client,
      advocate: b.advocate,
      status: b.status === 'pending_assignment' ? 'open'
            : b.status === 'confirmed'          ? 'in_progress'
            : b.status === 'completed'          ? 'resolved'
            : b.status === 'cancelled'          ? 'closed'
            : b.status || 'open',
      serviceType: 'legal_notice',
      issueDescription: b.issue || b.issueDescription || '',
      issueCategory: b.issueCategory || '',
      consultationMode: b.consultationMode || 'chat',
      payment: b.payment || null,
      amount: b.amount || 0,
      documents: b.documents || [],
      adminDocuments: b.adminDocuments || [],
      advocateDocuments: b.advocateDocuments || [],
      aiDraft: b.aiDraft || null,
      adminNotes: b.adminNotes || '',
      createdAt: b.createdAt,
      updatedAt: b.updatedAt,
    }));

    res.json({
      success: true,
      data: mapped,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
};

exports.getLegalNoticeDetail = async (req, res, next) => {
  try {
    const Booking = require('../models/Booking');
    const booking = await Booking.findById(req.params.id).lean()
      .populate('client', 'name email phone avatar')
      .populate({ path: 'advocate', populate: { path: 'user', select: 'name email avatar' } });
    if (!booking) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: booking });
  } catch (err) { next(err); }
};

exports.updateLegalNoticeStatus = async (req, res, next) => {
  try {
    const Booking = require('../models/Booking');
    // Map display status → DB status
    const STATUS_MAP = {
      open:        'pending_assignment',
      in_progress: 'confirmed',
      resolved:    'completed',
      closed:      'cancelled',
      pending:     'pending',
    };
    const updateData = {};
    if (req.body.status) updateData.status = STATUS_MAP[req.body.status] || req.body.status;
    if (req.body.adminNotes !== undefined) updateData.adminNotes = req.body.adminNotes;
    if (req.body.advocateId !== undefined) updateData.advocate = req.body.advocateId || null;

    const updated = await Booking.findByIdAndUpdate(
      req.params.id, { $set: updateData }, { new: true }
    ).populate('client', 'name email phone').populate({ path: 'advocate', populate: { path: 'user', select: 'name avatar' } });

    if (!updated) return res.status(404).json({ success: false, message: 'Legal notice not found' });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

exports.uploadLegalNoticeDocument = async (req, res, next) => {
  try {
    const cloudinary = require('cloudinary').v2;
    const fs = require('fs');
    const Booking = require('../models/Booking');

    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

    const isPdf = req.file.mimetype?.includes('pdf') || req.file.originalname?.toLowerCase().endsWith('.pdf');
    const isImage = req.file.mimetype?.startsWith('image/');
    const resourceType = isImage ? 'image' : isPdf ? 'raw' : 'auto';

    let result;
    if (req.file.path) {
      result = await cloudinary.uploader.upload(req.file.path, { folder: 'legalitt/admin-legal-notices', resource_type: resourceType });
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    } else {
      result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: 'legalitt/admin-legal-notices', resource_type: resourceType },
          (err, res) => err ? reject(err) : resolve(res)
        );
        stream.end(req.file.buffer);
      });
    }

    const side = req.body.side || 'admin';
    const docEntry = { url: result.secure_url, name: req.file.originalname, type: isPdf ? 'pdf' : 'image', uploadedAt: new Date() };

    const field = side === 'advocate' ? 'advocateDocuments' : 'adminDocuments';
    await Booking.findByIdAndUpdate(req.params.id, { $push: { [field]: docEntry } });

    res.json({ success: true, data: { url: result.secure_url, name: req.file.originalname } });
  } catch (err) {
    if (req.file?.path) { try { require('fs').unlinkSync(req.file.path); } catch (e) {} }
    next(err);
  }
};

exports.generateLegalNoticeAIDraft = async (req, res, next) => {
  try {
    const Booking = require('../models/Booking');
    const { callAI } = require('../services/aiService');

    const booking = await Booking.findById(req.params.id).lean()
      .populate('client', 'name email');
    if (!booking) return res.status(404).json({ success: false, message: 'Legal notice not found' });

    const clientName   = booking.client?.name || 'Client';
    const issueDesc    = booking.issue || booking.issueDescription || 'Legal matter requiring formal response';
    const issueCategory = booking.issueCategory || 'general';
    const today        = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    const customInstructions = req.body.instructions || '';

    const prompt = `You are a senior Indian advocate drafting a formal legal notice response.

CLIENT: ${clientName}
ISSUE: ${issueDesc}
CATEGORY: ${issueCategory}
DATE: ${today}
${customInstructions ? `ADDITIONAL INSTRUCTIONS: ${customInstructions}` : ''}

Draft a professional, formal legal notice response in Indian legal format. Include:
1. Proper heading (RESPONSE TO LEGAL NOTICE)
2. Date and addressee placeholder
3. Subject line
4. Structured numbered paragraphs
5. Reservation of rights clause
6. Professional closing

Keep it formal, professional, and legally sound. Use Indian legal conventions.`;

    const draftContent = await callAI([{ role: 'user', content: prompt }]);

    // Save the AI draft to the booking
    await Booking.findByIdAndUpdate(req.params.id, { $set: { aiDraft: draftContent } });

    res.json({ success: true, data: { draft: draftContent } });
  } catch (err) { next(err); }
};

exports.assignAdvocateToLegalNotice = async (req, res, next) => {
  try {
    const Booking = require('../models/Booking');
    const { advocateId } = req.body;
    const updated = await Booking.findByIdAndUpdate(
      req.params.id,
      { $set: { advocate: advocateId || null, status: advocateId ? 'confirmed' : 'pending_assignment' } },
      { new: true }
    ).populate('client', 'name email').populate({ path: 'advocate', populate: { path: 'user', select: 'name avatar' } });
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
};

exports.deleteLegalNotice = async (req, res, next) => {
  try {
    const Booking = require('../models/Booking');
    const deleted = await Booking.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Legal notice not found' });
    res.json({ success: true, message: 'Legal notice deleted.' });
  } catch (err) { next(err); }
};
