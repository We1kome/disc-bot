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
    try { settings = JSON.parse(process.env.BOT_SETTINGS); } catch (e) {}
}

const heroes = [
    { name: "Rehan", title: "Berserker", emoji: "🪓" },
    { name: "Rehan", title: "Seething Silhouette", emoji: "👻" },
    { name: "Carino", title: "Ranger of Glory", emoji: "🏹" },
    { name: "Carino", title: "Lethal Flash", emoji: "💥" },
    { name: "Carino", title: "Zealot of War", emoji: "⚔️" },
    { name: "Erika", title: "Wind Stalker", emoji: "🌪️" },
    { name: "Erika", title: "Lightning Shadow", emoji: "⚡" },
    { name: "Erika", title: "Vendetta's Sting", emoji: "🗡️" },
    { name: "Bing", title: "Blast Nova", emoji: "💣" },
    { name: "Bing", title: "Creative Genius", emoji: "🧠" },
    { name: "Gemma", title: "Flame of Pleasure", emoji: "🔥" },
    { name: "Gemma", title: "Frostbitten Heart", emoji: "❄️" },
    { name: "Gemma", title: "Ice-Fire Fusion", emoji: "🌊" },
    { name: "Thea", title: "Wisdom of The Gods", emoji: "🦉" },
    { name: "Thea", title: "Incarnation of The Gods", emoji: "👼" },
    { name: "Thea", title: "Blasphemer", emoji: "😈" },
    { name: "Youga", title: "Spacetime Illusion", emoji: "🌀" },
    { name: "Youga", title: "Spacetime Elapse", emoji: "⏳" },
    { name: "Moto", title: "Order Calling", emoji: "🤖" },
    { name: "Moto", title: "Charge Calling", emoji: "💥" },
    { name: "Rosa", title: "High Court Chariot", emoji: "🛡️" },
    { name: "Rosa", title: "Unsullied Blade", emoji: "⚔️" },
    { name: "Iris", title: "Growing Breeze", emoji: "🌿" },
    { name: "Iris", title: "Vigilant Breeze", emoji: "💨" },
    { name: "Selena", title: "Sing with the Tide", emoji: "🌊" },
    { name: "Sage", title: "Scent Weaver", emoji: "🎵" }
];

function buildWheel(heroesArr, highlightIdx = -1, spinEmoji = '🎰', loser = null) {
    const numIcons = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'];
    let lines = [];
    heroesArr.forEach((h, i) => {
        let prefix = ' ';
        if (i === highlightIdx && !loser) prefix = '👉';
        if (loser && h === loser) prefix = '❌';
        lines.push(`${prefix} ${h.emoji} **${h.name}**`);
    });
    let header = `## ${spinEmoji} КОЛЕСО ФОРТУНЫ ${spinEmoji}`;
    let footer = loser 
        ? `\n❌ Выбыл: ${loser.emoji} **${loser.name}**\nОсталось: **${heroesArr.length}** | Жми 🎲`
        : `\nГероев: **${heroesArr.length}** | Жми 🎲 крутить!`;
    if (heroesArr.length === 1) footer = `\n## 🏆 ПОБЕДИТЕЛЬ: ${heroesArr[0].emoji} **${heroesArr[0].name}**!`;
    return `${header}\n${lines.join('\n')}${footer}`;
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions
    ]
});

