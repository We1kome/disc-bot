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
    { name: "Rehan", title: "Berserker | Anger", emoji: "🪓" },
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
    { name: "Sage", title: "Scent Weaver | Licorice Note", emoji: "🎵" }
];

function buildWheel(heroesArr, highlightIdx = -1, spinEmoji = '🎰', loser = null) {
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
    new SlashCommandBuilder().setName('wheel').setDescription('Колесо героев')
        .addIntegerOption(o => o.setName('count').setDescription('2-8').setRequired(false).setMinValue(2).setMaxValue(8)),
    new SlashCommandBuilder().setName('quiz').setDescription('Викторина'),
    new SlashCommandBuilder().setName('tlidb').setDescription('Поиск в базе Torchlight Infinite')
        .addStringOption(o => o.setName('query').setDescription('Что искать (можно криво)').setRequired(true))
        .addStringOption(o => o.setName('lang').setDescription('Язык').setRequired(false)
            .addChoices({ name: 'Русский', value: 'ru' }, { name: 'English', value: 'en' })),
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
    if (interaction.user.id !== OWNER_ID && !['quiz', 'tlidb'].includes(interaction.commandName)) {
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
    
    // tlidb - доступна всем
    if (commandName === 'tlidb') {
        await interaction.deferReply();
        const query = interaction.options.getString('query');
        const lang = interaction.options.getString('lang') || 'ru';
        
        // Сначала AI исправляет кривой запрос
        const fixRes = await fetch(HELPER_WORKER, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                message: `Пользователь ищет в Torchlight Infinite: "${query}". Исправь на правильное английское название предмета/скилла/героя. Ответь ТОЛЬКО правильным названием, одним словом или фразой. Например: "лип слам" → "Leap Attack", "миррор" → "Mirror", "хх" → "Headhunter".`, 
                currentAuthor: interaction.user.username, context: [] 
            })
        });
        const fixData = await fixRes.json();
        const fixedQuery = fixData.reply || query;
        
        console.log(`🔍 Исправлено: "${query}" → "${fixedQuery}"`);
        
        // Ищем на tlidb
        const tlidbUrl = `https://tlidb.com/${lang}/search?q=${encodeURIComponent(fixedQuery)}`;
        
        try {
            const tlidbRes = await fetch(tlidbUrl);
            const html = await tlidbRes.text();
            
            // Парсим результаты
            const results = [];
            const cardRegex = /<div class="card ui_item[^"]*">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/g;
            let match;
            
            while ((match = cardRegex.exec(html)) !== null) {
                const card = match[1];
                const titleMatch = card.match(/<h5[^>]*>([^<]+)<\/h5>/);
                const imgMatch = card.match(/<img[^>]*src="([^"]+)"[^>]*>/);
                const title = titleMatch ? titleMatch[1].trim() : '';
                const image = imgMatch ? imgMatch[1] : '';
                
                const tags = [];
                const tagRegex = /<span class="[^"]*tag[^"]*">([^<]+)<\/span>/g;
                let tagMatch;
                while ((tagMatch = tagRegex.exec(card)) !== null) {
                    tags.push(tagMatch[1].trim());
                }
                
                const descMatch = card.match(/<div class="explicitMod">([\s\S]*?)<\/div>/);
                let description = descMatch ? descMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '';
                
                if (title) {
                    results.push({ title, image, tags, description: description.substring(0, 250) });
                }
            }
            
            if (results.length > 0) {
                let reply = `🔍 **${fixedQuery}**\n`;
                results.slice(0, 3).forEach((r, i) => {
                    reply += `\n**${i+1}. ${r.title}**\n`;
                    if (r.tags.length) reply += `🏷 ${r.tags.join(', ')}\n`;
                    if (r.description) reply += `📝 ${r.description}\n`;
                });
                reply += `\n🔗 https://tlidb.com/${lang}/search?q=${encodeURIComponent(fixedQuery)}`;
                await interaction.editReply({ content: reply.substring(0, 2000) });
            } else {
                await interaction.editReply({ content: `❌ Ничего не найдено по "${fixedQuery}"\n🔗 https://tlidb.com/${lang}/search?q=${encodeURIComponent(fixedQuery)}` });
            }
        } catch (e) {
            await interaction.editReply({ content: `❌ Ошибка поиска: ${e.message}` });
        }
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
        
        await interaction.editReply({ content: `# 🎯 ВЫБОР ГЕРОЕВ\n${heroList}\n\n**Напиши номера через пробел**\n_30 секунд!_` });
        
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
                
                for (let spin = 0; spin < 5; spin++) {
                    await new Promise(r => setTimeout(r, 300));
                    const shifted = [...wheelHeroes];
                    for (let s = 0; s < spin; s++) shifted.push(shifted.shift());
                    const emojis = ['🎰','🌀','💫','⚡','🎲'];
                    await wheelMsg.edit({ content: buildWheel(shifted, spin % shifted.length, emojis[spin % 5]) });
                }
                
                await new Promise(r => setTimeout(r, 500));
                const loser = wheelHeroes.splice(Math.floor(Math.random() * wheelHeroes.length), 1)[0];
                await wheelMsg.edit({ content: buildWheel(wheelHeroes, -1, '🎯', loser) });
                if (wheelHeroes.length === 1) reactCollector.stop();
            });
        });
        collector.on('end', c => { if (!c.size) interaction.followUp({ content: 'Время вышло!', flags: 64 }); });
        return;
    }
    if (commandName === 'savesettings') return interaction.editReply({ content: `BOT_SETTINGS=\n${JSON.stringify(settings)}` });
    if (commandName === 'settings') return interaction.editReply({ content: `Вкл: ${settings.enabled}\nШанс: ${settings.roastChance}%\nРеакций: ${Object.keys(settings.autoReactions).length}` });
    if (commandName === 'help') return interaction.editReply({ content: '/toggle /roastchance /loversmile /stopsmile /smilelist /wheel /quiz /tlidb /savesettings /settings /cleanup /help' });
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    const msg = reaction.message;
    if (msg.author && settings.autoReactions[msg.author.id]) {
        try {
            const emojis = settings.autoReactions[msg.author.id];
            const arr = Array.isArray(emojis) ? emojis : [emojis];
            for (const emoji of arr) {
                if (!msg.reactions.cache.some(r => r.emoji.toString() === emoji)) {
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
            const arr = Array.isArray(settings.autoReactions[message.author.id]) ? settings.autoReactions[message.author.id] : [settings.autoReactions[message.author.id]];
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
