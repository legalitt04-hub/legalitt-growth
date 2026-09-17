// controllers/chatController.js
const { Chat, Message } = require('../models/Chat');
const { AppError } = require('../middlewares/errorHandler');

// GET /api/chats  — user's chat list (excludes soft-deleted)
exports.getMyChats = async (req, res, next) => {
  try {
    const chats = await Chat.find({
      participants: req.user._id,
      isActive: true,
      hiddenFor: { $nin: [req.user._id] }, // exclude chats hidden by this user
    }).lean()
      .populate('participants', 'name avatar role')
      .populate('lastMessage')
      .populate('booking', 'date status payment.amount')
      .sort({ updatedAt: -1 })
      .lean();

    // Real unread count per chat (excluding messages deleted for this user)
    const chatsWithUnread = await Promise.all(chats.map(async (chat) => {
      const unreadCount = await Message.countDocuments({
        chat:       chat._id,
        sender:     { $ne: req.user._id },
        readAt:     null,
        deletedFor: { $ne: req.user._id },
      });
      return { ...chat, unreadCount };
    }));

    res.json({ success: true, data: chatsWithUnread });
  } catch (err) { next(err); }
};

// GET /api/chats/:id/messages
exports.getMessages = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return next(new AppError('Chat not found.', 404));

    const isParticipant = chat.participants.some(
      p => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) return next(new AppError('Not authorized.', 403));

    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const messages = await Message.find({
      chat:       req.params.id,
      deletedFor: { $ne: req.user._id },
    }).lean()
      .populate('sender', 'name avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    res.json({ success: true, data: messages.reverse() });
  } catch (err) { next(err); }
};

// Explicit read action also works when the realtime connection is unavailable.
exports.markRead = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return next(new AppError('Chat not found.', 404));
    if (!chat.participants.some(p => p.toString() === req.user._id.toString())) return next(new AppError('Not authorized.', 403));
    const readAt = new Date();
    await Message.updateMany({ chat: chat._id, sender: { $ne: req.user._id }, readAt: null }, { $set: { readAt } });
    req.app.get('io')?.to(`chat:${chat._id}`).emit('messages_read', { chatId: String(chat._id), userId: String(req.user._id), readAt });
    res.json({ success: true });
  } catch (err) { next(err); }
};

// POST /api/chats/:id/messages  (REST fallback — socket is preferred)
exports.sendMessage = async (req, res, next) => {
  try {
    const { content, messageType = 'text', fileUrl, fileName } = req.body;
    const chat = await Chat.findById(req.params.id);
    if (!chat) return next(new AppError('Chat not found.', 404));

    const isParticipant = chat.participants.some(
      p => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) return next(new AppError('Not authorized.', 403));

    const message = await Message.create({
      chat: chat._id,
      sender: req.user._id,
      content,
      messageType,
      fileUrl,
      fileName,
    });
    await Chat.findByIdAndUpdate(chat._id, { lastMessage: message._id });

    const populated = await message.populate('sender', 'name avatar');
    res.status(201).json({ success: true, data: populated });
  } catch (err) { next(err); }
};

// DELETE /api/chats/:id  — soft-delete for requesting user only
// The other participant still sees the chat; messages marked deletedFor requester
exports.deleteChat = async (req, res, next) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return next(new AppError('Chat not found.', 404));

    const isParticipant = chat.participants.some(
      p => p.toString() === req.user._id.toString()
    );
    if (!isParticipant) return next(new AppError('Not authorized.', 403));

    // Hide from this user's chat list
    await Chat.findByIdAndUpdate(req.params.id, {
      $addToSet: { hiddenFor: req.user._id },
    });

    // Mark all messages as deleted for this user
    await Message.updateMany(
      { chat: req.params.id },
      { $addToSet: { deletedFor: req.user._id } }
    );

    res.json({ success: true, message: 'Conversation deleted successfully.' });
  } catch (err) { next(err); }
};
