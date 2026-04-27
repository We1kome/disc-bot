import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || "1498208678723977216";
const OWNER_ID = process.env.OWNER_ID;
const WORKER_URL = "https://loverbot.vladikkotik3.workers.dev";

const NORMAL_CHANNEL = "1498239736320622684"; // Всегда адекватный
const ROAST_CHANNEL = "857600197809668159";   // С шансом агрессии

if (!TOKEN || !OWNER_ID) {
    console.error('❌ Нужны переменные: DISCORD_TOKEN, OWNER_ID');
    process.exit(1);
}

const settings = {
    enabled: true,
    mode: 'agressive',
    admins: [],
    whitelist: [],
    blacklist: [],
    roastChance: 25,
    customPrompt: null
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

function isOwner(userId) { return userId === OWNER_ID; }
function isAdmin(userId) { return userId === OWNER_ID || settings.admins.includes(userId); }

function autoWhitelist(userId) {
    if (!settings.whitelist.includes(userId) && !settings.blacklist.includes(userId)) {
        settings.whitelist.push(userId);
    }
}

const commands = [
    new SlashCommandBuilder()
        .setName('mode').setDescription('Сменить режим бота')
        .addStringOption(opt => opt.setName('type').setDescription('Режим').setRequired(true)
            .addChoices(
                { name: '😡 Агрессивный', value: 'agressive' },
                { name: '😊 Адекватный', value: 'normal' },
                { name: '😐 Нейтральный', value: 'neutral' }
            )),
    new SlashCommandBuilder().setName('settings').setDescription('Настройки'),
    new SlashCommandBuilder()
        .setName('toggle').setDescription('Вкл/выкл')
        .addStringOption(opt => opt.setName('state').setDescription('Состояние').setRequired(true)
            .addChoices({ name: '✅ Вкл', value: 'on' }, { name: '❌ Выкл', value: 'off' })),
    new SlashCommandBuilder()
        .setName('roastchance').setDescription('Шанс агро-ответа в канале #чат (0-100%)')
        .addIntegerOption(opt => opt.setName('percent').setDescription('Процент').setRequired(true).setMinValue(0).setMaxValue(100)),
    new SlashCommandBuilder()
        .setName('roast').setDescription('Оскорбить')
        .addUserOption(opt => opt.setName('user').setDescription('Жертва').setRequired(false)),
    new SlashCommandBuilder()
        .setName('blacklist').setDescription('Чёрный список')
        .addStringOption(opt => opt.setName('action').setDescription('Действие').setRequired(true)
            .addChoices(
                { name: '➕ Добавить', value: 'add' },
                { name: '➖ Удалить', value: 'remove' },
                { name: '📋 Показать', value: 'show' }
            ))
        .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(false)),
    new SlashCommandBuilder()
        .setName('loveadmin').setDescription('🔒 Админы')
        .addStringOption(opt => opt.setName('action').setDescription('Действие').setRequired(true)
            .addChoices(
                { name: '➕ Добавить', value: 'add' },
                { name: '➖ Удалить', value: 'remove' },
                { name: '📋 Список', value: 'list' }
            ))
        .addUserOption(opt => opt.setName('user').setDescription('Пользователь').setRequired(false)),
    new SlashCommandBuilder()
        .setName('custom').setDescription('Кастомный промпт')
        .addStringOption(opt => opt.setName('text').setDescription('Текст').setRequired(false)),
    new SlashCommandBuilder().setName('help').setDescription('Список команд')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
    try {
        console.log('🗑 Очистка...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
        await new Promise(r => setTimeout(r, 2000));
        console.log('🔄 Регистрация...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Готово!');
    } catch (e) { console.error(e.message); }
}

client.on('ready', async () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
    await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName } = interaction;
    console.log(`🔧 /${commandName} от ${interaction.user.username}`);
    await interaction.deferReply({ flags: 64 });
    
    if (commandName === 'loveadmin') {
        if (!isOwner(interaction.user.id)) return interaction.editReply({ content: '🔒 Только владелец!' });
        const action = interaction.options.getString('action');
        if (action === 'list') {
            if (!settings.admins.length) return interaction.editReply({ content: '📋 Пусто.' });
            const names = await Promise.all(settings.admins.map(async id => {
                try { const u = await client.users.fetch(id); return `- ${u.tag}`; } catch { return `- ${id}`; }
            }));
            return interaction.editReply({ content: `📋 **Админы:**\n${names.join('\n')}` });
        }
        const user = interaction.options.getUser('user');
        if (!user) return interaction.editReply({ content: '❌ Укажи пользователя!' });
        if (user.id === OWNER_ID) return interaction.editReply({ content: '❌ Владелец всегда админ.' });
        if (action === 'add') {
            if (!settings.admins.includes(user.id)) { settings.admins.push(user.id); return interaction.editReply({ content: `✅ ${user.tag} админ.` }); }
            return interaction.editReply({ content: '⚠️ Уже админ.' });
        }
        settings.admins = settings.admins.filter(id => id !== user.id);
        return interaction.editReply({ content: `✅ ${user.tag} удалён.` });
    }
    
    if (commandName === 'help') {
        return interaction.editReply({ content: 
            '## 📋 Команды\n' +
            '**`/mode`** — режим\n' +
            '**`/toggle`** — вкл/выкл\n' +
            '**`/roastchance`** — шанс агро в чате\n' +
            '**`/roast`** — оскорбить\n' +
            '**`/blacklist`** — чёрный список\n' +
            '**`/settings`** — настройки\n' +
            '**`/help`** — это\n\n' +
            '💡 Whitelist авто!\n' +
            '📍 Канал <#' + NORMAL_CHANNEL + '> всегда адекватный\n' +
            '📍 Канал <#' + ROAST_CHANNEL + '> с шансом агро'
        });
    }
    
    if (commandName === 'roast') {
        if (!isAdmin(interaction.user.id)) return interaction.editReply({ content: '🚫 Нет прав!' });
        const targetUser = interaction.options.getUser('user');
        let target = targetUser ? `@${targetUser.username}` : 'чел';
        const response = await fetch(WORKER_URL, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: `Оскорби ${target}`, currentAuthor: interaction.user.username, mode: 'agressive' })
        });
        const data = await response.json();
        return interaction.editReply({ content: data.reply || 'Не вышло.' });
    }
    
    if (!isAdmin(interaction.user.id)) return interaction.editReply({ content: '🚫 Нет прав!' });
    
    switch (commandName) {
        case 'mode':
            settings.mode = interaction.options.getString('type');
            const names = { agressive: '😡 Агрессивный', normal: '😊 Адекватный', neutral: '😐 Нейтральный' };
            return interaction.editReply({ content: `✅ Режим: **${names[settings.mode]}**` });
        case 'settings':
            return interaction.editReply({ content: `⚙️ Режим: ${settings.mode}\nRoast: ${settings.roastChance}%\nWhitelist: ${settings.whitelist.length}\nBlacklist: ${settings.blacklist.length}\nАдминов: ${settings.admins.length}` });
        case 'toggle':
            settings.enabled = interaction.options.getString('state') === 'on';
            return interaction.editReply({ content: `✅ Бот **${settings.enabled ? 'включен' : 'выключен'}**` });
        case 'roastchance':
            settings.roastChance = interaction.options.getInteger('percent');
            return interaction.editReply({ content: `✅ Шанс агро: **${settings.roastChance}%**` });
        case 'blacklist': {
            const action = interaction.options.getString('action');
            const user = interaction.options.getUser('user');
            if (action === 'show') {
                if (!settings.blacklist.length) return interaction.editReply({ content: '📋 Пусто.' });
                const names = await Promise.all(settings.blacklist.map(async id => {
                    try { const u = await client.users.fetch(id); return `- ${u.tag}`; } catch { return `- ${id}`; }
                }));
                return interaction.editReply({ content: `📋 **Blacklist:**\n${names.join('\n')}` });
            }
            if (!user) return interaction.editReply({ content: '❌ Укажи пользователя!' });
            if (action === 'add') {
                if (!settings.blacklist.includes(user.id)) {
                    settings.blacklist.push(user.id);
                    settings.whitelist = settings.whitelist.filter(id => id !== user.id);
                    return interaction.editReply({ content: `✅ ${user.tag} в blacklist.` });
                }
                return interaction.editReply({ content: '⚠️ Уже там.' });
            }
            settings.blacklist = settings.blacklist.filter(id => id !== user.id);
            if (!settings.whitelist.includes(user.id)) settings.whitelist.push(user.id);
            return interaction.editReply({ content: `✅ ${user.tag} удалён.` });
        }
        case 'custom':
            settings.customPrompt = interaction.options.getString('text') || null;
            return interaction.editReply({ content: settings.customPrompt ? '✅ Установлен.' : '✅ Сброшен.' });
    }
});

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('/')) return;
    if (message.author.bot) return;
    if (!settings.enabled) return;
    if (message.content.includes(";")) return;
    
    autoWhitelist(message.author.id);
    if (settings.blacklist.includes(message.author.id)) return;
    
    const channelId = message.channel.id;
    
    // ВСЕГДА отвечаем в обоих каналах
    // Но режим зависит от канала
    let responseMode;
    let shouldReply = true;
    
    if (channelId === NORMAL_CHANNEL) {
        // Канал "всегда адекватный"
        responseMode = 'normal';
        console.log(`📍 Адекватный канал`);
    } else if (channelId === ROAST_CHANNEL) {
        // Канал с шансом агрессии
        if (Math.random() * 100 <= settings.roastChance) {
            responseMode = 'agressive';
            console.log(`🎲 ROAST! (шанс ${settings.roastChance}%)`);
        } else {
            // Не выпал шанс — не отвечаем вообще
            console.log(`⏭ Пропуск (roastChance ${settings.roastChance}%)`);
            return;
        }
    } else {
        // Другие каналы — обычный режим
        responseMode = settings.mode;
    }
    
    if (!messageHistory.has(channelId)) messageHistory.set(channelId, []);
    const history = messageHistory.get(channelId);
    let cleanContent = message.content;
    const mentionedUsers = message.mentions.users;
    
    if (mentionedUsers.size > 0) {
        mentionedUsers.forEach((user, id) => {
            cleanContent = cleanContent.replace(new RegExp(`<@!?${id}>`, 'g'), `@${user.username}`);
        });
    }
    
    history.push({ author: message.author.username, content: cleanContent, timestamp: Date.now() });
    if (history.length > 10) history.shift();
    
    console.log(`📨 [${message.author.username}] ${responseMode}: "${cleanContent}"`);
    
    try {
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: cleanContent,
                context: history.slice(-5),
                currentAuthor: message.author.username,
                mode: responseMode,
                customPrompt: settings.customPrompt
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
            console.log(`✅ Ответ отправлен`);
        }
    } catch (err) {
        console.error(`💥 Ошибка: ${err.message}`);
    }
});

client.login(TOKEN);
