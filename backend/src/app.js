require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xssClean = require('xss-clean');
const compression = require('compression');

const errorHandler = require('./middlewares/errorHandler');
const notFound = require('./middlewares/notFound');
const logger = require('./utils/logger');
const { getClient: getRedisClient } = require('./config/redis');

const authRoutes = require('./routes/auth');
const advocateRoutes = require('./routes/advocates');
const bookingRoutes = require('./routes/bookings');
const chatRoutes = require('./routes/chats');
const reviewRoutes = require('./routes/reviews');
const paymentRoutes = require('./routes/payments');
const aiRoutes = require('./routes/ai');
const uploadRoutes = require('./routes/uploads');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const walletRoutes = require('./routes/wallet');
const advocateDashboardRoutes = require('./routes/advocateDashboard');
const supportRoutes = require('./routes/support');

const app = express();

// Trust proxy — required when behind nginx / AWS ALB / Render
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      connectSrc: ["'self'"],
    },
  },
  referrerPolicy: { policy: 'same-origin' },
}));

// CORS
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:19000',
  'http://localhost:19006',
  'http://localhost:8082',
  'exp://localhost:8081',
  'exp://10.0.2.2:8081',
].filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow if no origin (mobile) or if it's in allowed list or is a Vercel preview
    if (
      !origin || 
      allowedOrigins.includes(origin) || 
      origin.endsWith('.vercel.app') ||
      (process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_ORIGINS === 'true')
    ) {
      return cb(null, true);
    }
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Sec-Client-Hash', 'x-sec-client-hash'],
}));

// Rate limiting using RedisStore
const mkLimiter = (max, windowMs = 15 * 60 * 1000) => rateLimit({
  windowMs, max,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/v1/', mkLimiter(parseInt(process.env.RATE_LIMIT_MAX) || 100));
app.use('/api/v1/auth/', mkLimiter(20));
app.use('/api/v1/ai/', mkLimiter(10, 60 * 1000));

// Body parsing & sanitization
// 1mb — large enough for bookings with multiple Cloudinary URLs + descriptions
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(mongoSanitize());
app.use(xssClean());
app.use(compression());
app.use('/uploads', express.static('uploads'));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (m) => logger.info(m.trim()) },
    skip: (req) => req.url === '/health',
  }));
}

const healthPayload = () => ({
  success: true, message: 'Legalitt API is running',
  timestamp: new Date().toISOString(),
  environment: process.env.NODE_ENV,
  build: (process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT_SHA || 'local').slice(0, 7),
});

// Health check (Render hits / by default). The build SHA lets CI verify that
// the latest revision is live instead of accepting a healthy older deploy.
app.get('/', (req, res) => res.json(healthPayload()));
app.get('/health', (req, res) => res.json(healthPayload()));

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/advocates', advocateRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/chats', chatRoutes);
app.use('/api/v1/pricing', require('./routes/pricing'));
app.use('/api/v1/reviews', reviewRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/ai', aiRoutes);
app.use('/api/v1/uploads', uploadRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/advocate-dashboard', advocateDashboardRoutes);
app.use('/api/v1/support', supportRoutes);
app.use('/api/v1/fir', require('./routes/firDrafts'));
app.use('/api/v1/users', require('./routes/userProfile'));
app.use('/api/v1/cases', require('./routes/cases'));
app.use('/api/v1/settings', require('./routes/settings'));
app.use('/api/v1/legal-advice', require('./routes/legalAdvice')); // Legal Advice + Legal Notice flow
app.use('/api/v1/ads', require('./routes/ads')); // Public ads fetch for mobile app
app.use('/api/v1/calls', require('./routes/callLog')); // Call history (advocate + client)

app.use(notFound);
app.use(errorHandler);

module.exports = app;
