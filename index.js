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

// Парсинг страницы предмета
async function parseItemPage(html) {
    const seasons = [];
    const seasonRegex = /<div class="item_ver">([^<]+)<\/div>/g;
    let seasonMatch;
    
    while ((seasonMatch = seasonRegex.exec(html)) !== null) {
        const seasonName = seasonMatch[1].trim();
        const blockStart = html.lastIndexOf('<div class="card ui_item', seasonMatch.index);
        const blockEnd = html.indexOf('</div>\n</div>\n</div>', blockStart);
        if (blockEnd === -1) continue;
        const block = html.substring(blockStart, blockEnd + 6);
        
        const titleMatch = block.match(/<h5[^>]*>([^<]+)<\/h5>/);
        const imgMatch = block.match(/<img[^>]*src="([^"]+)"[^>]*>/);
        const levelMatch = block.match(/<div class="level">(\d+)<\/div>/);
        
        const params = {};
        const paramRegex = /<div class="d-flex justify-content-center">\s*<div>([^<]+)<\/div>\s*<div class="ps-2">([^<]+)<\/div>\s*<\/div>/g;
        let paramMatch;
        while ((paramMatch = paramRegex.exec(block)) !== null) {
            params[paramMatch[1].trim()] = paramMatch[2].trim();
        }
        
        const tags = [];
        const tagRegex = /<span class="[^"]*tag[^"]*">([^<]+)<\/span>/g;
        let tagMatch;
        while ((tagMatch = tagRegex.exec(block)) !== null) {
            tags.push(tagMatch[1].trim());
        }
        
        seasons.push({
            season: seasonName,
            title: titleMatch ? titleMatch[1].trim() : '',
            image: imgMatch ? imgMatch[1] : '',
            level: levelMatch ? parseInt(levelMatch[1]) : 0,
            params, tags
        });
    }
    
    // Парсим таблицу прогрессии
    const progression = [];
    const tableRegex = /<tbody>([\s\S]*?)<\/tbody>/g;
    let tableMatch;
    
    while ((tableMatch = tableRegex.exec(html)) !== null) {
        const tbody = tableMatch[1];
        const rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
        let rowMatch;
        
        while ((rowMatch = rowRegex.exec(tbody)) !== null) {
            const row = rowMatch[1];
            const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g);
            if (cells && cells.length >= 2) {
                const level = parseInt(cells[0].replace(/<[^>]+>/g, '').trim());
                const efficiency = cells[1] ? cells[1].replace(/<[^>]+>/g, '').trim() : '';
                const damage = cells[2] ? cells[2].replace(/<[^>]+>/g, '').trim() : '';
                if (!isNaN(level)) {
                    progression.push({ level, efficiency, damage });
                }
            }
        }
    }
    
    return { seasons, progression };
}

