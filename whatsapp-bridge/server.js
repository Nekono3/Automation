const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const http = require('http');
const fs = require('fs');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3001;
const CRM_WEBHOOK_URL = process.env.CRM_WEBHOOK_URL || 'http://127.0.0.1:8000/webhooks/whatsapp-bridge';
const AUTH_BASE_DIR = process.env.AUTH_DIR || path.join(__dirname, 'auth_info_baileys');

if (!fs.existsSync(AUTH_BASE_DIR)) {
  fs.mkdirSync(AUTH_BASE_DIR, { recursive: true });
}

// Map of active sessions: sessionId -> SessionState
const sessions = new Map();
const logger = pino({ level: 'silent' });

/**
 * Migrate legacy single-account auth files to account_1 if needed
 */
function migrateLegacyAuthIfNeeded() {
  const legacyCreds = path.join(AUTH_BASE_DIR, 'creds.json');
  const account1Dir = path.join(AUTH_BASE_DIR, 'account_1');
  const acc1Creds = path.join(account1Dir, 'creds.json');

  if (fs.existsSync(legacyCreds) && !fs.existsSync(acc1Creds)) {
    console.log('[WhatsApp Bridge] Migrating legacy auth files to account_1...');
    fs.mkdirSync(account1Dir, { recursive: true });
    const files = fs.readdirSync(AUTH_BASE_DIR);
    for (const file of files) {
      const fullPath = path.join(AUTH_BASE_DIR, file);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        try {
          fs.copyFileSync(fullPath, path.join(account1Dir, file));
        } catch (e) {
          console.error(`Failed to copy ${file}:`, e);
        }
      }
    }
    console.log('[WhatsApp Bridge] Migration to account_1 complete.');
  }
}

class SessionInstance {
  constructor(sessionId, options = {}) {
    this.sessionId = sessionId;
    this.name = options.name || sessionId;
    this.role = options.role || 'Менеджер';
    this.authDir = path.join(AUTH_BASE_DIR, sessionId);
    this.sock = null;
    this.currentQR = null;
    this.qrImageBase64 = null;
    this.connectionStatus = 'initializing';
    this.connectedPhone = null;
    this.knownJids = {};
    this.jidCacheFile = path.join(this.authDir, 'jid_cache.json');
    this.reconnectTimeout = null;

    if (!fs.existsSync(this.authDir)) {
      fs.mkdirSync(this.authDir, { recursive: true });
    }
    this.loadJidCache();
  }

  loadJidCache() {
    try {
      if (fs.existsSync(this.jidCacheFile)) {
        this.knownJids = JSON.parse(fs.readFileSync(this.jidCacheFile, 'utf8'));
      }
    } catch (e) {}
  }

  rememberJid(clean, fullJid) {
    if (!clean || !fullJid) return;
    this.knownJids[clean] = fullJid;
    try {
      fs.writeFileSync(this.jidCacheFile, JSON.stringify(this.knownJids, null, 2), 'utf8');
    } catch (e) {}
  }

