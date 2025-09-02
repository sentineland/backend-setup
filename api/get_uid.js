import { Analytics } from "@vercel/analytics/next";
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const { discord_id = null, discord_username = null, in_game = false, today = null } = req.body || {};

    if (!discord_id || !discord_username || !today) {
      return res.json({
        uid: "Nil",
        first_execution: "Nil",
        last_execution: "Nil",
        discord_username: "Nil",
        in_game: false
      });
    }

    let uid_list = (await redis.get('uid_list')) || [];

    let existing_user = uid_list.find(u => u.discord_id === discord_id);
    if (existing_user) {
      existing_user.last_execution = today;
      existing_user.in_game = in_game;
      await redis.set('uid_list', uid_list);
      return res.json(existing_user);
    }

    const new_user = {
      discord_username,
      discord_id,
      first_execution: today,
      last_execution: today,
      uid: uid_list.length + 1,
      in_game
    };

    uid_list.push(new_user);
    await redis.set('uid_list', uid_list);

    res.json(new_user);

  } catch (err) {
    console.error(err);
    res.status(500).json({
      uid: "Nil",
      first_execution: "Nil",
      last_execution: "Nil",
      discord_username: "Nil",
      in_game: false,
      error: 'internal_server_error',
      details: err.message
    });
  }
}
