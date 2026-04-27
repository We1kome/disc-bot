import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || "1498208678723977216";
const OWNER_ID = process.env.OWNER_ID;
const WORKER_URL = "https://loverbot.vladikkotik3.workers.dev";

if (!TOKEN || !OWNER_ID) {
    console.error('❌ Нужны переменные: DISCORD_TOKEN, OWNER_ID');
    process.exit(1);
}

const settings = {
    enabled: true,
    mode: 'agressive',
    admins: [],
    whitelist: [], // Заполняется автоматически
    blacklist: [],
    channels: [],
    replyChance: 100,
    roastChance: 15,
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

function isOwner(userId) {
    return userId === OWNER_ID;
}

function isAdmin(userId) {
    return userId === OWNER_ID || settings.admins.includes(userId);
}

// Автоматическое пополнение whitelist
function autoWhitelist(userId) {
    if (!settings.whitelist.includes(userId) && !settings.blacklist.includes(userId)) {
        settings.whitelist.push(userId);
        console.log(`✅ Авто-whitelist: ${userId}`);
    }
}

// Убираем chance, оставляем roastchance
const commands = [
    new SlashCommandBuilder()
        .setName('mode')
        .setDescription('Сменить режим бота')
        .addStringOption(option =>
            option.setName('type').setDescription('Режим').setRequired(true)
                .addChoices(
                    { name: '😡 Агрессивный (гопник)', value: 'agressive' },
                    { name: '😊 Адекватный (помощник)', value: 'normal' },
                    { name: '😐 Нейтральный', value: 'neutral' }
                )),
    
    new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Показать настройки бота'),
    
    new SlashCommandBuilder()
        .setName('toggle')
        .setDescription('Вкл/выкл бота')
        .addStringOption(option =>
            option.setName('state').setDescription('Состояние').setRequired(true)
                .addChoices(
                    { name: '✅ Включить', value: 'on' },
                    { name: '❌ Выключить', value: 'off' }
                )),
    
    new SlashCommandBuilder()
        .setName('roastchance')
        .setDescription('Шанс внезапного агрессивного ответа (0-100%)')
        .addIntegerOption(option =>
            option.setName('percent').setDescription('Процент').setRequired(true)
                .setMinValue(0).setMaxValue(100)),
    
    new SlashCommandBuilder()
        .setName('roast')
        .setDescription('Принудительно оскорбить кого-то')
        .addUserOption(option =>
            option.setName('user').setDescription('Жертва (пусто = последний писавший)').setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('blacklist')
        .setDescription('Чёрный список — кого игнорить')
        .addStringOption(option =>
            option.setName('action').setDescription('Действие').setRequired(true)
                .addChoices(
                    { name: '➕ Добавить', value: 'add' },
                    { name: '➖ Удалить', value: 'remove' },
                    { name: '🗑 Очистить', value: 'clear' },
                    { name: '📋 Показать', value: 'show' }
                ))
        .addUserOption(option =>
            option.setName('user').setDescription('Пользователь').setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('loveadmin')
        .setDescription('🔒 Управление админами (только владелец)')
        .addStringOption(option =>
            option.setName('action').setDescription('Действие').setRequired(true)
                .addChoices(
                    { name: '➕ Добавить админа', value: 'add' },
                    { name: '➖ Удалить админа', value: 'remove' },
                    { name: '📋 Список админов', value: 'list' }
                ))
        .addUserOption(option =>
            option.setName('user').setDescription('Пользователь').setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('custom')
        .setDescription('Кастомный промпт для нейтрального режима')
        .addStringOption(option =>
            option.setName('text').setDescription('Текст (пусто=сброс)').setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Список всех команд')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommands() {
    try {
        console.log('🗑 Очистка старых команд...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('🔄 Регистрация новых...');
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Команды зарегистрированы!');
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
    }
}

client.on('ready', async () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
    console.log(`👑 Владелец: ${OWNER_ID}`);
    await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName } = interaction;
    console.log(`🔧 /${commandName} от ${interaction.user.username}`);
    
    await interaction.deferReply({ flags: 64 });
    
    // loveadmin — только владелец
    if (commandName === 'loveadmin') {
        if (!isOwner(interaction.user.id)) {
            return interaction.editReply({ content: '🔒 Только владелец!' });
        }
        
        const action = interaction.options.getString('action');
        
        if (action === 'list') {
            if (settings.admins.length === 0) return interaction.editReply({ content: '📋 Админов нет.' });
            const names = await Promise.all(settings.admins.map(async id => {
                try { const u = await client.users.fetch(id); return `- ${u.tag}`; } catch { return `- ${id}`; }
            }));
            return interaction.editReply({ content: `📋 **Админы:**\n${names.join('\n')}` });
        }
        
        const user = interaction.options.getUser('user');
        if (!user) return interaction.editReply({ content: '❌ Укажи пользователя!' });
        if (user.id === OWNER_ID) return interaction.editReply({ content: '❌ Владелец всегда админ.' });
        
        if (action === 'add') {
            if (!settings.admins.includes(user.id)) {
                settings.admins.push(user.id);
                return interaction.editReply({ content: `✅ ${user.tag} теперь админ.` });
            }
            return interaction.editReply({ content: '⚠️ Уже админ.' });
        }
        
        if (action === 'remove') {
            settings.admins = settings.admins.filter(id => id !== user.id);
            return interaction.editReply({ content: `✅ ${user.tag} удалён.` });
        }
    }
    
    // help — всем
    if (commandName === 'help') {
        let helpText = '## 📋 Команды Любимки\n\n';
        helpText += '**`/mode`** — режим (агрессивный/адекватный/нейтральный)\n';
        helpText += '**`/toggle`** — вкл/выкл\n';
        helpText += '**`/roastchance`** — шанс внезапной агрессии (0-100%)\n';
        helpText += '**`/roast`** — оскорбить кого-то\n';
        helpText += '**`/blacklist`** — чёрный список (кого игнорить)\n';
        helpText += '**`/settings`** — настройки\n';
        helpText += '**`/help`** — этот список\n';
        helpText += '\n💡 Whitelist пополняется автоматически!\n';
        helpText += 'Убирай людей через `/blacklist add @user`\n';
        
        if (isAdmin(interaction.user.id)) {
            helpText += '\n**👥 Админ:** `/custom` — кастомный промпт\n';
        }
        if (isOwner(interaction.user.id)) {
            helpText += '**🔒 Владелец:** `/loveadmin` — управление админами\n';
        }
        
        return interaction.editReply({ content: helpText });
    }
    
    // roast — админы
    if (commandName === 'roast') {
        if (!isAdmin(interaction.user.id)) {
            return interaction.editReply({ content: '🚫 Нет прав!' });
        }
        
        const targetUser = interaction.options.getUser('user');
        let target;
        
        if (targetUser) {
            target = `@${targetUser.username}`;
        } else {
            const messages = await interaction.channel.messages.fetch({ limit: 5 });
            const lastMsg = messages.filter(m => !m.author.bot).first();
            target = lastMsg ? `@${lastMsg.author.username}` : 'чел';
        }
        
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: `Оскорби ${target}`,
                currentAuthor: interaction.user.username,
                mode: 'agressive'
            })
        });
        const data = await response.json();
        return interaction.editReply({ content: data.reply || 'Не вышло.' });
    }
    
    // Остальное — админы
    if (!isAdmin(interaction.user.id)) {
        return interaction.editReply({ content: '🚫 Нет прав!' });
    }
    
    switch (commandName) {
        case 'mode': {
            const mode = interaction.options.getString('type');
            settings.mode = mode;
            const names = { agressive: '😡 Агрессивный', normal: '😊 Адекватный', neutral: '😐 Нейтральный' };
            return interaction.editReply({ content: `✅ Режим: **${names[mode]}**` });
        }
        
        case 'settings': {
            return interaction.editReply({ 
                content: `⚙️ **Настройки:**\nВкл: ${settings.enabled}\nРежим: ${settings.mode}\nRoast шанс: ${settings.roastChance}%\nWhitelist: ${settings.whitelist.length} чел\nBlacklist: ${settings.blacklist.length} чел\nАдминов: ${settings.admins.length}`
            });
        }
        
        case 'toggle': {
            settings.enabled = interaction.options.getString('state') === 'on';
            return interaction.editReply({ content: `✅ Бот **${settings.enabled ? 'включен' : 'выключен'}**` });
        }
        
        case 'roastchance': {
            settings.roastChance = interaction.options.getInteger('percent');
            return interaction.editReply({ content: `✅ Шанс агро: **${settings.roastChance}%**` });
        }
        
        case 'blacklist': {
            return await handleBlacklistCommand(interaction);
        }
        
        case 'custom': {
            const text = interaction.options.getString('text');
            settings.customPrompt = text || null;
            return interaction.editReply({ content: text ? '✅ Промпт установлен.' : '✅ Сброшен.' });
        }
    }
});