  async start() {
    console.log(`[WhatsApp Bridge][${this.sessionId}] Initializing socket...`);
    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

      this.sock = makeWASocket({
        auth: state,
        logger,
        printQRInTerminal: false,
        browser: ['ConsulteamCRM', 'Chrome', '1.0.0'],
        syncFullHistory: false,
      });

      this.sock.ev.on('creds.update', saveCreds);

      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.currentQR = qr;
          this.connectionStatus = 'qr_ready';
          try {
            this.qrImageBase64 = await QRCode.toDataURL(qr);
          } catch (err) {
            console.error(`[WhatsApp Bridge][${this.sessionId}] QR Error:`, err);
          }
          console.log(`[WhatsApp Bridge][${this.sessionId}] New QR generated for pairing.`);
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          this.connectionStatus = 'disconnected';
          this.connectedPhone = null;
          this.currentQR = null;
          this.qrImageBase64 = null;

          console.log(`[WhatsApp Bridge][${this.sessionId}] Closed. Code: ${statusCode}. Reconnect: ${shouldReconnect}`);

          if (shouldReconnect) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = setTimeout(() => this.start(), 3000);
          } else {
            console.log(`[WhatsApp Bridge][${this.sessionId}] Logged out. Resetting session credentials.`);
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = setTimeout(() => this.start(), 2000);
          }
        } else if (connection === 'open') {
          this.connectionStatus = 'connected';
          this.currentQR = null;
          this.qrImageBase64 = null;
          const jid = this.sock.user?.id || '';
          this.connectedPhone = jid.split(':')[0] || jid.split('@')[0];
          console.log(`[WhatsApp Bridge][${this.sessionId}] CONNECTED! Phone: +${this.connectedPhone}`);
        }
      });

      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (!msg.message) continue;

          const remoteJid = msg.key?.remoteJid || '';
          if (remoteJid.endsWith('@broadcast') || remoteJid.endsWith('@g.us')) continue;

          const isFromMe = msg.key?.fromMe;

          const cleanRemote = remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '');
          this.rememberJid(cleanRemote, remoteJid);
          this.rememberJid(remoteJid, remoteJid);

          const participant = msg.key?.participant || '';
          let displayPhone = '';
          if (participant.endsWith('@s.whatsapp.net')) {
            displayPhone = participant.replace('@s.whatsapp.net', '');
          } else if (remoteJid.endsWith('@s.whatsapp.net')) {
            displayPhone = remoteJid.replace('@s.whatsapp.net', '');
          } else {
            displayPhone = remoteJid;
          }
          const senderName = msg.pushName || '';

          // Check for message revocation ("Delete for everyone")
          const protocolMsg = msg.message?.protocolMessage;
          if (protocolMsg && protocolMsg.type === 0 && protocolMsg.key?.id) {
            console.log(`[WhatsApp Bridge][${this.sessionId}] Detected message revocation for ID: ${protocolMsg.key.id}`);
            this.forwardToCRM({
              account_id: this.sessionId,
              event_type: 'revoke',
              revoked_message_id: protocolMsg.key.id,
            });
            continue;
          }

          const text =
            msg.message?.conversation ||
            msg.message?.extendedTextMessage?.text ||
            msg.message?.imageMessage?.caption ||
            '';

          if (!text.trim()) continue;

          console.log(`[WhatsApp Bridge][${this.sessionId}] ${isFromMe ? 'OUT' : 'IN'} [${remoteJid}]: ${text.slice(0, 50)}`);

          if (!isFromMe) {
            this.forwardToCRM({
              account_id: this.sessionId,
              sender_phone: displayPhone,
              sender_name: senderName,
              sender_jid: remoteJid,
              text: text.trim(),
              message_id: msg.key?.id || '',
            });
          }
        }
      });

      this.sock.ev.on('messages.update', (updates) => {
        for (const update of updates) {
          if (update.update?.message === null && update.key?.id) {
            console.log(`[WhatsApp Bridge][${this.sessionId}] Message deleted in WhatsApp: ${update.key.id}`);
            this.forwardToCRM({
              account_id: this.sessionId,
              event_type: 'revoke',
              revoked_message_id: update.key.id,
            });
          }
        }
      });
    } catch (err) {
      console.error(`[WhatsApp Bridge][${this.sessionId}] Start error:`, err);
    }
  }

  forwardToCRM(payloadObj) {
    try {
      const payload = JSON.stringify(payloadObj);
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
            console.error(`[WhatsApp Bridge][${this.sessionId}] CRM returned HTTP ${res.statusCode}`);
          }
        }
      );
      req.on('error', (err) => {
        console.error(`[WhatsApp Bridge][${this.sessionId}] CRM forward error:`, err.message);
      });
      req.write(payload);
      req.end();
    } catch (err) {
      console.error(`[WhatsApp Bridge][${this.sessionId}] Forward payload error:`, err);
    }
  }

  async logout() {
    clearTimeout(this.reconnectTimeout);
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (e) {}
    }
    this.connectionStatus = 'disconnected';
    this.connectedPhone = null;
    this.currentQR = null;
    this.qrImageBase64 = null;

    // Remove auth folder contents
    try {
      if (fs.existsSync(this.authDir)) {
        fs.rmSync(this.authDir, { recursive: true, force: true });
        fs.mkdirSync(this.authDir, { recursive: true });
      }
    } catch (e) {
      console.error(`[WhatsApp Bridge][${this.sessionId}] Error clearing auth dir:`, e);
    }
    // Restart to trigger fresh QR
    setTimeout(() => this.start(), 1500);
  }

  async restart() {
    clearTimeout(this.reconnectTimeout);
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch (e) {}
    }
    this.connectionStatus = 'initializing';
    setTimeout(() => this.start(), 1000);
  }

  getStatus() {
    return {
      sessionId: this.sessionId,
      name: this.name,
      role: this.role,
      status: this.connectionStatus,
      phone: this.connectedPhone,
      has_qr: Boolean(this.qrImageBase64),
      qr_image: this.qrImageBase64,
      raw_qr: this.currentQR,
    };
  }

  async sendMessage(to, text) {
    if (this.connectionStatus !== 'connected' || !this.sock) {
      throw new Error(`WhatsApp session [${this.sessionId}] is not connected`);
    }

    const clean = String(to).replace('+', '').trim();
    let jid;

    if (clean.includes('@')) {
      jid = clean;
    } else if (this.knownJids[clean]) {
      jid = this.knownJids[clean];
    } else if (clean.length >= 14 && !clean.startsWith('996') && !clean.startsWith('7') && !clean.startsWith('1')) {
      jid = `${clean}@lid`;
    } else {
      jid = `${clean.replace(/\D/g, '')}@s.whatsapp.net`;
    }

    let sent;
    try {
      sent = await this.sock.sendMessage(jid, { text });
      console.log(`[WhatsApp Bridge][${this.sessionId}] Sent to ${jid}: ${text.slice(0, 40)}`);
    } catch (sendErr) {
      if (jid.endsWith('@s.whatsapp.net')) {
        const fallbackLid = `${jid.replace('@s.whatsapp.net', '')}@lid`;
        console.warn(`[WhatsApp Bridge][${this.sessionId}] Error sending to ${jid}. Retrying fallback to ${fallbackLid}...`);
        sent = await this.sock.sendMessage(fallbackLid, { text });
        jid = fallbackLid;
        console.log(`[WhatsApp Bridge][${this.sessionId}] Fallback sent to ${jid}: ${text.slice(0, 40)}`);
      } else {
        throw sendErr;
      }
    }

    return {
      success: true,
      message_id: sent?.key?.id,
      to: jid,
      session_id: this.sessionId,
    };
  }
}

