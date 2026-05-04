import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const OWNER_ID = process.env.OWNER_ID;
const ROAST_WORKER = process.env.ROAST_WORKER;
const ROAST_WORKER_BACKUP = process.env.ROAST_WORKER_BACKUP;
const HELPER_WORKER = process.env.HELPER_WORKER;
const ROAST_CHANNEL = process.env.ROAST_CHANNEL;
const HELPER_CHANNEL = process.env.HELPER_CHANNEL;
const TLIDB_CHANNEL = process.env.TLIDB_CHANNEL || "1500881477339058227";

if (!TOKEN || !CLIENT_ID || !OWNER_ID || !ROAST_WORKER || !ROAST_WORKER_BACKUP || !HELPER_WORKER || !ROAST_CHANNEL || !HELPER_CHANNEL) {
    console.error('Нет всех переменных');
    process.exit(1);
}

let settings = { enabled: true, roastChance: 20, autoReactions: {} };
if (process.env.BOT_SETTINGS) {
    try { settings = JSON.parse(process.env.BOT_SETTINGS); } catch (e) {}
}

const heroes = [
    { name: "Rehan", title: "Berserker | Anger", emoji: "🪓", id: "Anger" },
    { name: "Rehan", title: "Seething Silhouette", emoji: "👻", id: "Seething_Silhouette" },
    { name: "Carino", title: "Ranger of Glory", emoji: "🏹", id: "Ranger_of_Glory" },
    { name: "Carino", title: "Lethal Flash", emoji: "💥", id: "Lethal_Flash" },
    { name: "Carino", title: "Zealot of War", emoji: "⚔️", id: "Zealot_of_War" },
    { name: "Erika", title: "Wind Stalker", emoji: "🌪️", id: "Wind_Stalker" },
    { name: "Erika", title: "Lightning Shadow", emoji: "⚡", id: "Lightning_Shadow" },
    { name: "Erika", title: "Vendetta's Sting", emoji: "🗡️", id: "Vendetta%27s_Sting" },
    { name: "Bing", title: "Blast Nova", emoji: "💣", id: "Blast_Nova" },
    { name: "Bing", title: "Creative Genius", emoji: "🧠", id: "Creative_Genius" },
    { name: "Gemma", title: "Flame of Pleasure", emoji: "🔥", id: "Flame_of_Pleasure" },
    { name: "Gemma", title: "Frostbitten Heart", emoji: "❄️", id: "Frostbitten_Heart" },
    { name: "Gemma", title: "Ice-Fire Fusion", emoji: "🌊", id: "Ice-Fire_Fusion" },
    { name: "Thea", title: "Wisdom of The Gods", emoji: "🦉", id: "Wisdom_of_The_Gods" },
    { name: "Thea", title: "Incarnation of The Gods", emoji: "👼", id: "Incarnation_of_the_Gods" },
    { name: "Thea", title: "Blasphemer", emoji: "😈", id: "Blasphemer" },
    { name: "Youga", title: "Spacetime Illusion", emoji: "🌀", id: "Spacetime_Illusion" },
    { name: "Youga", title: "Spacetime Elapse", emoji: "⏳", id: "Spacetime_Elapse" },
    { name: "Moto", title: "Order Calling", emoji: "🤖", id: "Order_Calling" },
    { name: "Moto", title: "Charge Calling", emoji: "💥", id: "Charge_Calling" },
    { name: "Rosa", title: "High Court Chariot", emoji: "🛡️", id: "High_Court_Chariot" },
    { name: "Rosa", title: "Unsullied Blade", emoji: "⚔️", id: "Unsullied_Blade" },
    { name: "Iris", title: "Growing Breeze", emoji: "🌿", id: "Growing_Breeze" },
    { name: "Iris", title: "Vigilant Breeze", emoji: "💨", id: "Vigilant_Breeze" },
    { name: "Selena", title: "Sing with the Tide", emoji: "🌊", id: "Sing_with_the_Tide" },
    { name: "Sage", title: "Scent Weaver | Licorice Note", emoji: "🎵", id: "Licorice_Note" }
];