async function handleBlacklistCommand(interaction) {
    const action = interaction.options.getString('action');
    const user = interaction.options.getUser('user');
    
    if (action === 'show') {
        if (settings.blacklist.length === 0) return interaction.editReply({ content: '📋 Blacklist пуст.' });
        const names = await Promise.all(settings.blacklist.map(async id => {
            try { const u = await client.users.fetch(id); return `- ${u.tag}`; } catch { return `- ${id}`; }
        }));
        return interaction.editReply({ content: `📋 **Blacklist:**\n${names.join('\n')}` });
    }
    
    if (action === 'clear') {
        settings.blacklist = [];
        return interaction.editReply({ content: '✅ Blacklist очищен.' });
    }
    
    if (!user) return interaction.editReply({ content: '❌ Укажи пользователя!' });
    
    if (action === 'add') {
        if (!settings.blacklist.includes(user.id)) {
            settings.blacklist.push(user.id);
            // Убираем из whitelist если был
            settings.whitelist = settings.whitelist.filter(id => id !== user.id);
            return interaction.editReply({ content: `✅ ${user.tag} в чёрном списке.` });
        }
        return interaction.editReply({ content: '⚠️ Уже в blacklist.' });
    }
    
    if (action === 'remove') {
        settings.blacklist = settings.blacklist.filter(id => id !== user.id);
        // Возвращаем в whitelist
        if (!settings.whitelist.includes(user.id)) {
            settings.whitelist.push(user.id);
        }
        return interaction.editReply({ content: `✅ ${user.tag} удалён из blacklist.` });
    }
}

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('/')) return;
    if (message.author.bot) return;
    if (!settings.enabled) return;
    if (message.content.includes(";")) return;
    
    // Автоматически добавляем в whitelist
    autoWhitelist(message.author.id);
    
    // Проверка blacklist
    if (settings.blacklist.includes(message.author.id)) return;
    if (settings.whitelist.length > 0 && !settings.whitelist.includes(message.author.id)) return;
    if (settings.channels.length > 0 && !settings.channels.includes(message.channel.id)) return;
    if (Math.random() * 100 > settings.replyChance) return;
    
    const channelId = message.channel.id;
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
    
    // Определяем режим
    let responseMode = settings.mode;
    if (Math.random() * 100 <= settings.roastChance && settings.mode !== 'agressive') {
        responseMode = 'agressive';
        console.log(`🎲 ROAST!`);
    }
    
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
