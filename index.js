const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const { GoalBlock } = goals;
const mcDataLoader = require('minecraft-data');
const express = require('express');
const config = require('./settings.json');

const app = express();

app.get('/', (req, res) => {
  res.send('Bot is online!');
});

app.listen(8000, () => {
  console.log('Express server started on port 8000');
});

function createBot() {
  const bot = mineflayer.createBot({
    username: config['bot-account']['username'],
    password: config['bot-account']['password'],
    auth: config['bot-account']['type'],
    host: config.server.ip,
    port: config.server.port,
    version: config.server.version,
  });

  bot.loadPlugin(pathfinder);

  bot.once('spawn', async () => {
    console.log('\x1b[33m[AfkBot] Bot joined the server\x1b[0m');

    const mcData = mcDataLoader(bot.version);
    const defaultMove = new Movements(bot, mcData);
    bot.settings.colorsEnabled = false;

    // Auto Login
    if (config.utils['auto-auth'].enabled) {
      console.log('[INFO] Auto-auth enabled');
      const password = config.utils['auto-auth'].password;

      try {
        await sendLogin(password);
      } catch (err) {
        console.error('[LOGIN ERROR]', err);
      }
    }

    // Chat Messages
    if (config.utils['chat-messages'].enabled) {
      const messages = config.utils['chat-messages'].messages;
      const repeat = config.utils['chat-messages'].repeat;
      const delay = config.utils['chat-messages']['repeat-delay'];

      console.log('[INFO] Chat-messages module enabled');

      if (repeat) {
        let i = 0;
        setInterval(() => {
          bot.chat(messages[i]);
          i = (i + 1) % messages.length;
        }, delay * 1000);
      } else {
        messages.forEach(msg => bot.chat(msg));
      }
    }

    // Position Movement
    const pos = config.position;
    if (pos.enabled) {
      console.log(`\x1b[32m[AfkBot] Moving to (${pos.x}, ${pos.y}, ${pos.z})\x1b[0m`);
      bot.pathfinder.setMovements(defaultMove);
      bot.pathfinder.setGoal(new GoalBlock(pos.x, pos.y, pos.z));
    }

    // Anti-AFK
    if (config.utils['anti-afk'].enabled) {
      bot.setControlState('jump', true);
      if (config.utils['anti-afk'].sneak) {
        bot.setControlState('sneak', true);
      }
    }

    // ✅ Circle Walk (loop without delay)
    if (config.utils.movement?.["circle-walk"]?.enabled) {
      const radius = config.utils.movement["circle-walk"].radius || 3;
      const center = bot.entity.position.clone();
      let angle = 0;

      const moveInCircle = () => {
        const x = center.x + radius * Math.cos(angle);
        const z = center.z + radius * Math.sin(angle);
        angle += Math.PI / 8;

        bot.pathfinder.setGoal(new GoalBlock(x, center.y, z));
      };

      bot.on('goal_reached', () => {
        moveInCircle(); // instantly walk to next point
      });

      moveInCircle(); // start circle movement
    }
  });

  bot.on('death', () => {
    console.log(`\x1b[33m[AfkBot] Bot died and respawned\x1b[0m`);
  });

  bot.on('end', () => {
    console.log('\x1b[33m[AfkBot] Disconnected from server\x1b[0m');
    if (config.utils['auto-reconnect']) {
      const delay = config.utils['auto-reconnect-delay'] || 10000;
      console.log(`[INFO] Reconnecting in ${delay}ms...`);
      setTimeout(createBot, delay);
    }
  });

  bot.on('kicked', reason => {
    console.log('\x1b[33m[AfkBot] Kicked: ', reason, '\x1b[0m');
  });

  bot.on('error', err => {
    console.log(`\x1b[31m[ERROR] ${err.message}\x1b[0m`);
  });

  function sendLogin(password) {
    return new Promise((resolve, reject) => {
      bot.chat(`/login ${password}`);
      console.log(`[Auth] Sent /login ${password}`);

      bot.once('chat', (username, message) => {
        console.log(`[ChatLog] <${username}> ${message}`);
        if (message.includes('successfully logged in')) {
          console.log('[INFO] Login successful.');
          resolve();
        } else {
          reject(`Login failed: ${message}`);
        }
      });
    });
  }
}

createBot();
