const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const http = require('http');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL || 'http://127.0.0.1:8000/webhooks/whatsapp-bridge';
const AUTH_DIR = process.env.AUTH_DIR || path.join(__dirname, 'auth_info_baileys');

let sock = null;
let currentQR = null;
let qrImageBase64 = null;
let connectionStatus = 'initializing';
let connectedPhone = null;

const logger = pino({ level: 'silent' });

async function initWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: true,
    browser: ['InstaCRM', 'Chrome', '1.0.0'],
    syncFullHistory: false,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = qr;
      connectionStatus = 'qr_ready';
      try {
        qrImageBase64 = await QRCode.toDataURL(qr);
      } catch (err) {
        console.error('Failed to generate QR data URL:', err);
      }
      console.log('[WhatsApp Bridge] New QR code generated. Scan in WhatsApp -> Linked Devices.');
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      connectionStatus = 'disconnected';
      connectedPhone = null;
      currentQR = null;
      qrImageBase64 = null;
      console.log(`[WhatsApp Bridge] Connection closed. Reason: ${statusCode}. Reconnecting: ${shouldReconnect}`);

      if (shouldReconnect) {
        setTimeout(initWhatsApp, 3000);
      } else {
        console.log('[WhatsApp Bridge] Logged out. Please scan QR again.');
        setTimeout(initWhatsApp, 2000);
      }
    } else if (connection === 'open') {
      connectionStatus = 'connected';
      currentQR = null;
      qrImageBase64 = null;
      const jid = sock.user?.id || '';
      connectedPhone = jid.split(':')[0] || jid.split('@')[0];
      console.log(`[WhatsApp Bridge] CONNECTED successfully! Linked Phone: +${connectedPhone}`);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message) continue;

      const remoteJid = msg.key?.remoteJid || '';
      // Ignore status broadcasts and groups
      if (remoteJid.endsWith('@broadcast') || remoteJid.endsWith('@g.us')) continue;

      const isFromMe = msg.key?.fromMe;
      const senderPhone = remoteJid.replace('@s.whatsapp.net', '');
      const senderName = msg.pushName || '';

      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        '';

      if (!text.trim()) continue;

      console.log(`[WhatsApp Bridge] Message ${isFromMe ? 'OUT' : 'IN'} [${senderPhone}]: ${text.slice(0, 50)}`);

      // Forward inbound customer messages to CRM FastAPI Webhook
      if (!isFromMe) {
        try {
          const payload = JSON.stringify({
            sender_phone: senderPhone,
            sender_name: senderName,
            text: text.trim(),
            message_id: msg.key?.id || '',
          });

          const req = http.request(
            CRM_WEBHOOK_URL,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              },
            },
            (res) => {
              if (res.statusCode >= 400) {
                console.error(`[WhatsApp Bridge] CRM returned HTTP ${res.statusCode}`);
              }
            }
          );

          req.on('error', (err) => {
            console.error('[WhatsApp Bridge] Error sending to CRM webhook:', err.message);
          });

          req.write(payload);
          req.end();
        } catch (err) {
          console.error('[WhatsApp Bridge] Failed to forward message to CRM:', err);
        }
      }
    }
  });
}

// ---------------- API Routes ----------------

// 1. Status endpoint
app.get('/status', (req, res) => {
  res.json({
    status: connectionStatus,
    phone: connectedPhone,
    has_qr: Boolean(qrImageBase64),
  });
});

