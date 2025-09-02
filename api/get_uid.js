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
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const { discord_id, discord_username, in_game } = req.body;
    if (!discord_id || !discord_username) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const today = format_date();
    let uid_list = (await redis.get('uid_list')) || [];

    let existing_user = uid_list.find(u => u.discord_id === discord_id);
    if (existing_user) {
      existing_user.last_execution = today;
      if (typeof in_game === "boolean") {
        existing_user.in_game = in_game;
      }
      await redis.set('uid_list', uid_list);
      return res.json(existing_user);
    }

    const new_uid = uid_list.length + 1;
    const new_user = {
      discord_username,
      discord_id,
      first_execution: today,
      last_execution: today,
      uid: new_uid,
      in_game: typeof in_game === "boolean" ? in_game : false
    };

    uid_list.push(new_user);
    await redis.set('uid_list', uid_list);

    res.json(new_user);

  } catch (err) {
    console.error('Error in get_uid:', err);
    res.status(500).json({ error: 'internal_server_error', details: err.message });
  }
};