function getOrCreateSession(sessionId, options = {}) {
  if (!sessions.has(sessionId)) {
    const session = new SessionInstance(sessionId, options);
    sessions.set(sessionId, session);
    session.start();
  }
  return sessions.get(sessionId);
}

// Initialize default sessions: account_1, account_2, account_3
function initAllSessions() {
  migrateLegacyAuthIfNeeded();

  // Scan existing session directories
  const defaults = ['account_1', 'account_2', 'account_3'];
  const dirs = fs.readdirSync(AUTH_BASE_DIR).filter((f) => {
    try {
      return fs.statSync(path.join(AUTH_BASE_DIR, f)).isDirectory();
    } catch (e) {
      return false;
    }
  });

  const allToInit = Array.from(new Set([...defaults, ...dirs]));
  console.log(`[WhatsApp Bridge] Initializing ${allToInit.length} WhatsApp sessions: ${allToInit.join(', ')}`);

  for (const sessionId of allToInit) {
    getOrCreateSession(sessionId);
  }
}

// ---------------- REST API ----------------

// List all sessions
app.get('/api/sessions', (req, res) => {
  const result = {};
  for (const [id, session] of sessions.entries()) {
    result[id] = session.getStatus();
  }
  res.json({ sessions: result });
});

// Single session status
app.get('/api/sessions/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session.getStatus());
});

// Create / Start session
app.post('/api/sessions/start', (req, res) => {
  const { sessionId, name, role } = req.body;
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing sessionId' });
  }
  const session = getOrCreateSession(sessionId, { name, role });
  res.json({ status: 'ok', session: session.getStatus() });
});

// Logout / Disconnect session
app.post('/api/sessions/:sessionId/logout', async (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  await session.logout();
  res.json({ status: 'ok', message: `Session ${req.params.sessionId} logged out` });
});

// Restart session
app.post('/api/sessions/:sessionId/restart', async (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  await session.restart();
  res.json({ status: 'ok', message: `Session ${req.params.sessionId} restarted` });
});

// Legacy backward-compatible status
app.get('/status', (req, res) => {
  const acc1 = sessions.get('account_1');
  if (acc1) {
    return res.json(acc1.getStatus());
  }
  const first = Array.from(sessions.values())[0];
  res.json(first ? first.getStatus() : { status: 'none', phone: null, has_qr: false });
});

