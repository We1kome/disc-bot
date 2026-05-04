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

// Список героев Torchlight Infinite
const heroes = [
    { name: "Rehan", title: "Berserker | Anger", emoji: "🪓", color: "red" },
    { name: "Rehan", title: "Seething Silhouette", emoji: "👻", color: "red" },
    { name: "Carino", title: "Ranger of Glory", emoji: "🏹", color: "gold" },
    { name: "Carino", title: "Lethal Flash", emoji: "💥", color: "gold" },
    { name: "Carino", title: "Zealot of War", emoji: "⚔️", color: "gold" },
    { name: "Erika", title: "Wind Stalker", emoji: "🌪️", color: "green" },
    { name: "Erika", title: "Lightning Shadow", emoji: "⚡", color: "green" },
    { name: "Erika", title: "Vendetta's Sting", emoji: "🗡️", color: "green" },
    { name: "Bing", title: "Blast Nova", emoji: "💣", color: "orange" },
    { name: "Bing", title: "Creative Genius", emoji: "🧠", color: "orange" },
    { name: "Gemma", title: "Flame of Pleasure", emoji: "🔥", color: "blue" },
    { name: "Gemma", title: "Frostbitten Heart", emoji: "❄️", color: "blue" },
    { name: "Gemma", title: "Ice-Fire Fusion", emoji: "🌊", color: "blue" },
    { name: "Thea", title: "Wisdom of The Gods", emoji: "🦉", color: "purple" },
    { name: "Thea", title: "Incarnation of The Gods", emoji: "👼", color: "purple" },
    { name: "Thea", title: "Blasphemer", emoji: "😈", color: "purple" },
    { name: "Youga", title: "Spacetime Illusion", emoji: "🌀", color: "cyan" },
    { name: "Youga", title: "Spacetime Elapse", emoji: "⏳", color: "cyan" },
    { name: "Moto", title: "Order Calling", emoji: "🤖", color: "gray" },
    { name: "Moto", title: "Charge Calling", emoji: "💣", color: "gray" },
    { name: "Rosa", title: "High Court Chariot", emoji: "🛡️", color: "white" },
    { name: "Rosa", title: "Unsullied Blade", emoji: "🗡️", color: "white" },
    { name: "Iris", title: "Growing Breeze", emoji: "🌿", color: "lime" },
    { name: "Iris", title: "Vigilant Breeze", emoji: "💨", color: "lime" },
    { name: "Selena", title: "Sing with the Tide", emoji: "🌊", color: "aqua" },
    { name: "Sage", title: "Scent Weaver | Licorice Note", emoji: "🎵", color: "pink" }
];

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
            .setDescription('Эмодзи через пробел')
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
        .setName('wheel')
        .setDescription('Колесо фортуны — выбор героя Torchlight!')
        .addIntegerOption(o => o
            .setName('count')
            .setDescription('Сколько героев в колесе (3-8)')
            .setRequired(false)
            .setMinValue(3)
            .setMaxValue(8)),
    new SlashCommandBuilder()
        .setName('quiz')
        .setDescription('Оскорбительная викторина'),
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
            return interaction.editReply({ content: '✅ Команды очищены!' });
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
        return interaction.editReply({ content: `✅ Шанс агро: ${settings.roastChance}%` });
    }
    
    if (commandName === 'loversmile') {
        const emojiString = interaction.options.getString('emoji');
        const user = interaction.options.getUser('user');
        const emojis = emojiString.split(/\s+/).filter(e => e.trim() !== '');
        if (emojis.length === 0) return interaction.editReply({ content: '❌ Укажи хотя бы один эмодзи!' });
        settings.autoReactions[user.id] = emojis;
        return interaction.editReply({ content: `✅ Реакции ${emojis.join(' ')} на ${user.tag}` });
    }
    
    if (commandName === 'stopsmile') {
        const user = interaction.options.getUser('user');
        delete settings.autoReactions[user.id];
        return interaction.editReply({ content: `✅ Реакции для ${user.tag} убраны` });
    }
    
    if (commandName === 'smilelist') {
        const entries = Object.entries(settings.autoReactions);
        if (entries.length === 0) return interaction.editReply({ content: '📋 Пусто' });
        let list = '';
        for (const [userId, emojis] of entries) {
            try {
                const u = await client.users.fetch(userId);
                list += `- ${u.tag}: ${Array.isArray(emojis) ? emojis.join(' ') : emojis}\n`;
            } catch { list += `- ${userId}: ${emojis}\n`; }
        }
        return interaction.editReply({ content: `📋 **Реакции:**\n${list}` });
    }
    
    if (commandName === 'quiz') {
        await interaction.editReply({ content: '🤓 Нейронка придумывает вопрос...' });
        
        const quizResponse = await fetch(HELPER_WORKER, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Придумай короткий вопрос с подвохом. Только вопрос, без ответа.",
                currentAuthor: interaction.user.username,
                context: []
            })
        });
        const quizData = await quizResponse.json();
        const question = quizData.reply || "Сколько будет 2+2?";
        
        await interaction.editReply({ content: `🤓 **ВОПРОС:** ${question}\n_20 секунд на ответ!_` });
        
        const filter = m => m.author.id === interaction.user.id;
        const collector = interaction.channel.createMessageCollector({ filter, time: 20000, max: 1 });
        
        collector.on('collect', async (m) => {
            const judgeResponse = await fetch(HELPER_WORKER, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: `Вопрос: "${question}"\nОтвет: "${m.content}"\n\nОцени. Если правильно - похвали с матом. Если нет - жёстко оскорби. 2-3 предложения.`,
                    currentAuthor: interaction.user.username,
                    context: []
                })
            });
            const judgeData = await judgeResponse.json();
            await interaction.followUp({ content: judgeData.reply || "Не могу оценить!", reply: { messageReference: m.id } });
        });
        
        collector.on('end', collected => {
            if (collected.size === 0) interaction.followUp({ content: "Время вышло, тупица!" });
        });
        return;
    }
    
    if (commandName === 'wheel') {
        const count = interaction.options.getInteger('count') || 5;
        const shuffled = [...heroes].sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, count);
        const spinFrames = ['🎰', '🌀', '💫', '⚡', '🎲', '🔮'];
        
        const spinMsg = await interaction.editReply({ 
            content: `# 🎯 КОЛЕСО ФОРТУНЫ\n${spinFrames[0]} **Крутим...**\n` + 
                selected.map((h, i) => `${['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'][i]} ${h.emoji} ${h.name}`).join('\n')
        });
        
        for (let i = 0; i < 10; i++) {
            await new Promise(r => setTimeout(r, 400));
            const frame = spinFrames[i % spinFrames.length];
            const highlighted = selected.map((h, idx) => 
                idx === i % selected.length ? `**➡️ ${h.emoji} ${h.name}** ⬅️` : `${h.emoji} ${h.name}`
            ).join('\n');
            await spinMsg.edit({ content: `# 🎯 КОЛЕСО ФОРТУНЫ\n${frame} **Крутится...**\n${highlighted}` });
        }
        
        const winner = selected[Math.floor(Math.random() * selected.length)];
        const ansiColors = {
            red: '\u001b[31m', gold: '\u001b[33m', green: '\u001b[32m',
            blue: '\u001b[34m', purple: '\u001b[35m', orange: '\u001b[38;5;214m',
            cyan: '\u001b[36m', gray: '\u001b[37m', white: '\u001b[37;1m',
            lime: '\u001b[92m', aqua: '\u001b[96m', pink: '\u001b[95m'
        };
        
        await spinMsg.edit({
            content: `# 🎯 КОЛЕСО ФОРТУНЫ\n## 🏆 Выпал: ${winner.emoji} **${winner.name}** — ${winner.title}!\n` +
                `\`\`\`ansi\n${ansiColors[winner.color] || ''}█▀█ █▀█ █▀▄ █▀█ █░█ █░░ █▄█ █▀▀ █▀▄▀█\n` +
                `█▀▀ █▀█ █▄▀ █▀█ █▄█ █▄▄ ░█░ ██▄ █░▀░█\n\u001b[0m\n` +
                `Герой: ${winner.emoji} **${winner.name}** — *${winner.title}*\`\`\``
        });
        return;
    }
    
    if (commandName === 'savesettings') {
        return interaction.editReply({ 
            content: `📋 Скопируй в Railway → Variables:\n**BOT_SETTINGS**\n\`\`\`json\n${JSON.stringify(settings)}\n\`\`\`` 
        });
    }
    
    if (commandName === 'settings') {
        return interaction.editReply({ 
            content: `⚙️ Вкл: ${settings.enabled}\nШанс: ${settings.roastChance}%\nРеакций: ${Object.keys(settings.autoReactions).length}` 
        });
    }
    
    if (commandName === 'help') {
        return interaction.editReply({ 
            content: `**📋 Команды:**\n/toggle /roastchance /loversmile /stopsmile /smilelist /wheel /quiz /savesettings /settings /cleanup /help` 
        });
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
        try {
            const emojis = settings.autoReactions[message.author.id];
            if (Array.isArray(emojis)) {
                for (const emoji of emojis) {
                    await message.react(emoji);
                    await new Promise(r => setTimeout(r, 200));
                }
            } else {
                await message.react(emojis);
            }
        } catch (e) {}
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
