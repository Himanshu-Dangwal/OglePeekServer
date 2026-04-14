const express         = require('express');
const cors            = require('cors');
const cookieParser    = require('cookie-parser');
const mongoose        = require('mongoose');
const dotenv          = require('dotenv');
const axios           = require('axios');
const helmet          = require('helmet');

dotenv.config();

// Routes

const adminRoute   = require('../routes/adminRoute');
const authRoute    = require('../routes/authRoute');
const orderRoute   = require('../routes/orderRoute');
const productRoute = require('../routes/productRoute');
const customRoute  = require('../routes/customerRoute');
const cartRoute    = require('../routes/cartRoute');
const variantRoute = require('../routes/variantRoute');
const paymentRoute = require('../routes/paymentRoute');

// App setup

const PORT = process.env.PORT || 8000;
const MONGO_URI = process.env.PROD_URI || 'mongodb://localhost:27017/oglepeek';

const app = express();

// Render (and most PaaS) sit behind a reverse proxy.
// This tells Express to trust the X-Forwarded-* headers so that:
//   • req.ip returns the real client IP (needed for rate-limiting)
//   • secure cookies work over HTTPS even though Express sees HTTP internally
app.set('trust proxy', 1);

const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5174',
    'https://oglepeek-frontend-web.vercel.app',
    'https://oglepeek.dangwalhimanshu.com',
    'http://localhost:3001',
    'https://ogle-peek-client.vercel.app',
    'https://ogle-peek-admin.vercel.app'
];

// ── CORS ─────────────────────────────────────────────────────────────────────
// Must be registered BEFORE helmet and all routes so that preflight OPTIONS
// requests get the correct headers and never hit helmet's restrictions.

const corsOptions = {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

// Handle every OPTIONS preflight explicitly (Express 5 uses regex wildcards)
app.options(/.*/, cors(corsOptions));
app.use(cors(corsOptions));

// ── Security middleware ───────────────────────────────────────────────────────

// Sets secure HTTP headers.
// crossOriginResourcePolicy: false — don't block cross-origin fetches that
// CORS already explicitly allows.
// crossOriginEmbedderPolicy: false — prevents interference with cookies
// across origins in local dev.
app.use(helmet({
    crossOriginResourcePolicy:  false,
    crossOriginEmbedderPolicy:  false,
}));

app.use(express.json());
app.use(cookieParser());

// Strip MongoDB operators ($, .) from req.body to prevent NoSQL injection.
// (express-mongo-sanitize is incompatible with Express 5 — replaced inline)
function sanitizeBody(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    for (const key of Object.keys(obj)) {
        if (key.startsWith('$') || key.includes('.')) {
            delete obj[key];
        } else {
            sanitizeBody(obj[key]);
        }
    }
    return obj;
}
app.use((req, _res, next) => { if (req.body) sanitizeBody(req.body); next(); });

// ── Database ─────────────────────────────────────────────────────────────────

async function connectToMongo() {
    mongoose.set('strictQuery', false);
    try {
        await mongoose.connect(MONGO_URI);
        console.log(`Connected to MongoDB — database: ${mongoose.connection.name}`);
    } catch (err) {
        console.error('Failed to connect to MongoDB:', err.message);
        // Exit so the process manager (PM2, Docker, Render) can restart and alert
        process.exit(1);
    }
}

connectToMongo();

// ── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
    const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    res.json({ status: 'ok', db: dbState });
});

app.use('/api/orders',    orderRoute);
app.use('/api/auth',      authRoute);
app.use('/api/product',   productRoute);
app.use('/api/admin',     adminRoute);
app.use('/api/customers', customRoute);
app.use('/api/cart',      cartRoute);
app.use('/api/variant',   variantRoute);
app.use('/api/payment',   paymentRoute);

app.get('/', (req, res) => res.send('OglePeek Server'));

// ── Global error handler ──────────────────────────────────────────────────────
// Catches anything passed to next(err) — prevents unhandled rejections from
// silently swallowing errors or crashing individual requests.

app.use((err, req, res, next) => {  // eslint-disable-line no-unused-vars
    const status  = err.status || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred. Please try again.'
        : err.message;
    res.status(status).json({ success: false, message });
});

// ── Start server ──────────────────────────────────────────────────────────────

app.listen(PORT, () => {
    console.log(`Server started on PORT ${PORT}`);
});

// ── Keep-alive ping (prevents Render free-tier from sleeping) ─────────────────

const backendURL = process.env.Backend_URL;
if (backendURL) {
    setInterval(() => {
        axios.get(`${backendURL}/health`)
            .catch(() => {
                // Silently ignore — this is just a keep-alive, not critical
            });
    }, 10 * 60 * 1000);
}