// Outbound Send
app.post('/send', async (req, res) => {
  const { to, text, account_id } = req.body;

  if (!to || !text) {
    return res.status(400).json({ error: 'Missing "to" or "text" in body' });
  }

  let session = null;
  if (account_id && sessions.has(account_id)) {
    session = sessions.get(account_id);
  } else if (sessions.has('account_1') && sessions.get('account_1').connectionStatus === 'connected') {
    session = sessions.get('account_1');
  } else {
    // Pick first connected session
    for (const s of sessions.values()) {
      if (s.connectionStatus === 'connected') {
        session = s;
        break;
      }
    }
  }

  if (!session || session.connectionStatus !== 'connected') {
    console.error(`[WhatsApp Bridge] Cannot send to ${to}: requested session [${account_id}] is not connected.`);
    return res.status(503).json({ error: `WhatsApp session '${account_id || 'default'}' is not connected` });
  }

  try {
    console.log(`[WhatsApp Bridge] Sending WhatsApp message to ${to} via session [${session.sessionId}] (requested: ${account_id || 'auto'})`);
    const result = await session.sendMessage(to, text);
    res.json(result);
  } catch (err) {
    console.error(`[WhatsApp Bridge] Send error:`, err);
    res.status(500).json({ error: err.message });
  }
});

