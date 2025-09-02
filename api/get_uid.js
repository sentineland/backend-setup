import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

function format_date(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function hours_between(date1, date2) {
  try {
    const d1 = new Date(date1.split("/").reverse().join("-"));
    const d2 = new Date(date2.split("/").reverse().join("-"));
    return Math.abs(d2 - d1) / 36e5;
  } catch {
    return Infinity;
  }
}

async function get_uid_list() {
  const raw = await redis.get("uid_list");
  return raw ? JSON.parse(raw) : [];
}

async function set_uid_list(uid_list) {
  await redis.set("uid_list", JSON.stringify(uid_list));
}

async function cleanup_inactive_users() {
  let uid_list = await get_uid_list();
  const today = format_date();
  uid_list = uid_list.filter((u) => hours_between(u.last_execution, today) <= 72);
  uid_list.forEach((u, i) => (u.uid = i + 1));
  await set_uid_list(uid_list);
  console.log(`cleanup done, active users: ${uid_list.length}`);
}

export async function register_or_update_user({ discord_id, discord_username, in_game = false }) {
  const today = format_date();
  let uid_list = await get_uid_list();
  let existing_user = uid_list.find((u) => u.discord_id === discord_id);
  if (existing_user) {
    existing_user.last_execution = today;
    existing_user.in_game = in_game;
  } else {
    uid_list.push({
      discord_id,
      discord_username,
      first_execution: today,
      last_execution: today,
      uid: uid_list.length + 1,
      in_game,
    });
  }
  await set_uid_list(uid_list);
  return existing_user || uid_list[uid_list.length - 1];
}

setInterval(cleanup_inactive_users, 72 * 60 * 60 * 1000);
cleanup_inactive_users();
