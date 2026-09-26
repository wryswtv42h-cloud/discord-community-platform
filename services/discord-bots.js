import { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } from 'discord.js';

const definitions = [
  ['groups', process.env.GROUPS_BOT_TOKEN ? 'GROUPS_BOT_TOKEN' : 'DISCORD_BOT_TOKEN'],
  ['tickets', 'TICKETS_BOT_TOKEN'],
  ['applications', 'APPLICATIONS_BOT_TOKEN'],
  ['privateMessages', 'PRIVATE_MESSAGES_BOT_TOKEN']
];

const clients = new Map();

async function getGroupClient() {
  const client=clients.get('groups') || clients.get('privateMessages');
  if(!client || !client.isReady()) throw new Error('Discord bot غير متصل');
  return client;
}
async function resolveGuild() {
  const client=await getGroupClient();
  if(!globalThis.mldDiscord.guildId) throw new Error('DISCORD_GUILD_ID غير مضبوط');
  return client.guilds.fetch(globalThis.mldDiscord.guildId);
}
async function resolveUser(discordId) {
  const client=await getGroupClient();
  return client.users.fetch(String(discordId));
}
async function verifyUser(discordId) {
  const guild=await resolveGuild();
  const member=await guild.members.fetch(String(discordId));
  return Boolean(member?.user && !member.user.bot);
}
async function resolveApprover() {
  const id=process.env.GROUP_APPROVER_DISCORD_ID;
  if(id) return resolveUser(id);
  const username=(process.env.GROUP_APPROVER_USERNAME || 'w4px').toLowerCase();
  const guild=await resolveGuild();
  const members=await guild.members.fetch();
  const member=Array.from(members.values()).find(m=>[m.user.username,m.user.globalName,m.displayName].filter(Boolean).some(v=>v.toLowerCase()===username));
  if(!member) throw new Error('لم يتم العثور على w4px — أضف GROUP_APPROVER_DISCORD_ID في Railway');
  return member.user;
}
async function sendButtonDM(userId,content,buttons) {
  const client=await getGroupClient();
  const user=await client.users.fetch(String(userId));
  const dm=await user.createDM();
  const row=new ActionRowBuilder().addComponents(...buttons.map(b=>new ButtonBuilder().setCustomId(b.id).setLabel(b.label).setStyle(b.style)));
  await dm.send({content,components:[row]});
}
async function requestGroupConfirmation(groupId,discordId) {
  await sendButtonDM(discordId,'هل أنت متأكد من إنشاء القروب؟\nاضغط موافق أو إلغاء.',[
    {id:`mld:group-confirm:yes:${groupId}`,label:'نعم، إنشاء القروب',style:ButtonStyle.Success},
    {id:`mld:group-confirm:no:${groupId}`,label:'إلغاء',style:ButtonStyle.Danger}
  ]);
}
async function notifyGroupOwnerJoinRequest(groupId,requestId) {
  const handlers=globalThis.mldDiscord.groupHandlers;
  const group=handlers?.getGroup ? handlers.getGroup(groupId) : null;
  const target=group?.ownerDiscordId;
  if(!target) throw new Error('مالك القروب غير مرتبط بـDiscord');
  const name=group?.name || 'القروب';
  await sendButtonDM(target,`📥 طلب انضمام جديد إلى «${name}».\nهل تريد قبول العضو أو رفضه؟`,[
    {id:`mld:join:yes:${requestId}`,label:'قبول',style:ButtonStyle.Success},
    {id:`mld:join:no:${requestId}`,label:'رفض',style:ButtonStyle.Danger}
  ]);
}
async function createGroupDiscordResources(group) {
  const guild=await resolveGuild();
  const role=await guild.roles.create({name:`قروب | ${group.name}`,reason:'MLD group approved'});
  const everyone=guild.roles.everyone;
  const category=await guild.channels.create({name:`╭・${group.name}`,type:ChannelType.GuildCategory,permissionOverwrites:[
    {id:everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
    {id:role.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]}
  ]});
  const channel=await guild.channels.create({name:`💬・${group.name}`,type:ChannelType.GuildText,parent:category.id,permissionOverwrites:[
    {id:everyone.id,deny:[PermissionFlagsBits.ViewChannel]},
    {id:role.id,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory]}
  ]});
  await guild.members.addRole?.(group.ownerDiscordId,role.id).catch(()=>{});
  const owner=await guild.members.fetch(group.ownerDiscordId).catch(()=>null);
  if(owner) await owner.roles.add(role).catch(()=>{});
  return {categoryId:category.id,channelId:channel.id,roleId:role.id};
}
async function assignGroupRole(discordId,roleId) {
  if(!roleId) throw new Error('رتبة القروب غير موجودة');
  const guild=await resolveGuild();
  const member=await guild.members.fetch(String(discordId));
  await member.roles.add(roleId);
  return true;
}
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

  client.on('interactionCreate', async (interaction) => {
    if(!interaction.isButton() || !interaction.customId.startsWith('mld:')) return;
    try {
      const [,kind,decision,id]=interaction.customId.split(':');
      if(kind==='group-confirm'){
        const approver=await resolveApprover();
        if(interaction.user.id!==approver.id) {
          if(interaction.deferred||interaction.replied) return;
          return interaction.reply({content:'هذا الطلب مخصص للمالك.',ephemeral:true});
        }
        await interaction.deferUpdate();
        await globalThis.mldDiscord.groupHandlers?.approveGroup(id,decision==='yes');
        await interaction.editReply({content:decision==='yes'?'✅ تم اعتماد طلب القروب.':'❌ تم إلغاء طلب القروب.',components:[]});
      } else if(kind==='join'){
        const group=globalThis.mldDiscord.groupHandlers?.getGroup?.(globalThis.mldDiscord.groupHandlers?.getRequest?.(id)?.groupId);
        if(!group || group.ownerDiscordId!==interaction.user.id) return interaction.reply({content:'هذا الطلب مخصص لمالك القروب.',ephemeral:true});
        await interaction.deferUpdate();
        await globalThis.mldDiscord.groupHandlers?.decideJoin(id,decision==='yes');
        await interaction.editReply({content:decision==='yes'?'✅ تمت الموافقة على العضو.':'❌ تم رفض الطلب.',components:[]});
      }
    } catch(error) {
      console.error('[discord] workflow:',error.message);
      if(!interaction.replied&&!interaction.deferred) await interaction.reply({content:'تعذر تنفيذ الطلب: '+error.message,ephemeral:true}).catch(()=>{});
    }
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

async function sendDM(userId, content) {
  const client = clients.get('privateMessages') || clients.get('groups');
  if (!client || !client.isReady()) throw new Error('Discord bot غير متصل');
  const user = await client.users.fetch(String(userId));
  const dm = await user.createDM();
  await dm.send(content);
  return true;
}

globalThis.mldDiscord = {
  guildId: process.env.DISCORD_GUILD_ID || '',
  clients,
  getMembers,
  sendDM,
  verifyUser,
  requestGroupConfirmation,
  notifyGroupOwnerJoinRequest,
  createGroupDiscordResources,
  assignGroupRole
};

// Lightweight accessors used by Discord button callbacks; the server attaches the actual database-backed handlers.
Object.defineProperties(globalThis.mldDiscord, { groupHandlers: { value: {}, writable: true, configurable: true } });