// Multi-account QR scan web page
app.get(['/', '/qr', '/whatsapp-qr'], (req, res) => {
  if (req.headers.accept?.includes('application/json')) {
    const result = {};
    for (const [id, session] of sessions.entries()) {
      result[id] = session.getStatus();
    }
    return res.json({ sessions: result });
  }

  const sessionList = Array.from(sessions.values()).map((s) => s.getStatus());

  res.send(`
    <!DOCTYPE html>
    <html lang="ru">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Подключение WhatsApp | Consulteam CRM</title>
      <meta http-equiv="refresh" content="5">
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background: #F8FAFC;
          color: #0F172A;
          margin: 0;
          padding: 36px 16px 60px;
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }
        .header { max-width: 1100px; margin: 0 auto 32px; text-align: center; }
        .header .eyebrow {
          display: inline-block;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #283876;
          background: #EEF2FF;
          padding: 4px 12px;
          border-radius: 9999px;
          margin-bottom: 12px;
        }
        .header h1 { font-size: 26px; font-weight: 800; margin: 0 0 8px; color: #0F172A; }
        .header p { color: #64748B; font-size: 14px; margin: 0 auto; max-width: 650px; line-height: 1.5; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; max-width: 1100px; margin: 0 auto; }
        .card {
          background: #FFFFFF;
          border: 1px solid #E2E8F0;
          border-radius: 18px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .card.is-main {
          border: 2px solid rgba(40, 56, 118, 0.25);
          box-shadow: 0 4px 20px rgba(40, 56, 118, 0.08);
        }
        .card-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #F1F5F9; }
        .title-box { text-align: left; }
        .title-box h2 { font-size: 17px; font-weight: 700; margin: 0; color: #0F172A; display: flex; align-items: center; gap: 8px; }
        .title-box .main-pill {
          font-size: 10px;
          font-weight: 700;
          color: #283876;
          background: #EFF6FF;
          border: 1px solid #BFDBFE;
          padding: 2px 8px;
          border-radius: 6px;
        }
        .title-box .role { font-size: 12px; color: #64748B; margin-top: 4px; font-weight: 500; }
        .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; white-space: nowrap; }
        .badge.connected { background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; }
        .badge.qr_ready { background: #FFFBEB; color: #B45309; border: 1px solid #FDE68A; }
        .badge.disconnected { background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; }
        .qr-box {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 14px;
          padding: 16px;
          margin: 8px 0 16px;
          min-height: 230px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .qr-img {
          width: 185px;
          height: 185px;
          border-radius: 10px;
          display: block;
          margin: 0 auto;
          background: #FFFFFF;
          padding: 8px;
          border: 1px solid #E2E8F0;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }
        .connected-box { padding: 16px 10px; }
        .icon-circle {
          width: 52px;
          height: 52px;
          border-radius: 14px;
          background: #D1FAE5;
          color: #059669;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          margin: 0 auto 12px;
          border: 1px solid #A7F3D0;
        }
        .phone { font-size: 19px; font-weight: 800; color: #0F172A; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 4px 0 6px; }
        .info { font-size: 12px; color: #64748B; line-height: 1.5; margin: 0; }
        .tip-box {
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          padding: 10px 14px;
          font-size: 12px;
          color: #475569;
          line-height: 1.5;
          margin-bottom: 16px;
          text-align: left;
        }
        .btn {
          display: block;
          width: 100%;
          background: #283876;
          color: #FFFFFF;
          padding: 10px 16px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
          border: none;
          cursor: pointer;
          transition: background-color 0.15s;
          box-shadow: 0 1px 2px rgba(40, 56, 118, 0.2);
        }
        .btn:hover { background: #1E2C60; }
        .btn.danger {
          background: #FFF1F2;
          color: #BE123C;
          border: 1px solid #FECDD3;
          box-shadow: none;
        }
        .btn.danger:hover { background: #FFE4E6; }
        .footer {
          text-align: center;
          margin-top: 36px;
          font-size: 13px;
          color: #64748B;
        }
        .footer a {
          color: #283876;
          font-weight: 700;
          text-decoration: none;
        }
        .footer a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="eyebrow">Мульти-аккаунт WhatsApp</div>
        <h1>Подключение номеров компании</h1>
        <p>Каждый номер работает независимо. Входящие и исходящие сообщения отображаются в едином Inbox CRM с указанием ответственного сотрудника.</p>
      </div>

      <div class="grid">
        ${sessionList
          .map((s, idx) => {
            const isConn = s.status === 'connected';
            const isQR = s.status === 'qr_ready';
            const isMain = s.sessionId === 'account_1';
            const num = idx + 1;
            return `
            <div class="card ${isMain ? 'is-main' : ''}">
              <div class="card-header">
                <div class="title-box">
                  <h2>
                    WhatsApp #${num}
                    ${isMain ? '<span class="main-pill">Главный</span>' : ''}
                  </h2>
                  <div class="role">${isMain ? 'Руководитель (Главный номер)' : 'Рабочий менеджер'} • ${s.sessionId}</div>
                </div>
                <div class="badge ${s.status}">
                  <span style="width: 7px; height: 7px; border-radius: 50%; background: currentColor;"></span>
                  ${isConn ? 'Подключен' : isQR ? 'Ожидает QR' : 'Отключен'}
                </div>
              </div>

              <div class="qr-box">
                ${
                  isConn
                    ? `<div class="connected-box">
                        <div class="icon-circle">✓</div>
                        <div class="phone">+${s.phone}</div>
                        <p class="info">Номер активен и синхронизирован с CRM.</p>
                       </div>`
                    : s.qr_image
                    ? `<div>
                         <img src="${s.qr_image}" class="qr-img" alt="WhatsApp QR Code" />
                         <div style="font-size: 11px; color: #94A3B8; margin-top: 6px;">QR обновляется автоматически</div>
                       </div>`
                    : `<div style="color: #94A3B8; font-size: 13px;">Генерация QR-кода…</div>`
                }
              </div>

              <div>
                <div class="tip-box">
                  ${
                    isConn
                      ? 'Устройство привязано. Чтобы подключить другой номер, нажмите «Отвязать номер».'
                      : 'В WhatsApp на телефоне откройте: <strong>Связанные устройства → Привязка устройства</strong> и наведите камеру.'
                  }
                </div>
                ${
                  isConn
                    ? `<button class="btn danger" onclick="disconnect('${s.sessionId}')">Отвязать номер</button>`
                    : `<button class="btn" onclick="restart('${s.sessionId}')">Обновить QR-код</button>`
                }
              </div>
            </div>
          `;
          })
          .join('')}
      </div>

      <div class="footer">
        Автообновление статусов каждые 5 сек • <a href="/dashboard/whatsapp">Перейти в панель CRM Дашборда →</a>
      </div>

      <script>
        async function disconnect(id) {
          if (!confirm('Отключить этот WhatsApp аккаунт? Потребуется повторное сканирование QR.')) return;
          await fetch('/api/sessions/' + id + '/logout', { method: 'POST' });
          setTimeout(() => location.reload(), 1000);
        }
        async function restart(id) {
          await fetch('/api/sessions/' + id + '/restart', { method: 'POST' });
          setTimeout(() => location.reload(), 1000);
        }
    </body>
    </html>
  `);
});

// Start Express server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[WhatsApp Bridge] Multi-account server running on port ${PORT}`);
  initAllSessions();
});
