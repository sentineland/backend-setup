import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

function format_date() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

    const { discord_id, discord_username, trigger_test } = req.body;

    if (trigger_test === true) {
      await redis.set('run_test', true, { ex: 60 });
      return res.json({ success: true, message: 'Test triggered' });
    }

    if (!discord_id || !discord_username) return res.status(400).json({ error: 'missing_fields' });

    const today = format_date();
    let uid_list = (await redis.get('uid_list')) || [];

    let existing_user = uid_list.find(u => u.discord_id === discord_id);
    if (existing_user) {
      existing_user.last_execution = today;
      await redis.set('uid_list', uid_list);
      const run_test = (await redis.get('run_test')) || false;
      return res.json({ ...existing_user, run_test });
    }

    const new_uid = uid_list.length + 1;
    const new_user = {
      discord_username,
      discord_id,
      first_execution: today,
      last_execution: today,
      uid: new_uid
    };

    uid_list.push(new_user);
    await redis.set('uid_list', uid_list);
    const run_test = (await redis.get('run_test')) || false;

    res.json({ ...new_user, run_test });

  } catch (err) {
    console.error('Error in get_uid:', err);
    res.status(500).json({ error: 'internal_server_error', details: err.message });
  }
}
