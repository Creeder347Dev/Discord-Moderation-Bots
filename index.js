// =========================
// 📌 IMPORTS
// =========================
const { Client, GatewayIntentBits, Partials } = require('discord.js');
const cron = require('node-cron');
require('dotenv').config();

// =========================
// ⚙️ CONFIGURATION
// =========================
const CONFIG = {
  TOKEN: process.env.TOKEN,
  IDS: {
    MESSAGE: process.env.MESSAGE_ID,
    CMD: process.env.CHANNEL_CMD,
    LOG: process.env.CHANNEL_LOG
  },
  ROLES: {
    MEMBER: process.env.ROLE_MEMBER,
    SANCTION: process.env.ROLE_SANCTION,
    SPAM: process.env.ROLE_SPAM,
    STAFF: process.env.ROLE_STAFF?.split(',') || []
  },
  EMOJI: process.env.EMOJI,
  ANTISPAM: {
    MAX: +process.env.MAX_MESSAGES,
    INTERVAL: +process.env.INTERVAL,
    DUP: +process.env.DUPLICATE_THRESHOLD
  },
  EXEMPT_BOTS: process.env.EXEMPT_BOTS?.split(',') || []
};

// =========================
// 🤖 CLIENT
// =========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

// =========================
// 🧠 UTILS
// =========================
const isStaff = (member) => member.roles.cache.some(r => CONFIG.ROLES.STAFF.includes(r.id));
const getRole = (guild, id) => guild.roles.cache.get(id);
const getChannel = (guild, id) => guild.channels.cache.get(id);

// =========================
// 🚀 READY
// =========================
client.once('ready', () => console.log(`Connecté : ${client.user.tag}`));

// =========================
// 🎯 REACTION ROLE
// =========================
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;
  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();

  if (reaction.message.id !== CONFIG.IDS.MESSAGE) return;

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id);

  const memberRole = getRole(guild, CONFIG.ROLES.MEMBER);
  const sanctionRole = getRole(guild, CONFIG.ROLES.SANCTION);

  if (sanctionRole && member.roles.cache.has(sanctionRole.id)) {
    return reaction.users.remove(user.id);
  }

  if (reaction.emoji.name === CONFIG.EMOJI) {
    memberRole && member.roles.add(memberRole);
  } else {
    await reaction.users.remove(user.id);
    sanctionRole && member.roles.add(sanctionRole);
  }
});

// =========================
// 🛡️ ANTISPAM
// =========================
const spam = new Map();
setInterval(() => spam.clear(), 600000);

client.on('messageCreate', async (msg) => {
  if (!msg.guild) return;
  if (isStaff(msg.member)) return;
  if (msg.author.bot && !CONFIG.EXEMPT_BOTS.includes(msg.author.id)) return;

  const now = Date.now();
  const data = spam.get(msg.author.id) || { c: 0, t: now, m: [] };

  if (now - data.t > CONFIG.ANTISPAM.INTERVAL) {
    Object.assign(data, { c: 0, m: [], t: now });
  }

  data.c++;
  data.m.push(msg.content);
  spam.set(msg.author.id, data);

  const dup = data.m.filter(x => x === msg.content).length;

  if ((dup >= CONFIG.ANTISPAM.DUP && now - data.t <= CONFIG.ANTISPAM.INTERVAL) || data.c >= CONFIG.ANTISPAM.MAX) {
    return handleSpam(msg);
  }
});

// =========================
// 🚨 HANDLE SPAM
// =========================
async function handleSpam(msg) {
  const guild = msg.guild;
  const member = msg.member;

  for (const ch of guild.channels.cache.values()) {
    if (!ch.isTextBased()) continue;

    try {
      const messages = await ch.messages.fetch({ limit: 100 });
      const userMsgs = messages.filter(m => m.author.id === msg.author.id);
      await ch.bulkDelete(userMsgs, true);
    } catch (e) {
      console.error(e);
    }
  }

  const role = getRole(guild, CONFIG.ROLES.SPAM);
  role && member.roles.add(role);

  const logChannel = getChannel(guild, CONFIG.IDS.LOG);
  if (logChannel) {
    logChannel.send(`🚨 ${msg.author.tag} spam détecté`);
  }

  spam.delete(msg.author.id);
}

// =========================
// 🔓 COMMANDES + LOCKDOWN
// =========================
let lockdown = false;
const lockdownBackup = new Map();

client.on('messageCreate', async (msg) => {
  if (!msg.guild || msg.author.bot) return;
  if (msg.channel.id !== CONFIG.IDS.CMD) return;
  if (!isStaff(msg.member)) return;

  const [cmd] = msg.content.split(' ');
  const member = msg.mentions.members.first();
  const guild = msg.guild;

  if (cmd === '!unlock' && member) {
    const role = getRole(guild, CONFIG.ROLES.SANCTION);
    role && member.roles.remove(role);
    return msg.reply('✅ Débloqué');
  }

  if (cmd === '!lockdown') {
    lockdown = true;

    for (const ch of guild.channels.cache.values()) {
      if (!ch.isTextBased()) continue;

      lockdownBackup.set(ch.id, ch.permissionOverwrites.cache.map(o => ({
        id: o.id,
        allow: o.allow.bitfield,
        deny: o.deny.bitfield
      })));

      for (const role of guild.roles.cache.values()) {
        if (CONFIG.ROLES.STAFF.includes(role.id)) continue;
        await ch.permissionOverwrites.edit(role.id, { SendMessages: false });
      }
    }

    return msg.reply('🚨 Lockdown activé');
  }

  if (cmd === '!unlockdown') {
    lockdown = false;

    for (const ch of guild.channels.cache.values()) {
      if (!ch.isTextBased()) continue;

      const backup = lockdownBackup.get(ch.id);
      if (!backup) continue;

      for (const perm of backup) {
        await ch.permissionOverwrites.edit(perm.id, {
          allow: perm.allow,
          deny: perm.deny
        });
      }
    }

    lockdownBackup.clear();
    return msg.reply('✅ Lockdown désactivé');
  }
});

// =========================
// ⏰ CRON
// =========================
cron.schedule('30 15 * * 2,4', () => {
  const ch = client.channels.cache.get(CONFIG.IDS.CMD);
  ch && ch.send('!sub');
}, { timezone: 'Europe/Paris' });

// =========================
// 🛡️ WATCHDOG
// =========================
let hb = Date.now();
const beat = () => hb = Date.now();

client.on('ready', beat);
client.on('messageCreate', beat);

setInterval(() => {
  if (Date.now() - hb > 60000 || client.ws.ping > 10000) {
    console.error('Watchdog restart');
    process.exit(1);
  }
}, 15000);

process.on('uncaughtException', () => process.exit(1));
process.on('unhandledRejection', () => process.exit(1));

// =========================
// ▶️ LOGIN
// =========================
client.login(CONFIG.TOKEN);
