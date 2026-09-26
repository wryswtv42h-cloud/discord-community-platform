import { Client, GatewayIntentBits, Partials } from 'discord.js';

const definitions = [
  ['groups', process.env.GROUPS_BOT_TOKEN ? 'GROUPS_BOT_TOKEN' : 'DISCORD_BOT_TOKEN'],
  ['tickets', 'TICKETS_BOT_TOKEN'],
  ['applications', 'APPLICATIONS_BOT_TOKEN'],
  ['privateMessages', 'PRIVATE_MESSAGES_BOT_TOKEN']
];

const clients = new Map();

async function getMembers() {
  const client=Array.from(clients.values()).find(c=>c.isReady());
  if(!client||!globalThis.mldDiscord.guildId)return [];
  const guild=await client.guilds.fetch(globalThis.mldDiscord.guildId);
  const members=await guild.members.fetch();
  return Array.from(members.values()).filter(m=>!m.user.bot).map(m=>({id:m.id,name:m.displayName||m.user.globalName||m.user.username,username:m.user.username,avatar:m.displayAvatarURL({extension:'png',size:128}),status:m.presence?.status||'offline',role:m.roles?.highest?.name||'عضو'}));
}

for (const [name, envName] of definitions) {
  const token = process.env[envName];

  if (!token) {
    console.warn(`[discord] ${envName} غير موجود — تم تعطيل بوت ${name}`);
    continue;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Channel, Partials.Message, Partials.User]
  });

  client.once('ready', () => {
    console.log(`[discord] ${name} يعمل باسم ${client.user.tag}`);
  });

  client.on('error', (error) => {
    console.error(`[discord] ${name}:`, error.message);
  });

  client.login(token).catch((error) => {
    console.error(`[discord] فشل تسجيل بوت ${name}:`, error.message);
  });

  clients.set(name, client);
}

globalThis.mldDiscord = {
  guildId: process.env.DISCORD_GUILD_ID || '',
  clients,
  getMembers
};
