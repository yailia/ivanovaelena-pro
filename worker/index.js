import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// Конфигурация
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:4321'];

// Middleware
app.use(express.json());
app.use(cors({
  origin: (origin, callback) => {
    // Разрешаем запросы без origin (например, curl, Postman)
    if (!origin) return callback(null, true);
    
    if (ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// Rate limiting (простая реализация)
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 минута
const RATE_LIMIT_MAX = 5; // максимум 5 запросов в минуту

function isRateLimited(ip) {
  const now = Date.now();
  const record = requestCounts.get(ip);
  
  if (!record || now - record.timestamp > RATE_LIMIT_WINDOW) {
    requestCounts.set(ip, { count: 1, timestamp: now });
    return false;
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return true;
  }
  
  record.count++;
  return false;
}

// Очистка старых записей каждые 5 минут
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of requestCounts) {
    if (now - record.timestamp > RATE_LIMIT_WINDOW) {
      requestCounts.delete(ip);
    }
  }
}, 300000);

// Отправка сообщения в Telegram
async function sendTelegramMessage(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Telegram credentials not configured');
    return false;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: 'HTML'
      })
    });

    const data = await response.json();
    
    if (!data.ok) {
      console.error('Telegram API error:', data);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    return false;
  }
}

// Форматирование сообщения
function formatMessage(data) {
  const { name, email, phone, message } = data;
  const timestamp = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });
  
  return `🔔 <b>Новая заявка с сайта</b>

👤 <b>Имя:</b> ${escapeHtml(name)}
📧 <b>Email:</b> ${escapeHtml(email)}
📱 <b>Телефон:</b> ${phone ? escapeHtml(phone) : 'не указан'}

💬 <b>Сообщение:</b>
${message ? escapeHtml(message) : 'не указано'}

🕐 <i>${timestamp}</i>`;
}

// Экранирование HTML для Telegram
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Валидация данных
function validateData(data) {
  const errors = [];
  
  if (!data.name || data.name.trim().length < 2) {
    errors.push('Имя должно содержать минимум 2 символа');
  }
  
  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    errors.push('Некорректный email');
  }
  
  if (data.phone && !/^[\d\s\+\-\(\)]+$/.test(data.phone)) {
    errors.push('Некорректный формат телефона');
  }
  
  if (data.message && data.message.length > 2000) {
    errors.push('Сообщение слишком длинное (максимум 2000 символов)');
  }
  
  return errors;
}

// Эндпоинт для приёма заявок
app.post('/api/submit', async (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.ip;
  
  // Проверка rate limit
  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      success: false,
      error: 'Слишком много запросов. Попробуйте позже.'
    });
  }
  
  const { name, email, phone, message } = req.body;
  
  // Валидация
  const errors = validateData({ name, email, phone, message });
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors
    });
  }
  
  // Отправка в Telegram
  const telegramMessage = formatMessage({ name, email, phone, message });
  const sent = await sendTelegramMessage(telegramMessage);
  
  if (sent) {
    console.log(`[${new Date().toISOString()}] New submission from ${email}`);
    return res.json({
      success: true,
      message: 'Заявка успешно отправлена'
    });
  } else {
    return res.status(500).json({
      success: false,
      error: 'Ошибка отправки. Попробуйте позже.'
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Worker running on port ${PORT}`);
  console.log(`📡 Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('⚠️  Telegram credentials not configured!');
  }
});

