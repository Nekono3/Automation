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
    return res.status(503).json({ error: 'No active WhatsApp session available' });
  }

  try {
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
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0F172A; color: #F8FAFC; margin: 0; padding: 30px 16px; min-height: 100vh; }
        .header { max-width: 1100px; margin: 0 auto 30px; text-align: center; }
        .header h1 { font-size: 26px; font-weight: 800; margin: 0 0 8px; color: #FFFFFF; }
        .header p { color: #94A3B8; font-size: 14px; margin: 0; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; max-width: 1100px; margin: 0 auto; }
        .card { background: #1E293B; border: 1px solid #334155; border-radius: 20px; padding: 24px; text-align: center; display: flex; flex-direction: column; justify-content: space-between; }
        .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #334155; }
        .title-box { text-align: left; }
        .title-box h2 { font-size: 17px; font-weight: 700; margin: 0; color: #FFFFFF; }
        .title-box .role { font-size: 12px; color: #94A3B8; margin-top: 2px; }
        .badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; }
        .badge.connected { background: rgba(16, 185, 129, 0.15); color: #34D399; border: 1px solid rgba(16, 185, 129, 0.3); }
        .badge.qr_ready { background: rgba(245, 158, 11, 0.15); color: #FBBF24; border: 1px solid rgba(245, 158, 11, 0.3); }
        .badge.disconnected { background: rgba(239, 68, 68, 0.15); color: #F87171; border: 1px solid rgba(239, 68, 68, 0.3); }
        .qr-box { background: #0F172A; border: 2px dashed #475569; border-radius: 14px; padding: 12px; margin: 12px 0 20px; min-height: 220px; display: flex; align-items: center; justify-content: center; }
        .qr-img { width: 190px; height: 190px; border-radius: 8px; display: block; margin: 0 auto; }
        .connected-box { padding: 30px 10px; }
        .phone { font-size: 18px; font-weight: 800; color: #10B981; font-mono: monospace; margin: 10px 0; }
        .info { font-size: 13px; color: #94A3B8; line-height: 1.5; margin-bottom: 16px; }
        .btn { display: inline-block; background: #3B82F6; color: white; padding: 8px 16px; border-radius: 10px; font-size: 13px; font-weight: 600; text-decoration: none; border: none; cursor: pointer; }
        .btn.danger { background: rgba(239, 68, 68, 0.2); color: #FCA5A5; border: 1px solid rgba(239, 68, 68, 0.4); }
        .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #64748B; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📱 Мульти-аккаунт WhatsApp (Consulteam)</h1>
        <p>Каждый номер работает независимо. Диалоги автоматически распределяются и маркируются именем менеджера.</p>
      </div>

      <div class="grid">
        ${sessionList
          .map((s, idx) => {
            const isConn = s.status === 'connected';
            const isQR = s.status === 'qr_ready';
            const num = idx + 1;
            return `
            <div class="card">
              <div class="card-header">
                <div class="title-box">
                  <h2>WhatsApp #${num} (${s.sessionId})</h2>
                  <div class="role">${s.sessionId === 'account_1' ? 'Главный номер (Руководитель)' : 'Рабочий номер (Менеджер)'}</div>
                </div>
                <div class="badge ${s.status}">
                  <span style="width: 7px; height: 7px; border-radius: 50%; background: currentColor;"></span>
                  ${isConn ? 'Подключен' : isQR ? 'Сканируйте QR' : 'Ожидание'}
                </div>
              </div>

              <div class="qr-box">
                ${
                  isConn
                    ? `<div class="connected-box">
                        <div style="font-size: 32px;">✅</div>
                        <div class="phone">+${s.phone}</div>
                        <div class="info">Номер активен и обрабатывает сообщения.</div>
                       </div>`
                    : s.qr_image
                    ? `<img src="${s.qr_image}" class="qr-img" alt="QR" />`
                    : `<div style="color: #64748B; font-size: 13px;">Генерация QR-кода...</div>`
                }
              </div>

              <div>
                <p class="info" style="margin: 0 0 12px; font-size: 12px;">
                  ${
                    isConn
                      ? 'Чтобы привязать другой номер, нажмите «Отключить».'
                      : 'В WhatsApp на телефоне: Связанные устройства → Привязка устройства.'
                  }
                </p>
                ${
                  isConn
                    ? `<button class="btn danger" onclick="disconnect('${s.sessionId}')">Отключить номер</button>`
                    : `<button class="btn" onclick="restart('${s.sessionId}')">Обновить QR-код</button>`
                }
              </div>
            </div>
          `;
          })
          .join('')}
      </div>

      <div class="footer">
        Автообновление статусов каждые 5 секунд • <a href="/dashboard/whatsapp" style="color: #38BDF8;">Управление в CRM Дашборде</a>
      </div>

      <script>
        async function disconnect(id) {
          if (!confirm('Отключить этот WhatsApp аккаунт?')) return;
          await fetch('/api/sessions/' + id + '/logout', { method: 'POST' });
          setTimeout(() => location.reload(), 1000);
        }
        async function restart(id) {
          await fetch('/api/sessions/' + id + '/restart', { method: 'POST' });
          setTimeout(() => location.reload(), 1000);
        }
      </script>
    </body>
    </html>
  `);
});

// Start Express server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[WhatsApp Bridge] Multi-account server running on port ${PORT}`);
  initAllSessions();
});
