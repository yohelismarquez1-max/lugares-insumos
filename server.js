const http = require("node:http");
const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "places.json");
const DB_FILE = process.env.SQLITE_FILE || path.join(DATA_DIR, "places.sqlite");
const MAX_BODY_BYTES = 30_000;
const FORM_MIN_AGE_MS = 3_000;
const FORM_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const IP_HASH_SECRET = process.env.IP_HASH_SECRET || "local-development-secret";
const VENEZUELA_ENTITIES = [
  "Amazonas",
  "Anzoategui",
  "Apure",
  "Aragua",
  "Barinas",
  "Bolivar",
  "Carabobo",
  "Cojedes",
  "Delta Amacuro",
  "Dependencias Federales",
  "Distrito Capital",
  "Falcon",
  "Guarico",
  "La Guaira",
  "Lara",
  "Merida",
  "Miranda",
  "Monagas",
  "Nueva Esparta",
  "Portuguesa",
  "Sucre",
  "Tachira",
  "Trujillo",
  "Yaracuy",
  "Zulia"
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const seedPlaces = [
  {
    id: "seed-1",
    name: "Centro Comunitario San Martin",
    address: "Av. Central 1240",
    city: "Caracas",
    entity: "Distrito Capital",
    contact: "contacto@centrosm.org",
    urgency: "alta",
    status: "necesita",
    supplies: ["Agua potable", "Panales infantiles", "Alimentos no perecederos"],
    notes: "Reciben donaciones de 9:00 a 18:00. Prioridad para familias evacuadas.",
    createdAt: new Date().toISOString()
  },
  {
    id: "seed-2",
    name: "Comedor Esperanza",
    address: "Calle Norte 88",
    city: "Maracaibo",
    entity: "Zulia",
    contact: "+34 600 123 456",
    urgency: "media",
    status: "necesita",
    supplies: ["Leche", "Arroz", "Articulos de higiene"],
    notes: "Necesitan reposicion para preparar 120 raciones diarias.",
    createdAt: new Date().toISOString()
  }
];

const submissionBuckets = new Map();
let db;

function initDatabase() {
  fsSync.mkdirSync(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_FILE);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS places (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      city TEXT NOT NULL,
      entity TEXT NOT NULL,
      contact TEXT NOT NULL,
      urgency TEXT NOT NULL,
      status TEXT NOT NULL,
      supplies TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      ip_hash TEXT NOT NULL DEFAULT '',
      duplicate_key TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_places_created_at ON places (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_places_location ON places (entity, city);
    CREATE INDEX IF NOT EXISTS idx_places_duplicate_key ON places (duplicate_key);
    CREATE INDEX IF NOT EXISTS idx_places_ip_hash ON places (ip_hash, created_at);

    CREATE TABLE IF NOT EXISTS spam_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_hash TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  migrateInitialData();
}

function migrateInitialData() {
  const row = db.prepare("SELECT COUNT(*) AS count FROM places").get();
  if (row.count > 0) return;

  const initialPlaces = readInitialPlaces();
  const insert = db.prepare(`
    INSERT OR IGNORE INTO places (
      id, name, address, city, entity, contact, urgency, status,
      supplies, notes, created_at, ip_hash, duplicate_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const item of initialPlaces) {
    const place = normalizePlace(item, { preserveId: true, preserveCreatedAt: true });
    const errors = validatePlace(place);
    if (errors.length > 0) continue;
    insert.run(
      place.id,
      place.name,
      place.address,
      place.city,
      place.entity,
      place.contact,
      place.urgency,
      place.status,
      JSON.stringify(place.supplies),
      place.notes,
      place.createdAt,
      "seed",
      duplicateKeyFor(place)
    );
  }
}

function readInitialPlaces() {
  try {
    if (!fsSync.existsSync(DATA_FILE)) return seedPlaces;
    const raw = fsSync.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : seedPlaces;
  } catch {
    return seedPlaces;
  }
}

function readPlaces() {
  return db
    .prepare(
      `SELECT id, name, address, city, entity, contact, urgency, status,
        supplies, notes, created_at
       FROM places
       ORDER BY created_at DESC`
    )
    .all()
    .map(serializePlace);
}

function serializePlace(row) {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    city: row.city,
    entity: row.entity,
    contact: row.contact,
    urgency: row.urgency,
    status: row.status,
    supplies: safeJsonArray(row.supplies),
    notes: row.notes,
    createdAt: row.created_at
  };
}

function safeJsonArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function insertPlace(place, ipHash) {
  db.prepare(
    `INSERT INTO places (
      id, name, address, city, entity, contact, urgency, status,
      supplies, notes, created_at, ip_hash, duplicate_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    place.id,
    place.name,
    place.address,
    place.city,
    place.entity,
    place.contact,
    place.urgency,
    place.status,
    JSON.stringify(place.supplies),
    place.notes,
    place.createdAt,
    ipHash,
    duplicateKeyFor(place)
  );
}

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(JSON.stringify(payload));
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
        const error = new Error("El formulario es demasiado grande.");
        error.statusCode = 413;
        reject(error);
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function cleanText(value, maxLength = 160) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizePlace(input, options = {}) {
  const supplies = Array.isArray(input.supplies)
    ? input.supplies
    : String(input.supplies || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  const id = options.preserveId && input.id ? cleanText(input.id, 80) : crypto.randomUUID();
  const createdAt =
    options.preserveCreatedAt && input.createdAt ? cleanText(input.createdAt, 40) : new Date().toISOString();

  return {
    id,
    name: cleanText(input.name, 100),
    address: cleanText(input.address, 140),
    city: cleanText(input.city, 80),
    entity: VENEZUELA_ENTITIES.includes(input.entity) ? input.entity : "",
    contact: cleanText(input.contact, 120),
    urgency: ["alta", "media", "baja"].includes(input.urgency) ? input.urgency : "media",
    status: ["necesita", "parcial", "cubierto"].includes(input.status) ? input.status : "necesita",
    supplies: supplies.map((item) => cleanText(item, 60)).filter(Boolean).slice(0, 12),
    notes: cleanText(input.notes, 600),
    createdAt
  };
}

function validatePlace(place) {
  const errors = [];
  if (!place.name) errors.push("Indica el nombre del lugar.");
  if (!place.address) errors.push("Indica la direccion.");
  if (!place.city) errors.push("Indica la ciudad o zona.");
  if (!place.entity) errors.push("Selecciona el estado o entidad de Venezuela.");
  if (!place.contact) errors.push("Indica un contacto.");
  if (place.supplies.length === 0) errors.push("Agrega al menos un insumo.");
  return errors;
}

function validateSpam(input, place, ipHash) {
  const reasons = [];
  const errors = [];
  const honeypot = cleanText(input.website || input.homepage || input.url, 200);
  const startedAt = Number(input.startedAt || 0);
  const formAge = Date.now() - startedAt;
  const text = [place.name, place.address, place.city, place.entity, place.contact, place.notes, ...place.supplies].join(" ");
  const urlMatches = text.match(/https?:\/\/|www\.|\.(com|net|org|xyz|info|top)\b/gi) || [];

  if (honeypot) reasons.push("honeypot");
  if (!Number.isFinite(startedAt) || startedAt <= 0) {
    errors.push("Actualiza la pagina e intentalo de nuevo.");
    reasons.push("missing_timer");
  } else if (formAge < FORM_MIN_AGE_MS) {
    errors.push("Espera unos segundos antes de publicar.");
    reasons.push("too_fast");
  } else if (formAge > FORM_MAX_AGE_MS) {
    errors.push("Actualiza la pagina antes de publicar.");
    reasons.push("stale_form");
  }

  if (urlMatches.length > 1) {
    errors.push("Evita publicar varios enlaces en el formulario.");
    reasons.push("too_many_links");
  }

  if (/(.)\1{9,}/i.test(text)) {
    errors.push("Revisa el texto antes de publicarlo.");
    reasons.push("repeated_characters");
  }

  if (/\b(casino|viagra|crypto|bitcoin|forex|apuestas|binance|loan|porn)\b/i.test(text)) {
    errors.push("La publicacion contiene texto que parece spam.");
    reasons.push("blocked_words");
  }

  if (hasRecentDuplicate(place)) {
    errors.push("Ya hay una publicacion muy parecida registrada recientemente.");
    reasons.push("duplicate");
  }

  if (countRecentByIp(ipHash, 24) >= 20) {
    errors.push("Se alcanzo el limite diario de publicaciones desde esta conexion.");
    reasons.push("daily_limit");
  }

  if (honeypot && errors.length === 0) {
    errors.push("No se pudo validar la publicacion. Intentalo de nuevo.");
  }

  return { errors, reasons };
}

function hasRecentDuplicate(place) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const duplicate = db
    .prepare("SELECT id FROM places WHERE duplicate_key = ? AND created_at > ? LIMIT 1")
    .get(duplicateKeyFor(place), since);
  return Boolean(duplicate);
}

function countRecentByIp(ipHash, hours) {
  if (!ipHash) return 0;
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const row = db
    .prepare("SELECT COUNT(*) AS count FROM places WHERE ip_hash = ? AND created_at > ?")
    .get(ipHash, since);
  return row.count;
}

function duplicateKeyFor(place) {
  return [place.name, place.address, place.city, place.entity].map(canonicalize).join("|");
}

function canonicalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function logSpamEvent(ipHash, reasons) {
  if (reasons.length === 0) return;
  const createdAt = new Date().toISOString();
  const insert = db.prepare("INSERT INTO spam_events (ip_hash, reason, created_at) VALUES (?, ?, ?)");
  for (const reason of reasons) insert.run(ipHash, reason, createdAt);
}

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return forwardedFor.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function hashIp(ip) {
  return crypto.createHash("sha256").update(`${IP_HASH_SECRET}:${ip}`).digest("hex");
}

function checkSubmissionRate(ip) {
  const now = Date.now();
  const oneMinute = 60 * 1000;
  const fifteenMinutes = 15 * oneMinute;
  const oneDay = 24 * 60 * oneMinute;
  const current = submissionBuckets.get(ip) || [];
  const recent = current.filter((timestamp) => now - timestamp < oneDay);
  const lastMinute = recent.filter((timestamp) => now - timestamp < oneMinute).length;
  const lastQuarterHour = recent.filter((timestamp) => now - timestamp < fifteenMinutes).length;

  if (lastMinute >= 2) return { allowed: false, retryAfter: 60 };
  if (lastQuarterHour >= 5) return { allowed: false, retryAfter: 15 * 60 };

  recent.push(now);
  submissionBuckets.set(ip, recent);
  if (submissionBuckets.size > 500) cleanupSubmissionBuckets(now, oneDay);
  return { allowed: true, retryAfter: 0 };
}

function cleanupSubmissionBuckets(now, maxAge) {
  for (const [ip, timestamps] of submissionBuckets.entries()) {
    const recent = timestamps.filter((timestamp) => now - timestamp < maxAge);
    if (recent.length === 0) submissionBuckets.delete(ip);
    else submissionBuckets.set(ip, recent);
  }
}

function isAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  return origin === `http://${host}` || origin === `https://${host}`;
}

async function handleApi(req, res) {
  if (req.method === "GET" && req.url === "/api/places") {
    sendJson(res, 200, readPlaces());
    return;
  }

  if (req.method === "POST" && req.url === "/api/places") {
    const ip = getClientIp(req);
    const ipHash = hashIp(ip);
    const rate = checkSubmissionRate(ip);

    if (!rate.allowed) {
      logSpamEvent(ipHash, ["rate_limit"]);
      sendJson(
        res,
        429,
        { errors: ["Hay demasiados intentos seguidos. Espera un momento e intentalo de nuevo."] },
        { "Retry-After": String(rate.retryAfter) }
      );
      return;
    }

    if (!isAllowedOrigin(req)) {
      logSpamEvent(ipHash, ["origin"]);
      sendJson(res, 403, { errors: ["Origen no permitido."] });
      return;
    }

    try {
      const body = await collectBody(req);
      const input = JSON.parse(body || "{}");
      const place = normalizePlace(input);
      const errors = validatePlace(place);
      const spam = errors.length === 0 ? validateSpam(input, place, ipHash) : { errors: [], reasons: [] };

      if (spam.reasons.length > 0) logSpamEvent(ipHash, spam.reasons);
      if (errors.length > 0 || spam.errors.length > 0) {
        sendJson(res, 400, { errors: [...errors, ...spam.errors] });
        return;
      }

      insertPlace(place, ipHash);
      sendJson(res, 201, place);
    } catch (error) {
      sendJson(res, error.statusCode || 400, { errors: [error.message || "No se pudo guardar la publicacion."] });
    }
    return;
  }

  sendJson(res, 404, { errors: ["Ruta no encontrada."] });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
  const requestedPath = safePath === "/" ? "/index.html" : safePath;
  const filePath = path.join(PUBLIC_DIR, requestedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const contentType = MIME_TYPES[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(file);
  } catch {
    const fallback = await fs.readFile(path.join(PUBLIC_DIR, "index.html"));
    res.writeHead(200, { "Content-Type": MIME_TYPES[".html"] });
    res.end(fallback);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }

    await serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { errors: [error.message || "Error interno."] });
  }
});

initDatabase();
server.listen(PORT, () => {
  console.log(`Aplicacion disponible en http://localhost:${PORT}`);
  console.log(`Base de datos SQLite: ${DB_FILE}`);
});
