// =========================
// 📌 IMPORTS
// =========================
const { Client, GatewayIntentBits, Partials, REST, Routes } = require('discord.js');
const cron = require('node-cron');
require('dotenv').config();

// =========================
// 🧪 DEBUG BOOT
// =========================
console.log('[BOOT] Starting bot...');
console.log('[ENV] TOKEN:', process.env.TOKEN ? 'OK' : 'MISSING');
console.log('[ENV] CLIENT_ID:', process.env.CLIENT_ID ? 'OK' : 'MISSING');
console.log('[ENV] GUILD_ID:', process.env.GUILD_ID ? 'OK' : 'MISSING');
console.log('[ENV] CHANNEL_CMD:', process.env.CHANNEL_CMD ? 'OK' : 'MISSING');
console.log('[ENV] CHANNEL_LOG:', process.env.CHANNEL_LOG ? 'OK' : 'MISSING');

// =========================
// 🤖 CLIENT
// =========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [
    Partials.Message,
    Partials.Channel,
    Partials.Reaction,
    Partials.MessageReaction,
    Partials.User
  ]
});

// =========================
// 🧪 DISCORD DEBUG EVENTS
// =========================
client.on('error', (err) => console.error('[CLIENT ERROR]', err));
client.on('warn', (info) => console.warn('[CLIENT WARN]', info));
client.on('debug', (info) => console.log('[CLIENT DEBUG]', info));
client.on('shardError', (error) => console.error('[SHARD ERROR]', error));

// =========================
// 🧠 UTILS
// =========================
const isStaff = (member) => member.roles.cache.some(r => (process.env.ROLE_STAFF?.split(',') || []).includes(r.id));
const getRole = (guild, id) => guild.roles.cache.get(id);
const getChannel = (guild, id) => guild.channels.cache.get(id);

// =========================
// 🚀 READY
// =========================
client.once('ready', async () => {
  console.log(`Connecté : ${client.user.tag}`);

  try {
    const rulesChannelId = process.env.CHANNEL_RULES || process.env.CHANNEL_CMD;

    const channel = await client.channels.fetch(rulesChannelId);
    if (!channel) throw new Error('Rules channel not found');

    const message = await channel.messages.fetch(process.env.MESSAGE_ID);
    if (!message) throw new Error('Rules message not found');

    await message.react(process.env.EMOJI);

    console.log('✅ Rules reaction added successfully');
  } catch (err) {
    console.error('❌ Failed to setup rules reaction:', err);
  }

  const commands = [];
  const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

  try {
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Guild slash commands registered (instant)');
  } catch (error) {
    console.error('❌ Failed to register guild commands:', error);
  }
});

// =========================
// 🎯 REACTION ROLE
// =========================
client.on('messageReactionAdd', async (reaction, user) => {
  if (user.bot) return;

  if (!reaction.message.guild || reaction.message.guild.id !== process.env.GUILD_ID) return;

  if (reaction.partial) await reaction.fetch();
  if (reaction.message.partial) await reaction.message.fetch();

  if (reaction.message.id !== process.env.MESSAGE_ID) return;

  const guild = reaction.message.guild;
  if (!guild) return;

  const member = await guild.members.fetch(user.id);

  const memberRole = getRole(guild, process.env.ROLE_MEMBER);
  const sanctionRole = getRole(guild, process.env.ROLE_SANCTION);

  if (sanctionRole && member.roles.cache.has(sanctionRole.id)) {
    return reaction.users.remove(user.id);
  }

  if (reaction.emoji.name === process.env.EMOJI) {
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
  if (!msg.guild || msg.guild.id !== process.env.GUILD_ID) return;

  const MAX = Number(process.env.MAX_MESSAGES);
  const INTERVAL = Number(process.env.INTERVAL);
  const DUP = Number(process.env.DUPLICATE_THRESHOLD);

  if (isStaff(msg.member)) return;

  if (msg.author.bot && !(process.env.EXEMPT_BOTS?.split(',') || []).includes(msg.author.id)) {
    return handleSpam(msg);
  }

  const now = Date.now();
  const data = spam.get(msg.author.id) || { c: 0, t: now, m: [] };

  if (now - data.t > INTERVAL) {
    Object.assign(data, { c: 0, m: [], t: now });
  }

  data.c++;
  data.m.push(msg.content);
  spam.set(msg.author.id, data);

  const dup = data.m.filter(x => x === msg.content).length;

  if ((dup >= DUP && now - data.t <= INTERVAL) || data.c >= MAX) {
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

  const role = getRole(guild, process.env.ROLE_SPAM);
  role && member.roles.add(role);

  const logChannel = getChannel(guild, process.env.CHANNEL_LOG);
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
  if (!msg.guild || msg.guild.id !== process.env.GUILD_ID || msg.author.bot) return;
  if (msg.channel.id !== process.env.CHANNEL_CMD) return;
  if (!isStaff(msg.member)) return;

  const [cmd] = msg.content.split(' ');
  const member = msg.mentions.members.first();
  const guild = msg.guild;

  if (cmd === '!unlock' && member) {
    const role = getRole(guild, process.env.ROLE_SANCTION);
    role && member.roles.remove(role);
    return msg.reply('✅ Débloqué');
  }

  if (cmd === '!lockdown') {
    const staffRoles = process.env.ROLE_STAFF?.split(',') || [];

    for (const ch of guild.channels.cache.values()) {
      if (!ch.isTextBased()) continue;

      lockdownBackup.set(ch.id, ch.permissionOverwrites.cache.map(o => ({
        id: o.id,
        type: o.type,
        allow: o.allow.bitfield,
        deny: o.deny.bitfield
      })));

      for (const role of guild.roles.cache.values()) {
        if (staffRoles.includes(role.id)) continue;

        await ch.permissionOverwrites.edit(role.id, {
          SendMessages: false
        });
      }
    }

    return msg.reply('🚨 Lockdown activé');
  }

  if (cmd === '!unlockdown') {
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
cron.schedule('30 15 * * 2,4', async () => {
  try {
    const ch = await client.channels.fetch(process.env.CHANNEL_CMD);
    if (ch) await ch.send('!sub');
  } catch (e) {
    console.error('Cron error:', e);
  }
}, { timezone: 'Europe/Paris' });

// =========================
// 🛡️ WATCHDOG
// =========================
let hb = Date.now();

setInterval(() => {
  hb = Date.now();
}, 30000);

setInterval(() => {
  if (client.ws.ping > 10000) {
    console.error('Watchdog restart (ping)');
    process.exit(1);
  }
}, 15000);

process.on('uncaughtException', console.error);
process.on('unhandledRejection', console.error);

// =========================
// ▶️ LOGIN
// =========================
client.login(process.env.TOKEN)
  .then(() => console.log('[LOGIN] Login request sent successfully'))
  .catch((err) => console.error('[LOGIN ERROR]', err));
