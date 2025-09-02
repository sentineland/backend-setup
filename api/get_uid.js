import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

function format_date(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function hoursBetween(date1, date2) {
  const d1 = new Date(date1.split('/').reverse().join('-'));
  const d2 = new Date(date2.split('/').reverse().join('-'));
  return Math.abs(d2 - d1) / 36e5;
}

async function cleanupInactiveUsers() {
  let uid_list = (await redis.get('uid_list')) || [];
  const today = format_date();
  uid_list = uid_list.filter(u => hoursBetween(u.last_execution, today) <= 72);
  uid_list.forEach((u, i) => u.uid = i + 1);
  await redis.set('uid_list', uid_list);
}

async function registerOrUpdateUser({ discord_id, discord_username, in_game = false }) {
  const today = format_date();
  let uid_list = (await redis.get('uid_list')) || [];

  let existing_user = uid_list.find(u => u.discord_id === discord_id);
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
      in_game
    });
  }

  await redis.set('uid_list', uid_list);
  return existing_user || uid_list[uid_list.length - 1];
}

async function main() {
  await cleanupInactiveUsers();

  if (process.env.DISCORD_ID && process.env.DISCORD_USERNAME) {
    const user = await registerOrUpdateUser({
      discord_id: process.env.DISCORD_ID,
      discord_username: process.env.DISCORD_USERNAME,
      in_game: process.env.IN_GAME === 'true'
    });
    console.log('User registered/updated:', user);
  }
}

main();

setInterval(main, 72 * 60 * 60 * 1000);
