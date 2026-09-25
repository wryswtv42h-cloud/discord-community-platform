import { Client, GatewayIntentBits, Partials } from 'discord.js';

const guildId = process.env.DISCORD_GUILD_ID || '';
const botDefinitions = [
  ['groups', 'GROUPS_BOT_TOKEN'],
  ['tickets', 'TICKETS_BOT_TOKEN'],
  ['applications', 'APPLICATIONS_BOT_TOKEN'],
  ['privateMessages', 'PRIVATE_MESSAGES_BOT_TOKEN']
];
const clients = new Map();

for (const [name, envName] of botDefinitions) {
  const token = process.env[envName];
  if (!token) {
    console.warn(`[discord] ${envName} is missing; ${name} bot is disabled`);
    continue;
  }
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates],
    partials: [Partials.Channel, Partials.Message, Partials.User]
  });
  client.once('ready', () => console.log(`[discord] ${name} ready as ${client.user.tag}`));
  client.on('error', (error) => console.error(`[discord] ${name}: ${error.message}`));
  client.login(token).catch((error) => console.error(`[discord] ${name} login failed: ${error.message}`));
  clients.set(name, client);
}

globalThis.mldDiscord = { guildId, clients, botNames: botDefinitions.map(([name]) => name) };
