import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

function hoursBetween(date1, date2) {
  const d1 = new Date(date1.split('/').reverse().join('-'));
  const d2 = new Date(date2.split('/').reverse().join('-'));
  return Math.abs(d2 - d1) / 36e5;
}

async function cleanupInactiveUsers() {
  const raw = await redis.get('uid_list');
  let uid_list = raw ? JSON.parse(raw) : [];
  const today = new Date();
  uid_list = uid_list.filter(u => hoursBetween(u.last_execution, today.toLocaleDateString('en-GB')) <= 72);
  uid_list.forEach((u, i) => u.uid = i + 1);
  await redis.set('uid_list', JSON.stringify(uid_list));
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

    const { discord_id, discord_username, in_game = false, today } = req.body;
    if (!discord_id || !discord_username || !today) return res.status(400).json({ error: 'missing_fields' });

    await cleanupInactiveUsers();

    const raw = await redis.get('uid_list');
    const uid_list = raw ? JSON.parse(raw) : [];
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
    console.error(err);
    res.status(500).json({ error: 'internal_server_error', details: err.message });
  }
};
