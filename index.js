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
    whitelist: [],
    blacklist: [],
    channels: [],
    replyChance: 100,
    roastChance: 15, // Шанс случайного агрессивного ответа (по умолчанию 15%)
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
        .setDescription('Включить или выключить бота')
        .addStringOption(option =>
            option.setName('state').setDescription('Состояние').setRequired(true)
                .addChoices(
                    { name: '✅ Включить', value: 'on' },
                    { name: '❌ Выключить', value: 'off' }
                )),
    
    new SlashCommandBuilder()
        .setName('chance')
        .setDescription('Шанс ответа бота (0-100%)')
        .addIntegerOption(option =>
            option.setName('percent').setDescription('Процент').setRequired(true)
                .setMinValue(0).setMaxValue(100)),
    
    new SlashCommandBuilder()
        .setName('roastchance')
        .setDescription('Шанс случайного агрессивного ответа (0-100%)')
        .addIntegerOption(option =>
            option.setName('percent').setDescription('Процент').setRequired(true)
                .setMinValue(0).setMaxValue(100)
                .setDescription('Вероятность что бот ответит агрессивно даже в адекватном режиме')),
    
    new SlashCommandBuilder()
        .setName('roast')
        .setDescription('Принудительно агрессивно ответить на последнее сообщение')
        .addUserOption(option =>
            option.setName('user').setDescription('Кого оскорбить').setRequired(false)),
    
    new SlashCommandBuilder()
        .setName('whitelist')
        .setDescription('Белый список — кому отвечать')
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
        .setDescription('🔒 Управление админами бота')
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
        .setDescription('Список всех команд бота')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

try {
    console.log('🔄 Регистрация команд...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Команды зарегистрированы!');
} catch (error) {
    console.error('❌ Ошибка:', error.message);
}

client.on('ready', () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
    console.log(`👑 Владелец: ${OWNER_ID}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    const { commandName } = interaction;
    console.log(`🔧 /${commandName} от ${interaction.user.username}`);
    
    // loveadmin — только владелец
    if (commandName === 'loveadmin') {
        if (!isOwner(interaction.user.id)) {
            return interaction.reply({ content: '🔒 Только владелец!', flags: 64 });
        }
        
        const action = interaction.options.getString('action');
        
        if (action === 'list') {
            if (settings.admins.length === 0) {
                return interaction.reply({ content: '📋 Список админов пуст.', flags: 64 });
            }
            const names = await Promise.all(settings.admins.map(async id => {
                try { const u = await client.users.fetch(id); return `- ${u.tag}`; } catch { return `- ${id}`; }
            }));
            return interaction.reply({ content: `📋 **Админы:**\n${names.join('\n')}`, flags: 64 });
        }
        
        const user = interaction.options.getUser('user');
        if (!user) return interaction.reply({ content: '❌ Укажи пользователя!', flags: 64 });
        if (user.id === OWNER_ID) return interaction.reply({ content: '❌ Владелец всегда админ.', flags: 64 });
        
        if (action === 'add') {
            if (!settings.admins.includes(user.id)) {
                settings.admins.push(user.id);
                return interaction.reply({ content: `✅ ${user.tag} теперь админ.`, flags: 64 });
            }
            return interaction.reply({ content: '⚠️ Уже админ.', flags: 64 });
        }
        
        if (action === 'remove') {
            settings.admins = settings.admins.filter(id => id !== user.id);
            return interaction.reply({ content: `✅ ${user.tag} удалён.`, flags: 64 });
        }
    }
    
    // help — доступна всем
    if (commandName === 'help') {
        let helpText = '## 📋 Команды бота Любимки\n\n';
        helpText += '**`/mode`** — сменить режим (агрессивный/адекватный/нейтральный)\n';
        helpText += '**`/toggle`** — вкл/выкл бота\n';
        helpText += '**`/chance`** — шанс ответа (0-100%)\n';
        helpText += '**`/roastchance`** — шанс случайного агро-ответа\n';
        helpText += '**`/roast`** — принудительный агро-ответ\n';
        helpText += '**`/settings`** — показать настройки\n';
        helpText += '**`/help`** — этот список\n';
        
        if (isAdmin(interaction.user.id)) {
            helpText += '\n**👥 Админские:**\n';
            helpText += '**`/whitelist`** — белый список\n';
            helpText += '**`/blacklist`** — чёрный список\n';
            helpText += '**`/custom`** — кастомный промпт\n';
        }
        
        if (isOwner(interaction.user.id)) {
            helpText += '\n**🔒 Владелец:**\n';
            helpText += '**`/loveadmin`** — управление админами\n';
        }
        
        return interaction.reply({ content: helpText, flags: 64 });
    }
    
    // roast — доступна админам
    if (commandName === 'roast') {
        if (!isAdmin(interaction.user.id)) {
            return interaction.reply({ content: '🚫 Нет прав!', flags: 64 });
        }
        
        const targetUser = interaction.options.getUser('user');
        let target;
        
        if (targetUser) {
            target = `@${targetUser.username}`;
        } else {
            // Без указания — ищем последнее сообщение в канале
            const channel = interaction.channel;
            const messages = await channel.messages.fetch({ limit: 5 });
            const lastMsg = messages.filter(m => !m.author.bot).first();
            if (lastMsg) {
                target = `@${lastMsg.author.username}`;
            } else {
                target = interaction.user.username;
            }
        }
        
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: `/roast ${target}`,
                currentAuthor: interaction.user.username,
                mode: 'agressive',
                forceRoast: true
            })
        });
        
        const data = await response.json();
        await interaction.reply({ content: data.reply || 'Хм, не получилось.' });
        return;
    }
    
    // Остальные команды — для админов
    if (!isAdmin(interaction.user.id)) {
        return interaction.reply({ content: '🚫 Нет прав!', flags: 64 });
    }
    
    switch (commandName) {
        case 'mode': {
            const mode = interaction.options.getString('type');
            settings.mode = mode;
            const names = { agressive: '😡 Агрессивный', normal: '😊 Адекватный', neutral: '😐 Нейтральный' };
            await interaction.reply({ content: `✅ Режим: **${names[mode]}**`, flags: 64 });
            break;
        }
        
        case 'settings': {
            const info = {
                enabled: settings.enabled,
                mode: settings.mode,
                replyChance: settings.replyChance + '%',
                roastChance: settings.roastChance + '%',
                admins: settings.admins.length,
                whitelist: settings.whitelist.length,
                blacklist: settings.blacklist.length
            };
            await interaction.reply({ content: `⚙️ **Настройки:**\n\`\`\`json\n${JSON.stringify(info, null, 2)}\n\`\`\``, flags: 64 });
            break;
        }
        
        case 'toggle': {
            settings.enabled = interaction.options.getString('state') === 'on';
            await interaction.reply({ content: `✅ Бот **${settings.enabled ? 'включен' : 'выключен'}**`, flags: 64 });
            break;
        }
        
        case 'chance': {
            settings.replyChance = interaction.options.getInteger('percent');
            await interaction.reply({ content: `✅ Шанс ответа: **${settings.replyChance}%**`, flags: 64 });
            break;
        }
        
        case 'roastchance': {
            settings.roastChance = interaction.options.getInteger('percent');
            await interaction.reply({ 
                content: `✅ Шанс случайного агро-ответа: **${settings.roastChance}%**\nРаботает даже в адекватном режиме!`, 
                flags: 64 
            });
            break;
        }
        
        case 'whitelist': await handleListCommand(interaction, 'whitelist'); break;
        case 'blacklist': await handleListCommand(interaction, 'blacklist'); break;
        
        case 'custom': {
            const text = interaction.options.getString('text');
            settings.customPrompt = text || null;
            await interaction.reply({ content: text ? '✅ Кастомный промпт установлен.' : '✅ Сброшен.', flags: 64 });
            break;
        }
    }
});

