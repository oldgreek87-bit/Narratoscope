const { createClient } = require("redis");

let redis;

async function getRedis() {
  if (!redis) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL environment variable is not set");
    }
    redis = createClient({ url: redisUrl });
    redis.on("error", (err) => {
      console.error("Redis error:", err);
    });
    await redis.connect();
  }
  return redis;
}

const KEY = "narratoscope:outbox";

module.exports = async function handler(req, res) {
  try {
    const r = await getRedis();

    if (req.method === "GET") {
      const raw = await r.get(KEY);
      const data = raw ? JSON.parse(raw) : [];
      return res.status(200).json({ ok: true, messages: data });
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

      // body.message expected
      if (!body || !body.message) {
        return res.status(400).json({ ok: false, error: "No message" });
      }

      const raw = await r.get(KEY);
      const list = raw ? JSON.parse(raw) : [];

      list.unshift(body.message);
      // ограничим чтобы база не росла бесконечно
      const trimmed = list.slice(0, 200);

      await r.set(KEY, JSON.stringify(trimmed));
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (e) {
    console.error("Handler error:", e);
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
