import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const OWNER_ID = process.env.OWNER_ID;
const ROAST_WORKER = process.env.ROAST_WORKER;
const ROAST_WORKER_BACKUP = process.env.ROAST_WORKER_BACKUP;
const HELPER_WORKER = process.env.HELPER_WORKER;
const ROAST_CHANNEL = process.env.ROAST_CHANNEL;
const HELPER_CHANNEL = process.env.HELPER_CHANNEL;

if (!TOKEN || !CLIENT_ID || !OWNER_ID || !ROAST_WORKER || !ROAST_WORKER_BACKUP || !HELPER_WORKER || !ROAST_CHANNEL || !HELPER_CHANNEL) {
    console.error('Нет всех переменных');
    process.exit(1);
}

// Загружаем настройки из Railway Variables (JSON строка)
let settings = { enabled: true, roastChance: 20, autoReactions: {} };

if (process.env.BOT_SETTINGS) {
    try {
        settings = JSON.parse(process.env.BOT_SETTINGS);
        if (!settings.autoReactions) settings.autoReactions = {};
        console.log('📂 Настройки из переменной');
    } catch (e) {
        console.log('⚠️ Ошибка парсинга BOT_SETTINGS');
    }
}

console.log('⚙️ Настройки:', JSON.stringify(settings));

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

// Команда /savesettings — выводит настройки для копирования
const commands = [
    new SlashCommandBuilder().setName('toggle').setDescription('Вкл/выкл')
        .addStringOption(o => o.setName('state').setRequired(true)
            .addChoices({ name: 'Вкл', value: 'on' }, { name: 'Выкл', value: 'off' })),
    new SlashCommandBuilder().setName('roastchance').setDescription('Шанс агро 0-100%')
        .addIntegerOption(o => o.setName('percent').setRequired(true).setMinValue(0).setMaxValue(100)),
    new SlashCommandBuilder().setName('loversmile').setDescription('Авто-реакция')
        .addStringOption(o => o.setName('emoji').setRequired(true))
        .addUserOption(o => o.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('stopsmile').setDescription('Убрать реакцию')
        .addUserOption(o => o.setName('user').setRequired(true)),
    new SlashCommandBuilder().setName('smilelist').setDescription('Список реакций'),
    new SlashCommandBuilder().setName('savesettings').setDescription('Вывести настройки для сохранения'),
    new SlashCommandBuilder().setName('settings').setDescription('Показать настройки'),
    new SlashCommandBuilder().setName('cleanup').setDescription('Очистить команды'),
    new SlashCommandBuilder().setName('help').setDescription('Помощь')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.on('ready', async () => {
    console.log('✅ Бот:', client.user.tag);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Команды готовы');
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.user.id !== OWNER_ID) return interaction.reply({ content: 'Нет прав', flags: 64 });
    
    const { commandName } = interaction;
    
    if (commandName === 'cleanup') {
        await interaction.deferReply({ flags: 64 });
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
        await new Promise(r => setTimeout(r, 2000));
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        return interaction.editReply({ content: '✅ Очищено!' });
    }
    
    await interaction.deferReply({ flags: 64 });
    
    if (commandName === 'toggle') {
        settings.enabled = interaction.options.getString('state') === 'on';
        return interaction.editReply({ content: settings.enabled ? '✅ Вкл' : '❌ Выкл' });
    }
    if (commandName === 'roastchance') {
        settings.roastChance = interaction.options.getInteger('percent');
        return interaction.editReply({ content: `✅ Шанс: ${settings.roastChance}%` });
    }
    if (commandName === 'loversmile') {
        settings.autoReactions[interaction.options.getUser('user').id] = interaction.options.getString('emoji');
        return interaction.editReply({ content: '✅ Готово!' });
    }
    if (commandName === 'stopsmile') {
        delete settings.autoReactions[interaction.options.getUser('user').id];
        return interaction.editReply({ content: '✅ Убрано!' });
    }
    if (commandName === 'smilelist') {
        if (!Object.keys(settings.autoReactions).length) return interaction.editReply({ content: '📋 Пусто' });
        let list = '';
        for (const [id, emoji] of Object.entries(settings.autoReactions)) {
            try { const u = await client.users.fetch(id); list += `- ${u.tag}: ${emoji}\n`; } catch { list += `- ${id}: ${emoji}\n`; }
        }
        return interaction.editReply({ content: `📋 Реакции:\n${list}` });
    }
    if (commandName === 'savesettings') {
        const json = JSON.stringify(settings);
        return interaction.editReply({ content: `Скопируй это в Railway → Variables:\n\`BOT_SETTINGS\`=\n\`\`\`\n${json}\n\`\`\`` });
    }
    if (commandName === 'settings') {
        return interaction.editReply({ content: `Вкл: ${settings.enabled}\nШанс: ${settings.roastChance}%\nРеакций: ${Object.keys(settings.autoReactions).length}` });
    }
    if (commandName === 'help') {
        return interaction.editReply({ content: '/toggle /roastchance /loversmile /stopsmile /smilelist /savesettings /settings /cleanup /help' });
    }
});

async function tryWorkers(workerUrl, backupUrl, body) {
    let r = await fetch(workerUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    let d = await r.json();
    if (d.reply) return d.reply;
    r = await fetch(backupUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    d = await r.json();
    return d.reply || null;
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    if (settings.autoReactions[message.author.id]) {
        try { await message.react(settings.autoReactions[message.author.id]); } catch (e) {}
    }
    
    if (!settings.enabled) return;
    if (message.content.startsWith('/')) return;
    
    const channelId = message.channel.id;
    let workerUrl, backupUrl;
    
    if (channelId === ROAST_CHANNEL) {
        if (Math.random() * 100 > settings.roastChance) return;
        workerUrl = ROAST_WORKER;
        backupUrl = ROAST_WORKER_BACKUP;
    } else if (channelId === HELPER_CHANNEL) {
        workerUrl = HELPER_WORKER;
        backupUrl = HELPER_WORKER;
    } else return;
    
    try {
        const messages = await message.channel.messages.fetch({ limit: 2 });
        const context = [];
        messages.reverse().forEach(msg => {
            if (msg.author.bot) return;
            if (!msg.content.startsWith('/') && !msg.content.includes(';')) {
                context.push({ author: msg.author.username, content: msg.content || '[фото]' });
            }
        });
        
        const reply = await tryWorkers(workerUrl, backupUrl, {
            message: message.content || '[фото]',
            context, currentAuthor: message.author.username
        });
        
        if (reply) await message.reply(reply.substring(0, 500));
    } catch (err) {
        console.error('❌', err.message);
    }
});

client.login(TOKEN);
