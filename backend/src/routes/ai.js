const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');

const { callAI, DISCLAIMER } = require('../services/aiService');
const ChatHistory = require('../models/ChatHistory');

const { aiRateLimiter } = require('../middlewares/rateLimiter');
const { requireFeature } = require('../middlewares/platformSettings');

// ── System prompt defined at module scope so both /chat and /stream can use it ──
const SYSTEM_PROMPT = `You are an expert AI Legal Assistant specializing in Indian law.
Provide accurate, structured, and clear legal guidance formatted professionally.

REQUIRED RESPONSE FORMATTING RULES:
1. Main Title & Headings: Begin with a major bold title (e.g. # Title or **Title**). Use clear section headings (e.g., Types of Documents, Process of Analysis, Applicable Laws, Important Notes, Conclusion).
2. Numbered & Bullet Lists: Organize lists with numbered items (1., 2.) or bullet points (•). Ensure clear spacing between items.
3. Legal Terms & References: Explicitly highlight key legal terms and statutes (e.g., Public Documents, Private Documents, Indian Evidence Act, Registration Act, Supreme Court, District Court, Section 17, Article 300A, IPC Section 420, BNSS, FIR).
4. Callouts: Format critical warnings, notes, or tips using Note:, Warning:, Important:, or Tip:.
5. Comparison Tables: Use Markdown tables whenever comparing documents, laws, or procedures.
6. Paragraph Length: Keep paragraphs concise (3-4 lines max).
7. Summary Section: End detailed responses with a 'Summary' section containing 3-5 concise bullet points.
8. Follow-up Questions: Conclude with a 'You may also ask' section offering 3 relevant follow-up questions formatted as bullets.
9. IMPORTANT: Every response MUST be tailored to the user's specific question. Never return a generic template.`;

router.use(requireFeature('aiEnabled'));