const commands = [
    new SlashCommandBuilder().setName('toggle').setDescription('Вкл/выкл')
        .addStringOption(o => o.setName('state').setDescription('Состояние').setRequired(true)
            .addChoices({ name: 'Вкл', value: 'on' }, { name: 'Выкл', value: 'off' })),
    new SlashCommandBuilder().setName('roastchance').setDescription('Шанс агро')
        .addIntegerOption(o => o.setName('percent').setDescription('0-100').setRequired(true).setMinValue(0).setMaxValue(100)),
    new SlashCommandBuilder().setName('loversmile').setDescription('Авто-реакция')
        .addStringOption(o => o.setName('emoji').setDescription('Эмодзи').setRequired(true))
        .addUserOption(o => o.setName('user').setDescription('Пользователь').setRequired(true)),
    new SlashCommandBuilder().setName('stopsmile').setDescription('Убрать реакцию')
        .addUserOption(o => o.setName('user').setDescription('Пользователь').setRequired(true)),
    new SlashCommandBuilder().setName('smilelist').setDescription('Список реакций'),
    new SlashCommandBuilder().setName('wheel').setDescription('Колесо на выбывание')
        .addIntegerOption(o => o.setName('count').setDescription('2-8').setRequired(false).setMinValue(2).setMaxValue(8)),
    new SlashCommandBuilder().setName('quiz').setDescription('Викторина'),
    new SlashCommandBuilder().setName('savesettings').setDescription('Сохранить'),
    new SlashCommandBuilder().setName('settings').setDescription('Настройки'),
    new SlashCommandBuilder().setName('cleanup').setDescription('Очистка'),
    new SlashCommandBuilder().setName('help').setDescription('Помощь')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.on('ready', async () => {
    console.log('✅ Бот:', client.user.tag);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.user.id !== OWNER_ID && interaction.commandName !== 'quiz') {
        return interaction.reply({ content: 'Нет прав', flags: 64 });
    }
    
    const { commandName } = interaction;
    
    if (commandName === 'cleanup') {
        await interaction.deferReply({ flags: 64 });
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
        await new Promise(r => setTimeout(r, 2000));
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        return interaction.editReply({ content: '✅ Готово' });
    }
    
    if (commandName === 'quiz') {
        await interaction.deferReply();
        const qRes = await fetch(HELPER_WORKER, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Придумай лёгкий вопрос с юмором. Только вопрос.", currentAuthor: interaction.user.username, context: [] })
        });
        const qData = await qRes.json();
        const question = qData.reply || "2+2?";
        const prizes = ["💎 1000 FE", "🔮 Красный кристалл", "🔥 Легендарка", "👑 Титул"];
        const prize = prizes[Math.floor(Math.random() * prizes.length)];
        
        await interaction.editReply({ content: `# 🎉 ВИКТОРИНА!\n## Приз: ${prize}\n❓ ${question}\n_30 секунд!_` });
        
        const collector = interaction.channel.createMessageCollector({ filter: m => !m.author.bot, time: 30000 });
        collector.on('collect', async (m) => {
            const jRes = await fetch(HELPER_WORKER, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: `Вопрос: "${question}". ${m.author.username}: "${m.content}". Если правильно - обмани что выиграл приз, потом оскорби. Начни с "Поздравляю!"`, currentAuthor: m.author.username, context: [] })
            });
            const jData = await jRes.json();
            const verdict = jData.reply || "";
            if (verdict.includes('Поздравляю') || verdict.includes('выиграл')) {
                await interaction.followUp({ content: verdict });
                collector.stop();
            }
        });
        collector.on('end', c => { if (!c.size) interaction.followUp('Никто не ответил!'); });
        return;
    }
    
    await interaction.deferReply({ flags: 64 });
    
    if (commandName === 'toggle') {
        settings.enabled = interaction.options.getString('state') === 'on';
        return interaction.editReply({ content: settings.enabled ? '✅ Вкл' : '❌ Выкл' });
    }
    if (commandName === 'roastchance') {
        settings.roastChance = interaction.options.getInteger('percent');
        return interaction.editReply({ content: `✅ ${settings.roastChance}%` });
    }
    if (commandName === 'loversmile') {
        const emojis = interaction.options.getString('emoji').split(/\s+/).filter(e => e.trim());
        const user = interaction.options.getUser('user');
        if (!emojis.length) return interaction.editReply({ content: '❌ Нет эмодзи' });
        settings.autoReactions[user.id] = emojis;
        return interaction.editReply({ content: `✅ ${emojis.join(' ')} → ${user.tag}` });
    }
    if (commandName === 'stopsmile') {
        delete settings.autoReactions[interaction.options.getUser('user').id];
        return interaction.editReply({ content: '✅ Убрано' });
    }
    if (commandName === 'smilelist') {
        const entries = Object.entries(settings.autoReactions);
        if (!entries.length) return interaction.editReply({ content: '📋 Пусто' });
        return interaction.editReply({ content: entries.map(([id, e]) => `${Array.isArray(e)?e.join(' '):e} → <@${id}>`).join('\n') });
    }
    
    if (commandName === 'wheel') {
        const count = interaction.options.getInteger('count') || 5;
        const heroList = heroes.map((h, i) => `${i+1}. ${h.emoji} **${h.name}**`).join('\n');
        
        await interaction.editReply({ content: `# 🎯 ВЫБОР ГЕРОЕВ\n${heroList}\n\n**Напиши номера через пробел** (минимум 2)\n_30 секунд!_` });
        
        const filter = m => m.author.id === interaction.user.id;
        const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });
        
        collector.on('collect', async (m) => {
            const numbers = m.content.split(/\s+/).map(n => parseInt(n)).filter(n => n > 0 && n <= heroes.length);
            const unique = [...new Set(numbers)].slice(0, count);
            if (unique.length < 2) return interaction.followUp({ content: '❌ Минимум 2!', flags: 64 });
            
            let wheelHeroes = unique.map(i => heroes[i-1]);
            const wheelMsg = await interaction.followUp({ content: buildWheel(wheelHeroes) });
            await wheelMsg.react('🎲');
            
            const reactCollector = wheelMsg.createReactionCollector({ filter: (r, u) => r.emoji.name === '🎲' && !u.bot });
            
            reactCollector.on('collect', async (reaction, user) => {
                if (wheelHeroes.length <= 1) { reactCollector.stop(); return; }
                
                // Анимация
                for (let spin = 0; spin < 5; spin++) {
                    await new Promise(r => setTimeout(r, 300));
                    const shifted = [...wheelHeroes];
                    for (let s = 0; s < spin; s++) shifted.push(shifted.shift());
                    const emojis = ['🎰','🌀','💫','⚡','🎲'];
                    await wheelMsg.edit({ content: buildWheel(shifted, spin % shifted.length, emojis[spin % 5]) });
                }
                
                await new Promise(r => setTimeout(r, 500));
                const loserIdx = Math.floor(Math.random() * wheelHeroes.length);
                const loser = wheelHeroes.splice(loserIdx, 1)[0];
                
                await wheelMsg.edit({ content: buildWheel(wheelHeroes, -1, '🎯', loser) });
                
                if (wheelHeroes.length === 1) {
                    reactCollector.stop();
                }
            });
        });
        collector.on('end', c => { if (!c.size) interaction.followUp({ content: 'Время вышло!', flags: 64 }); });
        return;
    }
    
    if (commandName === 'savesettings') return interaction.editReply({ content: `BOT_SETTINGS=\n${JSON.stringify(settings)}` });
    if (commandName === 'settings') return interaction.editReply({ content: `Вкл: ${settings.enabled}\nШанс: ${settings.roastChance}%\nРеакций: ${Object.keys(settings.autoReactions).length}` });
    if (commandName === 'help') return interaction.editReply({ content: '/toggle /roastchance /loversmile /stopsmile /smilelist /wheel /quiz /savesettings /settings /cleanup /help' });
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    const msg = reaction.message;
    if (msg.author && settings.autoReactions[msg.author.id]) {
        try {
            const emojis = settings.autoReactions[msg.author.id];
            const arr = Array.isArray(emojis) ? emojis : [emojis];
            for (const emoji of arr) {
                const clean = emoji.replace(/<a?:.*?:\d+>/g, '');
                if (!msg.reactions.cache.some(r => r.emoji.name === clean || r.emoji.toString() === emoji)) {
                    await msg.react(emoji);
                }
            }
        } catch (e) {}
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    if (settings.autoReactions[message.author.id]) {
        try {
            const emojis = settings.autoReactions[message.author.id];
            const arr = Array.isArray(emojis) ? emojis : [emojis];
            for (const emoji of arr) {
                await message.react(emoji);
                await new Promise(r => setTimeout(r, 200));
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
        
        let r1 = await fetch(workerUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: message.content || '[фото]', context, currentAuthor: message.author.username }) });
        let d1 = await r1.json();
        let reply = d1.reply;
        if (!reply) {
            let r2 = await fetch(backupUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: message.content || '[фото]', context, currentAuthor: message.author.username }) });
            let d2 = await r2.json();
            reply = d2.reply;
        }
        if (reply) await message.reply(reply.substring(0, 500));
    } catch (err) {}
});

client.login(TOKEN);
