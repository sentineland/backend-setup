import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function format_date() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

async function get_uid_list() {
  const raw = await redis.get("uid_list");
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    await redis.set("uid_list", "[]");
    return [];
  }
}

async function set_uid_list(uid_list) {
  await redis.set("uid_list", JSON.stringify(uid_list));
}

async function cleanup_inactive_users() {
  let uid_list = await get_uid_list();
  const today = format_date();
  uid_list = uid_list.filter(u => {
    try {
      const last = new Date(u.last_execution.split("/").reverse().join("-"));
      const now = new Date(today.split("/").reverse().join("-"));
      return Math.abs(now - last) / 36e5 <= 72;
    } catch {
      return false;
    }
  });
  uid_list.forEach((u, i) => u.uid = i + 1);
  await set_uid_list(uid_list);
  console.log(`🧹 Cleanup done. Active users: ${uid_list.length}`);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

    const { discord_id, discord_username, in_game = false } = req.body;
    if (!discord_id || !discord_username) return res.status(400).json({ error: "missing_fields" });

    const today = format_date();
    let uid_list = await get_uid_list();

    let existing_user = uid_list.find(u => u.discord_id === discord_id);
    if (existing_user) {
      existing_user.last_execution = today;
      existing_user.in_game = in_game;
      await set_uid_list(uid_list);
      return res.json(existing_user);
    }

    const new_user = {
      discord_id,
      discord_username,
      first_execution: today,
      last_execution: today,
      uid: uid_list.length + 1,
      in_game,
    };

    uid_list.push(new_user);
    await set_uid_list(uid_list);
    res.json(new_user);

  } catch (err) {
    console.error("Error in get_uid:", err);
    res.status(500).json({ error: "internal_server_error", details: err.message });
  }
}

setInterval(cleanup_inactive_users, 72 * 60 * 60 * 1000);
cleanup_inactive_users();