// GET /api/ai/history - Get user's chat history with auto-title backfill
router.get('/history', protect, async (req, res, next) => {
  try {
    const history = await ChatHistory.find({ user: req.user.id }).sort({ lastUpdated: -1 });
    
    // Backfill titles for old chats asynchronously
    history.forEach(async (chat) => {
      if (chat.title === 'New Consultation' || chat.title.endsWith('...') || chat.title.length > 40) {
        if (chat.messages.length > 0) {
          try {
            const firstMsg = chat.messages.find(m => m.role === 'user')?.content || chat.messages[0].content;
            const newTitle = await callAI([
              { role: 'user', content: `Generate a 3-5 word concise title for this legal query: "${firstMsg}". Respond with ONLY the title text, no quotes or punctuation.` }
            ]);
            if (newTitle) {
              chat.title = newTitle.replace(/["']/g, '').trim();
              await chat.save();
            }
          } catch (e) { console.log('Backfill title failed for:', chat._id); }
        }
      }
    });

    res.json({ success: true, data: history });
  } catch (err) { next(err); }
});

// POST /api/ai/chat - Send message and save history
router.post('/chat', protect, aiRateLimiter, async (req, res, next) => {
  try {
    const { messages, conversationId: reqConversationId } = req.body;
    let conversationId = reqConversationId;

    console.log('📬 AI Chat Request - ConvID:', conversationId || 'NEW CHAT');
    console.log('💬 Messages count:', messages?.length);

    if (!messages?.length) return next(new AppError('Messages are required.', 400));

    const lastUserMsg = (messages || []).filter(m => m.role === 'user').pop();
    const userMessage = lastUserMsg?.content || messages[messages.length - 1]?.content || 'Legal Query';

    // ── Load full conversation history from DB when continuing a session ──────
    let dbContextMessages = [];
    let chat = null;
    if (conversationId) {
      chat = await ChatHistory.findById(conversationId);
      if (chat && chat.messages?.length > 0) {
        // Use last 8 messages from DB for richer context
        dbContextMessages = chat.messages.slice(-8).map(m => ({ role: m.role, content: m.content }));
        console.log('📚 Loaded', dbContextMessages.length, 'messages from DB for context');
      } else if (!chat) {
        console.log('⚠️ Chat not found for ID:', conversationId);
        conversationId = null; // Reset so a new chat is created
      }
    }

    // Use DB context if available, otherwise use client-provided messages
    const baseMessages = dbContextMessages.length > 0 ? dbContextMessages : messages.slice(-8);
    // Add the new user message if it's not already the last message
    const lastMsg = baseMessages[baseMessages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== userMessage) {
      baseMessages.push({ role: 'user', content: userMessage });
    }

    // Prepend system prompt to first message
    const contextMessages = [...baseMessages];
    if (contextMessages.length > 0) {
      contextMessages[0] = { ...contextMessages[0], content: SYSTEM_PROMPT + '\n\n' + contextMessages[0].content };
    }

    // Call AI
    const rawReply = await callAI(contextMessages);
    const replyWithDisclaimer = rawReply + DISCLAIMER;

    // Save to Database
    if (!chat) {
      // Generate a catchy title using AI for new chats
      let generatedTitle = userMessage.substring(0, 30) + '...';
      try {
        const titleResponse = await callAI([
          { role: 'user', content: `Generate a 3-5 word concise title for this legal query: "${userMessage}". Respond with ONLY the title text, no quotes or punctuation.` }
        ]);
        if (titleResponse) generatedTitle = titleResponse.replace(/["']/g, '').trim();
      } catch (e) {
        console.log('Title generation failed, using fallback');
      }

      chat = new ChatHistory({
        user: req.user.id,
        title: generatedTitle,
        messages: [],
      });
      console.log('🆕 Created new chat with title:', generatedTitle);
    }

    chat.messages.push({ role: 'user', content: userMessage });
    chat.messages.push({ role: 'assistant', content: replyWithDisclaimer });
    chat.lastUpdated = Date.now();
    await chat.save();

    console.log('✅ Chat saved. Total messages:', chat.messages.length);

    res.json({
      success: true,
      data: {
        reply: replyWithDisclaimer,
        conversationId: chat._id,
      },
    });
  } catch (err) {
    logger.error('AI Chat Error:', err.message);
    next(err);
  }
});

// DELETE /api/ai/history/:id - Clear a conversation
router.delete('/history/:id', protect, async (req, res, next) => {
  try {
    await ChatHistory.findOneAndDelete({ _id: req.params.id, user: req.user.id });
    res.json({ success: true, message: 'Conversation deleted' });
  } catch (err) { next(err); }
});

// GET /api/ai/stream - Real-time streaming chat via SSE
router.get('/stream', protect, aiRateLimiter, async (req, res, next) => {
  try {
    const { message, conversationId: reqConversationId } = req.query;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

    let conversationId = reqConversationId;

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullReply = '';

    // ── Load conversation history from DB for context ──────────────────────
    let contextMessages = [];
    let existingChat = null;
    if (conversationId) {
      existingChat = await ChatHistory.findById(conversationId).catch(() => null);
      if (existingChat && existingChat.messages?.length > 0) {
        // Use last 8 messages for rich context
        contextMessages = existingChat.messages.slice(-8).map(m => ({ role: m.role, content: m.content }));
      } else if (!existingChat) {
        conversationId = null; // Conversation not found — start fresh
      }
    }
    contextMessages.push({ role: 'user', content: message });

    // Prepend system prompt to first message only
    contextMessages[0] = { ...contextMessages[0], content: SYSTEM_PROMPT + '\n\n' + contextMessages[0].content };

    // ── Stream from AI ──────────────────────────────────────────────────────
    await callAI(contextMessages, (chunk) => {
      fullReply += chunk;
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    });

    // ── Save to DB after streaming ends ────────────────────────────────────
    const replyWithDisclaimer = fullReply + DISCLAIMER;
    let chat = existingChat;
    if (!chat) {
      // Generate a short title for new sessions
      let title = message.substring(0, 40) + (message.length > 40 ? '...' : '');
      try {
        const titleReply = await callAI([{ role: 'user', content: `Generate a 3-5 word concise title for: "${message}". Respond with ONLY the title text.` }]);
        if (titleReply) title = titleReply.replace(/["']/g, '').trim();
      } catch (_) {}
      chat = new ChatHistory({ user: req.user.id, title, messages: [] });
    }
    chat.messages.push({ role: 'user', content: message });
    chat.messages.push({ role: 'assistant', content: replyWithDisclaimer });
    chat.lastUpdated = Date.now();
    await chat.save();

    res.write(`data: ${JSON.stringify({ done: true, conversationId: chat._id })}\n\n`);
    res.end();

  } catch (err) {
    logger.error('AI Stream Error:', err.message);
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

module.exports = router;