// Прямой поиск предмета на tlidb
async function searchTlidb(name, lang = 'ru') {
    const cleanName = name.replace(/\s+/g, '_').replace(/'/g, '%27');
    
    // Пробуем прямой URL
    const directUrl = `https://tlidb.com/${lang}/${cleanName}`;
    try {
        const response = await fetch(directUrl, { redirect: 'manual' });
        if (response.status === 200) {
            const html = await response.text();
            const data = await parseItemPage(html);
            if (data.seasons.length > 0 || data.progression.length > 0) {
                return { ...data, url: directUrl };
            }
        }
    } catch (e) {}
    
    // Пробуем через поиск
    const searchUrl = `https://tlidb.com/${lang}/search?q=${encodeURIComponent(name)}`;
    const searchResponse = await fetch(searchUrl);
    
    // Если поиск перекинул на страницу предмета
    if (searchResponse.url && searchResponse.url.includes('/') && !searchResponse.url.includes('/search')) {
        const html = await searchResponse.text();
        const data = await parseItemPage(html);
        if (data.seasons.length > 0 || data.progression.length > 0) {
            return { ...data, url: searchResponse.url };
        }
    }
    
    // Парсим результаты поиска
    const html = await searchResponse.text();
    const data = await parseItemPage(html);
    
    // Если нет прямых совпадений, ищем ссылки в результатах
    if (data.seasons.length === 0 && data.progression.length === 0) {
        const linkRegex = /<a[^>]*href="(\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
        let match;
        const links = [];
        while ((match = linkRegex.exec(html)) !== null) {
            const link = match[1];
            const text = match[2].trim();
            if (link.includes('/') && text.length > 3 && !text.includes('<')) {
                links.push({ title: text, url: `https://tlidb.com${link}` });
            }
        }
        return { ...data, url: searchUrl, suggestions: links.slice(0, 5) };
    }
    
    return { ...data, url: searchUrl };
}

// Форматирование результата
function formatResult(data, topic, action, levels = []) {
    const { seasons, progression, url, suggestions } = data;
    
    // Если ничего не найдено
    if (seasons.length === 0 && progression.length === 0) {
        let result = `## ❌ Ничего не найдено\n`;
        if (suggestions && suggestions.length > 0) {
            result += `**Возможно вы искали:**\n`;
            suggestions.forEach(s => result += `• [${s.title}](${s.url})\n`);
        } else {
            result += `[Открыть поиск на tlidb.com](${url})`;
        }
        return result;
    }
    
    // Сравнение уровней
    if (action === 'level_diff' && levels.length >= 2 && progression.length > 0) {
        const [lvl1, lvl2] = levels.slice(0, 2).sort((a,b) => a-b);
        const row1 = progression.find(r => r.level === lvl1);
        const row2 = progression.find(r => r.level === lvl2);
        
        if (row1 && row2) {
            const eff1 = parseFloat(row1.efficiency) || 0;
            const eff2 = parseFloat(row2.efficiency) || 0;
            const diff = eff2 - eff1;
            
            let result = `## 📊 ${topic}\n**${seasons[0]?.title || ''}**\n\n`;
            result += `| Параметр | Ур.${lvl1} | Ур.${lvl2} | Изменение |\n|---|---|---|---|\n`;
            result += `| Эффективность | ${row1.efficiency} | ${row2.efficiency} | ${diff > 0 ? '📈 +'+diff+'%' : diff < 0 ? '📉 '+diff+'%' : '➡️ 0'} |\n`;
            result += `| Урон | ${row1.damage || '—'} | ${row2.damage || '—'} | — |\n`;
            if (diff !== 0) result += `\n### 🎯 Итог\nПрокачка с ${lvl1} на ${lvl2}: **${diff > 0 ? '+' : ''}${diff}%** (≈${(diff/(lvl2-lvl1)).toFixed(1)}% за уровень)`;
            result += `\n\n[Открыть на tlidb](${url})`;
            return result;
        }
    }
    
    // Сравнение сезонов
    if (action === 'compare' && seasons.length >= 2) {
        const [current, previous] = seasons;
        let result = `## 📊 ${topic}\n### ${current.season} vs ${previous.season}\n\n`;
        result += `| Параметр | ${current.season} | ${previous.season} | Изменение |\n|---|---|---|---|\n`;
        const allKeys = new Set([...Object.keys(current.params), ...Object.keys(previous.params)]);
        for (const key of allKeys) {
            const curr = current.params[key] || '—';
            const prev = previous.params[key] || '—';
            const cNum = parseFloat(curr), pNum = parseFloat(prev);
            const change = !isNaN(cNum) && !isNaN(pNum) ? (cNum-pNum > 0 ? '📈 +'+(cNum-pNum) : cNum-pNum < 0 ? '📉 '+(cNum-pNum) : '➡️ 0') : '🔄';
            result += `| ${key} | ${curr} | ${prev} | ${change} |\n`;
        }
        result += `\n[Открыть на tlidb](${url})`;
        return result;
    }
    
    // Прогрессия
    if (action === 'progression' && progression.length > 0) {
        let result = `## 📈 ${topic}\n**${seasons[0]?.title || ''}**\n\n`;
        result += `| Ур. | Эффект. | Урон | +% |\n|---|---|---|---|\n`;
        let prev = 0;
        for (const row of progression.slice(0, 15)) {
            const curr = parseFloat(row.efficiency) || 0;
            result += `| ${row.level} | ${row.efficiency} | ${row.damage || '—'} | ${prev > 0 ? '+'+(curr-prev).toFixed(1)+'%' : '—'} |\n`;
            prev = curr;
        }
        if (progression.length > 15) result += `| ... | ... | ... | ... |\n`;
        result += `\n[Открыть на tlidb](${url})`;
        return result;
    }
    
    // Обычный поиск
    let result = `## 🔍 ${topic}\n`;
    for (const season of seasons.slice(0, 2)) {
        result += `### 🏷 ${season.season} — ${season.title}\n`;
        if (season.tags.length) result += `🎯 ${season.tags.join(' · ')}\n`;
        for (const [k, v] of Object.entries(season.params)) result += `• ${k}: **${v}**\n`;
        result += `\n`;
    }
    if (progression.length > 0) result += `📊 Доступна прогрессия уровней!\n`;
    result += `\n[Открыть на tlidb](${url})`;
    return result;
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
        .addStringOption(o => o.setName('query').setDescription('Что искать').setRequired(true))
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
    
    if (commandName === 'tlidb') {
        await interaction.deferReply();
        const query = interaction.options.getString('query');
        const forcedLang = interaction.options.getString('lang');
        
        // AI анализирует запрос
        const aiRes = await fetch(HELPER_WORKER, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                message: `Проанализируй запрос о Torchlight Infinite: "${query}". ${forcedLang ? 'Язык: '+forcedLang : 'Определи язык сам (ru/en)'}.

Ответь СТРОГО ТОЛЬКО JSON:
{"name":"ТОЧНОЕ название для поиска на tlidb","lang":"ru или en","action":"search/compare/progression/level_diff","levels":[числа],"topic":"краткое описание"}

Извлеки ТОЛЬКО название предмета/скилла/героя. "тандер спайк 21 35" → name:"Thunder Spike" levels:[21,35] action:"level_diff"
"что поменяли у геммы" → name:"Gemma" action:"compare"
"лип атак" → name:"Leap Attack" или "Атака в прыжке" action:"search"`,
                currentAuthor: interaction.user.username, context: [] 
            })
        });
        
        let aiData;
        try {
            const aiText = (await aiRes.json()).reply || '';
            const jsonMatch = aiText.match(/\{[\s\S]*\}/);
            aiData = jsonMatch ? JSON.parse(jsonMatch[0]) : { name: query, lang: forcedLang || 'ru', action: 'search', levels: [], topic: query };
        } catch (e) {
            aiData = { name: query, lang: forcedLang || 'ru', action: 'search', levels: [], topic: query };
        }
        
        const { name, lang, action, levels, topic } = aiData;
        console.log(`🔍 "${query}" → "${name}" [${lang}] ${action} ур.${levels.join(',')}`);
        
        try {
            const data = await searchTlidb(name, lang);
            const result = formatResult(data, topic || query, action, levels);
            await interaction.editReply({ content: result.substring(0, 2000) });
        } catch (e) {
            await interaction.editReply({ content: `❌ Ошибка: ${e.message}` });
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
            reactCollector.on('collect', async () => {
                if (wheelHeroes.length <= 1) { reactCollector.stop(); return; }
                for (let spin = 0; spin < 5; spin++) {
                    await new Promise(r => setTimeout(r, 300));
                    const shifted = [...wheelHeroes];
                    for (let s = 0; s < spin; s++) shifted.push(shifted.shift());
                    await wheelMsg.edit({ content: buildWheel(shifted, spin % shifted.length, ['🎰','🌀','💫','⚡','🎲'][spin % 5]) });
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
            const arr = Array.isArray(settings.autoReactions[msg.author.id]) ? settings.autoReactions[msg.author.id] : [settings.autoReactions[msg.author.id]];
            for (const emoji of arr) {
                if (!msg.reactions.cache.some(r => r.emoji.toString() === emoji)) await msg.react(emoji);
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
