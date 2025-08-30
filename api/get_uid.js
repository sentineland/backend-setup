import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

function formatDate() {
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

    const { discord_id, discord_username } = req.body;
    if (!discord_id || !discord_username) {
      return res.status(400).json({ error: 'missing_fields' });
    }

    const today = formatDate();
    let uidData = await redis.get(`uid:${discord_id}`);

    if (uidData) {
      // Update last_execution
      uidData.last_execution = today;
      await redis.set(`uid:${discord_id}`, uidData);
      return res.json({ uid: uidData.uid, ...uidData });
    }

    // Generate new UID
    const nextUID = (await redis.get('uid_counter')) || 0;
    const newUID = nextUID + 1;

    const newUserData = {
      discord_username,
      discord_id,
      first_execution: today,
      last_execution: today,
      uid: newUID
    };

    await redis.set(`uid:${discord_id}`, newUserData);
    await redis.set('uid_counter', newUID);

    res.json(newUserData);

  } catch (err) {
    console.error('Error in get_uid:', err);
    res.status(500).json({ error: 'internal_server_error', details: err.message });
  }
}
