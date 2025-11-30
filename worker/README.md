# Lena Form Worker

Worker для обработки заявок с сайта и отправки уведомлений в Telegram.

## Деплой на Render.com

### 1. Создание Telegram бота

1. Перейдите к [@BotFather](https://t.me/BotFather)
2. Отправьте `/newbot` и следуйте инструкциям
3. Сохраните полученный токен

### 2. Получение Chat ID

1. Перейдите к [@userinfobot](https://t.me/userinfobot) или [@getmyid_bot](https://t.me/getmyid_bot)
2. Отправьте `/start`
3. Бот покажет ваш Chat ID

### 3. Деплой на Render

1. Создайте аккаунт на [render.com](https://render.com)
2. New → Web Service
3. Подключите репозиторий
4. Укажите путь к папке: `worker`
5. Настройте переменные окружения:

| Переменная | Описание |
|------------|----------|
| `TELEGRAM_BOT_TOKEN` | Токен бота от BotFather |
| `TELEGRAM_CHAT_ID` | ID чата для уведомлений |
| `ALLOWED_ORIGINS` | Разрешённые домены через запятую (например: `https://your-site.com`) |

### 4. Настройка на сайте

После деплоя вы получите URL воркера (например: `https://lena-form-worker.onrender.com`).
Этот URL нужно указать в форме на сайте.

## Локальная разработка

```bash
cd worker
npm install
```

Создайте файл `.env`:

```
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
ALLOWED_ORIGINS=http://localhost:4321
PORT=3000
```

Запуск:

```bash
npm run dev
```

## API

### POST /api/submit

Приём заявки с формы.

**Body (JSON):**
```json
{
  "name": "Имя",
  "email": "email@example.com",
  "phone": "+7 999 123 45 67",
  "message": "Текст сообщения"
}
```

**Response (success):**
```json
{
  "success": true,
  "message": "Заявка успешно отправлена"
}
```

### GET /api/og-preview

Парсинг Open Graph метаданных для превью ссылок (как в Telegram).

**Query параметры:**
- `url` — URL страницы для парсинга (обязательный)

**Разрешённые домены:**
- `my.mail.ru`
- `yandex.ru`
- `rutube.ru`
- `1tv.ru`, `www.1tv.ru`

**Пример запроса:**
```
GET /api/og-preview?url=https://www.1tv.ru/shows/...
```

**Response (success):**
```json
{
  "success": true,
  "data": {
    "title": "Название видео",
    "description": "Описание",
    "image": "https://example.com/thumbnail.jpg",
    "siteName": "Первый канал",
    "type": "video"
  }
}
```

### GET /health

Health check для мониторинга.

## Безопасность

- Rate limiting: 5 запросов в минуту с одного IP
- CORS: только разрешённые домены
- Валидация всех входных данных
- Экранирование HTML для Telegram