// Считаем повторы и добавляем номера
function getHeroDisplay(hero, index, allHeroes) {
    const sameNameCount = allHeroes.filter(h => h.name === hero.name).length;
    if (sameNameCount > 1) {
        const sameBefore = allHeroes.slice(0, index).filter(h => h.name === hero.name).length;
        return `${hero.name} ${sameBefore + 1}`;
    }
    return hero.name;
}

function buildWheel(heroesArr, highlightIdx = -1, spinEmoji = '🎰', loser = null) {
    let lines = [];
    heroesArr.forEach((h, i) => {
        let prefix = ' ';
        if (i === highlightIdx && !loser) prefix = '👉';
        if (loser && h === loser) prefix = '❌';
        const displayName = getHeroDisplay(h, heroes.indexOf(h), heroes);
        lines.push(`${prefix} ${h.emoji} **${displayName}**`);
    });
    let header = `## ${spinEmoji} КОЛЕСО ФОРТУНЫ ${spinEmoji}`;
    let footer = loser 
        ? `\n❌ Выбыл: ${loser.emoji} **${getHeroDisplay(loser, heroes.indexOf(loser), heroes)}**\nОсталось: **${heroesArr.length}** | Жми 🎲`
        : `\nГероев: **${heroesArr.length}** | Жми 🎲 крутить!`;
    if (heroesArr.length === 1) {
        const winner = heroesArr[0];
        footer = `\n## 🏆 ПОБЕДИТЕЛЬ: ${winner.emoji} **${getHeroDisplay(winner, heroes.indexOf(winner), heroes)}** — ${winner.title}!`;
    }
    return `${header}\n${lines.join('\n')}${footer}`;
}

function parseItemPage(html) {
    const seasons = [];
    const progression = [];
    let heroData = null;
    const isHero = html.includes('Характеристики героя') || html.includes('Hero Traits');
    
    if (isHero) {
        const heroSection = html.match(/<div id="[^"]*Характеристикигероя[^"]*">([\s\S]*?)(?=<div id="|<\/div class="tab-content">)/);
        if (heroSection) {
            const heroHtml = heroSection[1];
            const nameMatch = heroHtml.match(/<a[^>]*>([^<]+)<\/a>/);
            const imgMatch = heroHtml.match(/<img[^>]*src="([^"]*Portrait[^"]*128\.webp)"[^>]*>/);
            const descMatch = heroHtml.match(/<div class="card-body">[\s\S]*?<br\/>([^<]+)/);
            const traits = [];
            const traitBlocks = heroHtml.split(/<div class="fw-bold">/);
            for (let i = 1; i < Math.min(traitBlocks.length, 9); i++) {
                const block = traitBlocks[i];
                const nameEnd = block.indexOf('</div>');
                const traitName = block.substring(0, nameEnd).trim();
                const levelMatch = block.match(/Требуется (\d+) ур\./);
                const traitLevel = levelMatch ? levelMatch[1] : '?';
                const descMatch = block.match(/<div data-src="affix">([\s\S]*?)<\/div>/);
                let traitDesc = descMatch ? descMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 150) : '';
                traits.push({ name: traitName, level: traitLevel, description: traitDesc });
            }
            heroData = { name: nameMatch ? nameMatch[1].trim() : '', image: imgMatch ? imgMatch[1] : '', description: descMatch ? descMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 250) : '', traits };
            seasons.push({ season: 'Характеристики', title: heroData.name, image: heroData.image, level: 0, params: {}, tags: ['Герой'], description: heroData.description });
        }
    } else {
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
            while ((paramMatch = paramRegex.exec(block)) !== null) params[paramMatch[1].trim()] = paramMatch[2].trim();
            const tags = [];
            const tagRegex = /<span class="[^"]*tag[^"]*">([^<]+)<\/span>/g;
            let tagMatch;
            while ((tagMatch = tagRegex.exec(block)) !== null) tags.push(tagMatch[1].trim());
            const descMatch = block.match(/<div class="explicitMod">([\s\S]*?)<\/div>/);
            const description = descMatch ? descMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 400) : '';
            seasons.push({ season: seasonName, title: titleMatch ? titleMatch[1].trim() : '', image: imgMatch ? imgMatch[1] : '', level: levelMatch ? parseInt(levelMatch[1]) : 0, params, tags, description });
        }
        const tableRegex = /<tbody>([\s\S]*?)<\/tbody>/g;
        let tableMatch;
        while ((tableMatch = tableRegex.exec(html)) !== null) {
            const tbody = tableMatch[1];
            const rowRegex = /<tr>([\s\S]*?)<\/tr>/g;
            let rowMatch;
            while ((rowMatch = rowRegex.exec(tbody)) !== null && progression.length < 20) {
                const row = rowMatch[1];
                const cells = row.match(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g);
                if (cells && cells.length >= 2) {
                    const level = parseInt(cells[0].replace(/<[^>]+>/g, '').trim());
                    const efficiency = cells[1] ? cells[1].replace(/<[^>]+>/g, '').trim() : '';
                    const damage = cells[2] ? cells[2].replace(/<[^>]+>/g, '').trim() : '';
                    if (!isNaN(level)) progression.push({ level, efficiency, damage });
                }
            }
        }
    }
    return { seasons, progression, heroData };
}

