import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

function daysBetween(date1, date2) {
  const [d1, m1, y1] = date1.split('/').map(Number);
  const [d2, m2, y2] = date2.split('/').map(Number);
  const first = new Date(y1, m1 - 1, d1);
  const second = new Date(y2, m2 - 1, d2);
  return Math.floor((second - first) / (1000 * 60 * 60 * 24));
}

async function cleanupInactiveUsers(today) {
  const raw = await redis.get('uid_list');
  let uid_list = raw ? JSON.parse(raw) : [];
  uid_list = uid_list.filter(u => daysBetween(u.last_execution, today) <= 3);
  uid_list.forEach((u, i) => u.uid = i + 1);
  await redis.set('uid_list', JSON.stringify(uid_list));
  return uid_list;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    const { discord_id, discord_username, in_game = false, today } = req.body;
    if (!discord_id || !discord_username || !today) return res.status(400).json({ error: 'missing_fields' });

    let uid_list = await cleanupInactiveUsers(today);
    const user_map = Object.fromEntries(uid_list.map(u => [u.discord_id, u]));
    let existing_user = user_map[discord_id];

    if (existing_user) {
      existing_user.last_execution = today;
      existing_user.in_game = in_game;
      await redis.set('uid_list', JSON.stringify(uid_list));
      return res.json(existing_user);
    }

    const new_user = { discord_username, discord_id, first_execution: today, last_execution: today, uid: uid_list.length + 1, in_game };
    uid_list.push(new_user);
    await redis.set('uid_list', JSON.stringify(uid_list));
    res.json(new_user);

  } catch (err) {
    console.error('Error in get_uid:', err);
    res.status(500).json({ error: 'internal_server_error', details: err.message });
  }
};