async function handleListCommand(interaction, listName) {
    const action = interaction.options.getString('action');
    const user = interaction.options.getUser('user');
    
    if (action === 'show') {
        const list = settings[listName];
        if (list.length === 0) return interaction.reply({ content: `📋 ${listName}: **пусто**`, flags: 64 });
        const names = await Promise.all(list.map(async id => {
            try { const u = await client.users.fetch(id); return `- ${u.tag}`; } catch { return `- ${id}`; }
        }));
        return interaction.reply({ content: `📋 **${listName}:**\n${names.join('\n')}`, flags: 64 });
    }
    
    if (action === 'clear') {
        settings[listName] = [];
        return interaction.reply({ content: `✅ ${listName} очищен`, flags: 64 });
    }
    
    if (!user) return interaction.reply({ content: '❌ Укажи пользователя', flags: 64 });
    
    if (action === 'add') {
        if (!settings[listName].includes(user.id)) {
            settings[listName].push(user.id);
            return interaction.reply({ content: `✅ ${user.tag} добавлен`, flags: 64 });
        }
        return interaction.reply({ content: '⚠️ Уже в списке', flags: 64 });
    }
    
    if (action === 'remove') {
        settings[listName] = settings[listName].filter(id => id !== user.id);
        return interaction.reply({ content: `✅ ${user.tag} удалён`, flags: 64 });
    }
}

client.on('messageCreate', async (message) => {
    if (message.content.startsWith('/')) return;
    if (message.author.bot) return;
    if (!settings.enabled) return;
    if (message.content.includes(";")) return;
    if (settings.blacklist.includes(message.author.id)) return;
    if (settings.whitelist.length > 0 && !settings.whitelist.includes(message.author.id)) return;
    if (settings.channels.length > 0 && !settings.channels.includes(message.channel.id)) return;
    
    // Проверяем шанс ответа
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
    
    // Определяем режим ответа
    let responseMode = settings.mode;
    
    // Roast chance — случайный агрессивный ответ
    const rollRoast = Math.random() * 100;
    if (rollRoast <= settings.roastChance && settings.mode !== 'agressive') {
        responseMode = 'agressive';
        console.log(`🎲 ROAST! Шанс ${settings.roastChance}%, выпало ${rollRoast.toFixed(1)}%`);
    }
    
    console.log(`📨 [${message.author.username}] режим:${responseMode}: "${cleanContent}"`);
    
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
            console.log(`✅ [${responseMode}] Ответ отправлен`);
        }
    } catch (err) {
        console.error(`💥 Ошибка: ${err.message}`);
    }
});

client.login(TOKEN);
