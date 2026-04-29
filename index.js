import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || "1498208678723977216";
const OWNER_ID = process.env.OWNER_ID;

const ROAST_WORKER = "https://loverbot.vladikkotik3.workers.dev";
const HELPER_WORKER = "https://loverhelper.vladikkotik3.workers.dev";

if (!TOKEN || !OWNER_ID) process.exit(1);

const settings = {
    enabled: true,
    mode: 'agressive',
    admins: [],
    whitelist: [],
    blacklist: [],
    roastChance: 25
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

const messageHistory = new Map();

function autoWhitelist(userId) {
    if (!settings.whitelist.includes(userId) && !settings.blacklist.includes(userId)) {
        settings.whitelist.push(userId);
    }
}

const commands = [
    new SlashCommandBuilder().setName('mode').setDescription('Сменить режим')
        .addStringOption(o => o.setName('type').setDescription('Режим').setRequired(true)
            .addChoices(
                { name: 'Агрессивный', value: 'agressive' },
                { name: 'Адекватный', value: 'normal' },
                { name: 'Нейтральный', value: 'neutral' }
            )),
    new SlashCommandBuilder().setName('settings').setDescription('Настройки'),
    new SlashCommandBuilder().setName('toggle').setDescription('Вкл/выкл')
        .addStringOption(o => o.setName('state').setDescription('Состояние').setRequired(true)
            .addChoices({ name: 'Вкл', value: 'on' }, { name: 'Выкл', value: 'off' })),
    new SlashCommandBuilder().setName('roastchance').setDescription('Шанс агро')
        .addIntegerOption(o => o.setName('percent').setDescription('%').setRequired(true).setMinValue(0).setMaxValue(100)),
    new SlashCommandBuilder().setName('help').setDescription('Список команд')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.on('ready', async () => {
    console.log('Бот запущен:', client.user.tag);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'Нет прав', flags: 64 });
    
    await interaction.deferReply({ flags: 64 });
    const { commandName } = interaction;
    
    if (commandName === 'mode') {
        settings.mode = interaction.options.getString('type');
        return interaction.editReply({ content: 'Режим: ' + settings.mode });
    }
    if (commandName === 'settings') {
        return interaction.editReply({ content: 'Режим: ' + settings.mode + '\nRoast: ' + settings.roastChance + '%' });
    }
    if (commandName === 'toggle') {
        settings.enabled = interaction.options.getString('state') === 'on';
        return interaction.editReply({ content: settings.enabled ? 'Включен' : 'Выключен' });
    }
    if (commandName === 'roastchance') {
        settings.roastChance = interaction.options.getInteger('percent');
        return interaction.editReply({ content: 'Шанс: ' + settings.roastChance + '%' });
    }
    if (commandName === 'help') {
        return interaction.editReply({ content: '/mode /toggle /roastchance /settings /help' });
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!settings.enabled) return;
    if (message.content.startsWith('/')) return;
    if (message.content.includes(";")) return;
    
    autoWhitelist(message.author.id);
    if (settings.blacklist.includes(message.author.id)) return;
    
    const channelId = message.channel.id;
    let responseMode = settings.mode;
    
    if (channelId === "857600197809668159") {
        if (Math.random() * 100 > settings.roastChance) return;
        responseMode = 'agressive';
    }
    if (channelId === "1498239736320622684") {
        responseMode = 'normal';
    }
    
    const workerUrl = responseMode === 'agressive' ? ROAST_WORKER : HELPER_WORKER;
    
    if (!messageHistory.has(channelId)) messageHistory.set(channelId, []);
    const history = messageHistory.get(channelId);
    
    let cleanContent = message.content;
    const mentionedUsers = message.mentions.users;
    
    if (mentionedUsers.size > 0) {
        mentionedUsers.forEach((user, id) => {
            cleanContent = cleanContent.replace(new RegExp(`<@!?${id}>`, 'g'), `@${user.username}`);
        });
    }
    
    history.push({ author: message.author.username, content: cleanContent });
    if (history.length > 5) history.shift();
    
    try {
        const response = await fetch(workerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: cleanContent,
                context: history,
                currentAuthor: message.author.username,
                mode: responseMode
            })
        });
        
        const data = await response.json();
        
        if (data.reply) {
            let replyText = data.reply;
            mentionedUsers.forEach((user, id) => {
                const escaped = user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                replyText = replyText.replace(new RegExp(`@${escaped}`, 'gi'), `<@${id}>`);
            });
            
            if (replyText.length > 500) replyText = replyText.substring(0, 497) + "...";
            await message.reply(replyText);
        }
    } catch (err) {
        console.error('Ошибка:', err.message);
    }
});

client.login(TOKEN);
