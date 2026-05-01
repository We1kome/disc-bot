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

let settings = { enabled: true, roastChance: 20, autoReactions: {} };

if (process.env.BOT_SETTINGS) {
    try {
        settings = JSON.parse(process.env.BOT_SETTINGS);
        if (!settings.autoReactions) settings.autoReactions = {};
        console.log('📂 Настройки загружены из переменной');
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

const commands = [
    new SlashCommandBuilder()
        .setName('toggle')
        .setDescription('Включить или выключить бота')
        .addStringOption(o => o
            .setName('state')
            .setDescription('Состояние')
            .setRequired(true)
            .addChoices(
                { name: 'Включить', value: 'on' }, 
                { name: 'Выключить', value: 'off' }
            )),
    new SlashCommandBuilder()
        .setName('roastchance')
        .setDescription('Шанс агрессивного ответа')
        .addIntegerOption(o => o
            .setName('percent')
            .setDescription('Процент от 0 до 100')
            .setRequired(true)
            .setMinValue(0)
            .setMaxValue(100)),
    new SlashCommandBuilder()
        .setName('loversmile')
        .setDescription('Поставить авто-реакции на пользователя')
        .addStringOption(o => o
            .setName('emoji')
            .setDescription('Эмодзи через пробел (например :p_w: :i_w: :d_w: :o_w: :r_w:)')
            .setRequired(true))
        .addUserOption(o => o
            .setName('user')
            .setDescription('Пользователь')
            .setRequired(true)),
    new SlashCommandBuilder()
        .setName('stopsmile')
        .setDescription('Убрать авто-реакцию с пользователя')
        .addUserOption(o => o
            .setName('user')
            .setDescription('Пользователь')
            .setRequired(true)),
    new SlashCommandBuilder()
        .setName('smilelist')
        .setDescription('Показать список авто-реакций'),
    new SlashCommandBuilder()
        .setName('savesettings')
        .setDescription('Вывести настройки для сохранения в Railway'),
    new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Показать текущие настройки'),
    new SlashCommandBuilder()
        .setName('cleanup')
        .setDescription('Очистить и перерегистрировать команды'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Список всех команд')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.on('ready', async () => {
    console.log('✅ Бот запущен:', client.user.tag);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Команды зарегистрированы');
    } catch (e) {
        console.error('❌ Ошибка регистрации команд:', e.message);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.user.id !== OWNER_ID) {
        return interaction.reply({ content: '🚫 Нет прав', flags: 64 });
    }
    
    const { commandName } = interaction;
    
    if (commandName === 'cleanup') {
        await interaction.deferReply({ flags: 64 });
        try {
            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
            await new Promise(r => setTimeout(r, 2000));
            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
            return interaction.editReply({ content: '✅ Команды очищены и перерегистрированы!' });
        } catch (e) {
            return interaction.editReply({ content: '❌ Ошибка: ' + e.message });
        }
    }
    
    await interaction.deferReply({ flags: 64 });
    
    if (commandName === 'toggle') {
        settings.enabled = interaction.options.getString('state') === 'on';
        return interaction.editReply({ content: settings.enabled ? '✅ Бот включен' : '❌ Бот выключен' });
    }
    
    if (commandName === 'roastchance') {
        settings.roastChance = interaction.options.getInteger('percent');
        return interaction.editReply({ content: `✅ Шанс агрессивного ответа: ${settings.roastChance}%` });
    }
    
    if (commandName === 'loversmile') {
        const emojiString = interaction.options.getString('emoji');
        const user = interaction.options.getUser('user');
        
        // Разбиваем на отдельные эмодзи
        const emojis = emojiString.split(/\s+/).filter(e => e.trim() !== '');
        
        if (emojis.length === 0) {
            return interaction.editReply({ content: '❌ Укажи хотя бы один эмодзи!' });
        }
        
        settings.autoReactions[user.id] = emojis;
        
        return interaction.editReply({ 
            content: `✅ Реакции ${emojis.join(' ')} будут ставиться на все сообщения ${user.tag}` 
        });
    }
    
    if (commandName === 'stopsmile') {
        const user = interaction.options.getUser('user');
        delete settings.autoReactions[user.id];
        return interaction.editReply({ content: `✅ Авто-реакции для ${user.tag} убраны` });
    }
    
    if (commandName === 'smilelist') {
        const entries = Object.entries(settings.autoReactions);
        if (entries.length === 0) {
            return interaction.editReply({ content: '📋 Список авто-реакций пуст' });
        }
        let list = '';
        for (const [userId, emojis] of entries) {
            try {
                const u = await client.users.fetch(userId);
                const emojiStr = Array.isArray(emojis) ? emojis.join(' ') : emojis;
                list += `- ${u.tag}: ${emojiStr}\n`;
            } catch {
                list += `- ${userId}: ${emojis}\n`;
            }
        }
        return interaction.editReply({ content: `📋 **Авто-реакции:**\n${list}` });
    }
    
    if (commandName === 'savesettings') {
        const json = JSON.stringify(settings);
        return interaction.editReply({ 
            content: `📋 Скопируй это в Railway → Variables:\n**BOT_SETTINGS**\n\`\`\`json\n${json}\n\`\`\`` 
        });
    }
    
    if (commandName === 'settings') {
        return interaction.editReply({ 
            content: `⚙️ **Настройки:**\nВключен: ${settings.enabled}\nШанс агро: ${settings.roastChance}%\nРеакций: ${Object.keys(settings.autoReactions).length}` 
        });
    }
    
    if (commandName === 'help') {
        return interaction.editReply({ 
            content: `**📋 Команды:**\n/toggle — вкл/выкл\n/roastchance — шанс агро\n/loversmile — авто-реакции (можно несколько через пробел)\n/stopsmile — убрать реакции\n/smilelist — список реакций\n/savesettings — сохранить настройки\n/settings — настройки\n/cleanup — очистить команды\n/help — этот список` 
        });
    }
});

async function tryWorkers(workerUrl, backupUrl, body) {
    let response = await fetch(workerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    let data = await response.json();
    if (data.reply) return data.reply;
    
    console.log('🔄 Пробую запасной Worker...');
    response = await fetch(backupUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    data = await response.json();
    return data.reply || null;
}

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Авто-реакции работают всегда
    if (settings.autoReactions[message.author.id]) {
        try {
            const emojis = settings.autoReactions[message.author.id];
            if (Array.isArray(emojis)) {
                // Ставим несколько реакций подряд
                for (const emoji of emojis) {
                    await message.react(emoji);
                    await new Promise(r => setTimeout(r, 200));
                }
            } else {
                // Одна реакция (для обратной совместимости)
                await message.react(emojis);
            }
        } catch (e) {
            console.log('❌ Ошибка реакции:', e.message);
        }
    }
    
    if (!settings.enabled) return;
    if (message.content.startsWith('/')) return;
    
    const channelId = message.channel.id;
    let workerUrl, backupUrl;
    
    if (channelId === ROAST_CHANNEL) {
        const roll = Math.random() * 100;
        console.log(`🎲 Шанс ${settings.roastChance}%, выпало ${roll.toFixed(1)}%`);
        if (roll > settings.roastChance) return;
        workerUrl = ROAST_WORKER;
        backupUrl = ROAST_WORKER_BACKUP;
    } else if (channelId === HELPER_CHANNEL) {
        workerUrl = HELPER_WORKER;
        backupUrl = HELPER_WORKER;
    } else {
        return;
    }
    
    try {
        const messages = await message.channel.messages.fetch({ limit: 2 });
        const context = [];
        messages.reverse().forEach(msg => {
            if (msg.author.bot) return;
            if (!msg.content.startsWith('/') && !msg.content.includes(';')) {
                let ctx = msg.author.username + ': ';
                ctx += msg.content || (msg.attachments.size > 0 ? '[фото]' : '');
                context.push({ author: msg.author.username, content: ctx });
            }
        });
        
        let sendMessage = message.content || (message.attachments.size > 0 ? '[фото]' : '');
        
        console.log(`📤 Запрос: "${sendMessage.substring(0, 50)}"`);
        
        const replyText = await tryWorkers(workerUrl, backupUrl, {
            message: sendMessage,
            context: context,
            currentAuthor: message.author.username
        });
        
        if (replyText) {
            let finalReply = replyText;
            if (finalReply.length > 500) finalReply = finalReply.substring(0, 497) + "...";
            await message.reply(finalReply);
            console.log('✅ Ответ отправлен');
        } else {
            console.log('🔇 Бот промолчал');
        }
    } catch (err) {
        console.error('❌ Ошибка:', err.message);
    }
});

client.login(TOKEN);
