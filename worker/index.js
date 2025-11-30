import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

// Конфигурация
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") || [
  "http://localhost:4321",
];

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: (origin, callback) => {
      // Разрешаем запросы без origin только для health check (будет проверено в роуте)
      if (!origin) return callback(null, true);

      if (ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    methods: ["POST", "GET", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Requested-With"],
  })
);

// CSRF защита — проверка заголовка X-Requested-With
function csrfProtection(req, res, next) {
  const origin = req.headers.origin;
  const requestedWith = req.headers["x-requested-with"];

  // Проверяем что запрос пришёл с разрешённого origin
  if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
    return res.status(403).json({
      success: false,
      error: "Forbidden: invalid origin",
    });
  }

  // Проверяем наличие кастомного заголовка (защита от CSRF)
  if (requestedWith !== "XMLHttpRequest") {
    return res.status(403).json({
      success: false,
      error: "Forbidden: missing security header",
    });
  }

  next();
}

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
    console.error("Telegram credentials not configured");
    return false;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: text,
        parse_mode: "HTML",
      }),
    });

    const data = await response.json();

    if (!data.ok) {
      console.error("Telegram API error:", data);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
    return false;
  }
}

// Форматирование блока источника трафика
function formatTrackingInfo(data) {
  const {
    referrer,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
  } = data;

  const parts = [];

  if (referrer) {
    // Извлекаем домен из referrer для краткости
    try {
      const url = new URL(referrer);
      parts.push(`🔗 <b>Откуда:</b> ${escapeHtml(url.hostname)}`);
    } catch {
      parts.push(`🔗 <b>Откуда:</b> ${escapeHtml(referrer)}`);
    }
  }

  if (utm_source) parts.push(`📊 <b>Источник:</b> ${escapeHtml(utm_source)}`);
  if (utm_medium) parts.push(`📢 <b>Канал:</b> ${escapeHtml(utm_medium)}`);
  if (utm_campaign)
    parts.push(`🎯 <b>Кампания:</b> ${escapeHtml(utm_campaign)}`);
  if (utm_term) parts.push(`🔑 <b>Ключевое слово:</b> ${escapeHtml(utm_term)}`);
  if (utm_content)
    parts.push(`📝 <b>Объявление:</b> ${escapeHtml(utm_content)}`);

  if (parts.length === 0) return "";

  return `\n\n📈 <b>Источник трафика:</b>\n${parts.join("\n")}`;
}

// Форматирование сообщения
function formatMessage(data) {
  const {
    name,
    contactMethod,
    contact,
    message,
    email,
    phone,
    date,
    time,
    type,
  } = data;
  const timestamp = new Date().toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
  });

  // Иконка для способа связи
  const methodIcons = {
    telegram: "✈️ Телеграм",
    max: "💬 Max",
    phone: "📱 Телефон",
    email: "📧 Email",
  };

  const contactLabel = methodIcons[contactMethod] || "📞 Контакт";
  const contactValue = contact || email || phone || "не указан";

  // Блок источника трафика
  const trackingInfo = formatTrackingInfo(data);

  // Если это запись на консультацию
  if (type === "booking" && date && time) {
    const formattedDate = new Date(date).toLocaleDateString("ru-RU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    return `📅 <b>НОВАЯ ЗАПИСЬ НА КОНСУЛЬТАЦИЮ</b>

👤 <b>Имя:</b> ${escapeHtml(name)}
${contactLabel}: ${escapeHtml(contactValue)}

🗓 <b>Дата:</b> ${formattedDate}
⏰ <b>Время:</b> ${escapeHtml(time)}${trackingInfo}

🕐 <i>Заявка от ${timestamp}</i>`;
  }

  // Обычная заявка с формы контактов
  return `🔔 <b>Новая заявка с сайта</b>

👤 <b>Имя:</b> ${escapeHtml(name)}
${contactLabel}: ${escapeHtml(contactValue)}

💬 <b>Сообщение:</b>
${message ? escapeHtml(message) : "не указано"}${trackingInfo}

🕐 <i>${timestamp}</i>`;
}

// Экранирование HTML для Telegram
function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Валидация данных
function validateData(data) {
  const errors = [];

  if (!data.name || data.name.trim().length < 2) {
    errors.push("Имя должно содержать минимум 2 символа");
  }

  // Новый формат с выбором способа связи
  if (data.contactMethod && data.contact) {
    const contactTrimmed = data.contact.trim();

    if (!contactTrimmed) {
      errors.push("Укажите контактные данные");
    } else {
      // Валидация email только если выбран способ связи "email"
      if (data.contactMethod === "email") {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactTrimmed)) {
          errors.push("Некорректный email");
        }
      }
      // Валидация телефона только если выбран способ связи "phone"
      if (data.contactMethod === "phone") {
        if (!/^[\d\s\+\-\(\)]+$/.test(contactTrimmed)) {
          errors.push("Некорректный формат телефона");
        }
      }
    }
  }
  // Обратная совместимость со старым форматом
  else if (data.email !== undefined) {
    if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push("Некорректный email");
    }
    if (data.phone && !/^[\d\s\+\-\(\)]+$/.test(data.phone)) {
      errors.push("Некорректный формат телефона");
    }
  }

  if (data.message && data.message.length > 2000) {
    errors.push("Сообщение слишком длинное (максимум 2000 символов)");
  }

  return errors;
}

// Эндпоинт для приёма заявок (с CSRF защитой)
app.post("/api/submit", csrfProtection, async (req, res) => {
  const clientIp = req.headers["x-forwarded-for"] || req.ip;

  // Проверка rate limit
  if (isRateLimited(clientIp)) {
    return res.status(429).json({
      success: false,
      error: "Слишком много запросов. Попробуйте позже.",
    });
  }

  const data = req.body;

  // Валидация
  const errors = validateData(data);
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      errors,
    });
  }

  // Отправка в Telegram
  const telegramMessage = formatMessage(data);
  const sent = await sendTelegramMessage(telegramMessage);

  if (sent) {
    const contact = data.contact || data.email || "unknown";
    console.log(`[${new Date().toISOString()}] New submission from ${contact}`);
    return res.json({
      success: true,
      message: "Заявка успешно отправлена",
    });
  } else {
    return res.status(500).json({
      success: false,
      error: "Ошибка отправки. Попробуйте позже.",
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`🚀 Worker running on port ${PORT}`);
  console.log(`📡 Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("⚠️  Telegram credentials not configured!");
  }
});