// Прямой поиск по URL
async function searchTlidbDirect(name, lang) {
    const cleanName = name.replace(/\s+/g, '_').replace(/'/g, '%27');
    const url = `https://tlidb.com/${lang}/${cleanName}`;
    
    try {
        const response = await fetch(url);
        if (response.ok && !response.url.includes('/search')) {
            const html = await response.text();
            const data = parseItemPage(html);
            if (data.seasons.length > 0 || data.progression.length > 0) {
                return { ...data, url, found: true };
            }
        }
    } catch (e) {}
    return { seasons: [], progression: [], url, found: false };
}

// Поиск через поисковую строку сайта (для нечётких запросов)
async function searchTlidbSearch(name, lang) {
    const url = `https://tlidb.com/${lang}/search?q=${encodeURIComponent(name)}`;
    try {
        const response = await fetch(url);
        const html = await response.text();
        
        // Если поиск перенаправил на конкретную страницу
        if (response.url && !response.url.includes('/search')) {
            const data = parseItemPage(html);
            if (data.seasons.length > 0 || data.progression.length > 0) {
                return { ...data, url: response.url, found: true };
            }
        }
        
        const data = parseItemPage(html);
        
        // Ищем ссылки в результатах
        const links = [];
        const linkRegex = /<a[^>]*href="(\/(?:ru|en)\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
        let match;
        while ((match = linkRegex.exec(html)) !== null && links.length < 5) {
            const link = match[1], text = match[2].trim();
            if (text.length > 2 && !text.includes('<')) {
                links.push({ title: text, url: `https://tlidb.com${link}` });
            }
        }
        
        if (data.seasons.length > 0 || data.progression.length > 0) {
            return { ...data, url: response.url || url, found: true };
        }
        
        return { ...data, url, found: false, suggestions: links };
    } catch (e) {
        return { seasons: [], progression: [], url, found: false };
    }
}

// Умный поиск: AI переводит запрос в правильное название
async function smartSearch(query) {
    console.log(`🔍 Запрос: "${query}"`);
    
    // Шаг 1: AI переводит запрос в точное английское название
    const aiRes = await fetch(HELPER_WORKER, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            message: `Ты — переводчик для базы данных Torchlight Infinite. Переведи запрос игрока в ТОЧНОЕ английское название предмета/скилла/героя.

Запрос: "${query}"

Правила:
- "тандер спайк" → "Thunder Spike"
- "лип атак" → "Leap Attack"  
- "хх" → "Headhunter"
- "миррор" → "Mirror"
- "тандер спайк намб" → "Thunder Spike: Numb (Magnificent)" или "Thunder Spike Numb"
- "молниевый удар" → "Thunder Spike"
- Если не знаешь точное название — напиши "UNKNOWN"

Ответь ТОЛЬКО названием.`,
            currentAuthor: "user", context: [] 
        })
    });
    
    let exactName = query;
    try {
        const t = (await aiRes.json()).reply || '';
        exactName = t.replace(/["'`]/g, '').trim();
        if (exactName === 'UNKNOWN' || exactName.length < 2 || exactName.length > 80) exactName = query;
    } catch (e) {}
    
    console.log(`🔍 AI перевёл: "${query}" → "${exactName}"`);
    
    // Шаг 2: Пробуем прямой URL на en
    let result = await searchTlidbDirect(exactName, 'en');
    if (result.found) {
        console.log(`✅ Найдено через en прямой URL`);
        return { ...result, searchName: exactName };
    }
    
    // Шаг 3: Пробуем прямой URL на ru
    result = await searchTlidbDirect(exactName, 'ru');
    if (result.found) {
        console.log(`✅ Найдено через ru прямой URL`);
        return { ...result, searchName: exactName };
    }
    
    // Шаг 4: Пробуем поиск на en
    result = await searchTlidbSearch(exactName, 'en');
    if (result.found) {
        console.log(`✅ Найдено через en поиск`);
        return { ...result, searchName: exactName };
    }
    
    // Шаг 5: Пробуем поиск на ru
    result = await searchTlidbSearch(exactName, 'ru');
    if (result.found) {
        console.log(`✅ Найдено через ru поиск`);
        return { ...result, searchName: exactName };
    }
    
    // Шаг 6: Пробуем исходный запрос (если AI не справился)
    if (exactName !== query) {
        result = await searchTlidbSearch(query, 'en');
        if (result.found) {
            console.log(`✅ Найдено через исходный запрос en`);
            return { ...result, searchName: query };
        }
        result = await searchTlidbSearch(query, 'ru');
        if (result.found) {
            console.log(`✅ Найдено через исходный запрос ru`);
            return { ...result, searchName: query };
        }
    }
    
    console.log(`❌ Ничего не найдено`);
    return { seasons: [], progression: [], url: `https://tlidb.com/en/search?q=${encodeURIComponent(exactName)}`, found: false, searchName: exactName, suggestions: result?.suggestions || [] };
}

function formatResult(data, query) {
    const { seasons, progression, heroData, url, found, suggestions, searchName } = data;
    
    if (!found && seasons.length === 0 && progression.length === 0) {
        let result = `## ❌ Ничего не найдено\nИскал: **${searchName || query}**\n`;
        if (suggestions?.length) {
            result += `\n**Возможно вы искали:**\n`;
            suggestions.forEach(s => result += `• [${s.title}](${s.url})\n`);
        }
        result += `\n🔗 [Открыть поиск](${url})`;
        return result.substring(0, 2000);
    }
    
    if (heroData) {
        let result = `## 🦸 ${heroData.name}\n${heroData.description}\n\n### 📋 Характеристики:\n`;
        heroData.traits.forEach(t => result += `**${t.name}** (ур.${t.level})\n${t.description}\n\n`);
        result += `\n🔗 [Открыть](${url})`;
        return result.substring(0, 2000);
    }
    
    let result = `## 🔍 ${seasons[0]?.title || searchName}\n`;
    for (const season of seasons.slice(0, 2)) {
        result += `### 🏷 ${season.season}\n`;
        if (season.tags.length) result += `🎯 ${season.tags.join(' · ')}\n`;
        for (const [k, v] of Object.entries(season.params)) result += `• ${k}: **${v}**\n`;
        if (season.description) result += `\n📝 ${season.description}\n`;
        result += `\n`;
    }
    if (progression.length > 0) {
        result += `📊 Прогрессия: `;
        const first = progression[0], last = progression[progression.length-1];
        result += `ур.${first.level} (${first.efficiency}) → ур.${last.level} (${last.efficiency})\n`;
    }
    result += `\n🔗 [Открыть на tlidb](${url})`;
    return result.substring(0, 2000);
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
    new SlashCommandBuilder().setName('savesettings').setDescription('Сохранить'),
    new SlashCommandBuilder().setName('settings').setDescription('Настройки'),
    new SlashCommandBuilder().setName('cleanup').setDescription('Очистка'),
    new SlashCommandBuilder().setName('help').setDescription('Помощь')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.on('ready', async () => {
    console.log('✅ Бот:', client.user.tag);
    console.log('📋 TLIDB канал:', TLIDB_CHANNEL);
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Команды зарегистрированы');
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
        const qRes = await fetch(HELPER_WORKER, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Придумай лёгкий вопрос с юмором. Только вопрос.", currentAuthor: interaction.user.username, context: [] }) });
        const qData = await qRes.json();
        const question = qData.reply || "2+2?";
        await interaction.editReply({ content: `# 🎉 ВИКТОРИНА!\n## Приз: 💎 1000 FE\n❓ ${question}\n_30 секунд!_` });
        const collector = interaction.channel.createMessageCollector({ filter: m => !m.author.bot, time: 30000 });
        collector.on('collect', async (m) => {
            const jRes = await fetch(HELPER_WORKER, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: `Вопрос: "${question}". ${m.author.username}: "${m.content}". Если правильно - обмани что выиграл приз, оскорби. Начни с "Поздравляю!"`, currentAuthor: m.author.username, context: [] }) });
            const jData = await jRes.json();
            if ((jData.reply || "").includes('Поздравляю')) { await interaction.followUp({ content: jData.reply }); collector.stop(); }
        });
        collector.on('end', c => { if (!c.size) interaction.followUp('Никто не ответил!'); });
        return;
    }
    
    await interaction.deferReply({ flags: 64 });
    if (commandName === 'toggle') { settings.enabled = interaction.options.getString('state') === 'on'; return interaction.editReply({ content: settings.enabled ? '✅ Вкл' : '❌ Выкл' }); }
    if (commandName === 'roastchance') { settings.roastChance = interaction.options.getInteger('percent'); return interaction.editReply({ content: `✅ ${settings.roastChance}%` }); }
    if (commandName === 'loversmile') {
        const emojis = interaction.options.getString('emoji').split(/\s+/).filter(e => e.trim());
        const user = interaction.options.getUser('user');
        if (!emojis.length) return interaction.editReply({ content: '❌ Нет эмодзи' });
        settings.autoReactions[user.id] = emojis;
        return interaction.editReply({ content: `✅ ${emojis.join(' ')} → ${user.tag}` });
    }
    if (commandName === 'stopsmile') { delete settings.autoReactions[interaction.options.getUser('user').id]; return interaction.editReply({ content: '✅ Убрано' }); }
    if (commandName === 'smilelist') {
        const entries = Object.entries(settings.autoReactions);
        if (!entries.length) return interaction.editReply({ content: '📋 Пусто' });
        return interaction.editReply({ content: entries.map(([id, e]) => `${Array.isArray(e)?e.join(' '):e} → <@${id}>`).join('\n') });
    }
    if (commandName === 'wheel') {
        const count = interaction.options.getInteger('count') || 5;
        const heroList = heroes.map((h, i) => `${i+1}. ${h.emoji} **${getHeroDisplay(h, i, heroes)}** — ${h.title}`).join('\n');
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
    if (commandName === 'help') return interaction.editReply({ content: '/toggle /roastchance /loversmile /stopsmile /smilelist /wheel /quiz /savesettings /settings /cleanup /help' });
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
    
    // Авто-реакции
    if (settings.autoReactions[message.author.id]) {
        try {
            const arr = Array.isArray(settings.autoReactions[message.author.id]) ? settings.autoReactions[message.author.id] : [settings.autoReactions[message.author.id]];
            for (const emoji of arr) {
                await message.react(emoji);
                await new Promise(r => setTimeout(r, 200));
            }
        } catch (e) {}
    }
    
    // КАНАЛ TLIDB — авто-поиск
    if (message.channel.id === TLIDB_CHANNEL && !message.content.startsWith('/') && message.content.length > 2) {
        console.log(`📨 TLIDB: "${message.content}"`);
        try {
            await message.channel.sendTyping();
            const data = await smartSearch(message.content);
            const result = formatResult(data, message.content);
            await message.reply(result.substring(0, 2000));
            console.log('✅ TLIDB ответ');
        } catch (e) {
            console.error('❌ TLIDB:', e.message);
            await message.reply('❌ Ошибка поиска. Попробуй другой запрос.');
        }
        return;
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
            if (!msg.content.startsWith('/') && !msg.content.includes(';')) context.push({ author: msg.author.username, content: msg.content || '[фото]' });
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