// 2. Beautiful QR Code page in Russian
app.get(['/', '/qr', '/whatsapp-qr'], (req, res) => {
  if (req.headers.accept?.includes('application/json')) {
    return res.json({
      status: connectionStatus,
      phone: connectedPhone,
      qr_image: qrImageBase64,
      raw_qr: currentQR,
    });
  }

  if (connectionStatus === 'connected') {
    return res.send(`
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>WhatsApp подключен | InstaCRM</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F8FAFC; color: #0F172A; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
          .card { background: white; border: 1px solid #E2E8F0; border-radius: 20px; padding: 40px; max-width: 440px; text-align: center; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); }
          .badge { display: inline-flex; align-items: center; gap: 8px; background: #ECFDF5; color: #059669; padding: 6px 14px; border-radius: 9999px; font-weight: 700; font-size: 13px; margin-bottom: 20px; border: 1px solid #A7F3D0; }
          h1 { font-size: 20px; font-weight: 800; margin: 0 0 10px; color: #0F172A; }
          p { font-size: 14px; color: #64748B; margin: 0 0 24px; line-height: 1.5; }
          .phone-box { background: #F1F5F9; border-radius: 12px; padding: 12px; font-mono: monospace; font-size: 16px; font-weight: bold; color: #1E293B; margin-bottom: 24px; }
          .btn { display: inline-block; background: #283876; color: white; text-decoration: none; padding: 12px 24px; border-radius: 12px; font-weight: 700; font-size: 14px; transition: background 0.2s; }
          .btn:hover { background: #1E2C60; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="badge">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: #10B981;"></span>
            Подключено к WhatsApp
          </div>
          <h1>WhatsApp успешно привязан!</h1>
          <p>Ваш номер привязан как рабочее устройство. Все входящие сообщения клиентов автоматически обрабатываются CRM и ИИ.</p>
          <div class="phone-box">+${connectedPhone}</div>
          <a href="/dashboard/conversations" class="btn">Перейти в CRM Inbox</a>
        </div>
      </body>
      </html>
    `);
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Привязка WhatsApp | InstaCRM</title>
      <meta http-equiv="refresh" content="5">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F8FAFC; color: #0F172A; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .card { background: white; border: 1px solid #E2E8F0; border-radius: 24px; padding: 36px; max-width: 440px; text-align: center; box-shadow: 0 10px 30px -5px rgba(0,0,0,0.06); }
        h1 { font-size: 20px; font-weight: 800; margin: 0 0 8px; color: #0F172A; }
        .subtitle { font-size: 13px; color: #64748B; margin: 0 0 24px; }
        .qr-wrapper { background: #F8FAFC; border: 2px dashed #CBD5E1; border-radius: 16px; padding: 16px; display: inline-block; margin-bottom: 24px; }
        .qr-img { width: 260px; height: 260px; display: block; border-radius: 8px; }
        .steps { text-align: left; background: #F1F5F9; border-radius: 14px; padding: 16px; font-size: 13px; color: #334155; margin-bottom: 20px; line-height: 1.6; }
        .steps ol { margin: 0; padding-left: 20px; }
        .steps li { margin-bottom: 4px; }
        .status-pill { font-size: 12px; color: #64748B; display: flex; align-items: center; justify-content: center; gap: 6px; }
        .spinner { width: 10px; height: 10px; border: 2px solid #283876; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    </head>
    <body>
      <div class="card">
        <h1>Подключение WhatsApp к CRM</h1>
        <div class="subtitle">Отсканируйте QR-код для привязки вашего номера к ИИ-ассистенту</div>

        <div class="qr-wrapper">
          ${
            qrImageBase64
              ? `<img src="${qrImageBase64}" class="qr-img" alt="WhatsApp QR Code" />`
              : `<div style="width: 260px; height: 260px; display: flex; align-items: center; justify-content: center; color: #94A3B8; font-size: 13px;">Генерация QR-кода...</div>`
          }
        </div>

        <div class="steps">
          <strong>Инструкция:</strong>
          <ol>
            <li>Откройте WhatsApp на вашем телефоне.</li>
            <li>Нажмите <b>Настройки</b> (или три точки) → <b>Связанные устройства</b>.</li>
            <li>Нажмите <b>Привязка устройства</b>.</li>
            <li>Наведите камеру смартфона на этот QR-код.</li>
          </ol>
        </div>

        <div class="status-pill">
          <div class="spinner"></div>
          <span>Страница обновляется автоматически каждые 5 сек.</span>
        </div>
      </div>
    </body>
    </html>
  `);
});

// 3. Outbound Message Sending API
app.post('/send', async (req, res) => {
  const { to, text } = req.body;

  if (!to || !text) {
    return res.status(400).json({ error: 'Missing "to" or "text" in body' });
  }

  if (connectionStatus !== 'connected' || !sock) {
    return res.status(503).json({ error: 'WhatsApp Bridge not connected' });
  }

  try {
    const cleanPhone = to.replace(/\D/g, '');
    const jid = `${cleanPhone}@s.whatsapp.net`;

    const sent = await sock.sendMessage(jid, { text });
    console.log(`[WhatsApp Bridge] Sent message to ${cleanPhone}: ${text.slice(0, 40)}`);

    res.json({
      success: true,
      message_id: sent.key.id,
      to: cleanPhone,
    });
  } catch (err) {
    console.error(`[WhatsApp Bridge] Error sending to ${to}:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Start Express server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[WhatsApp Bridge] Server running on port ${PORT}`);
  initWhatsApp();
});
