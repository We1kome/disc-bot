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
const POE2_TIMER_CHANNEL = process.env.POE2_TIMER_CHANNEL || ROAST_CHANNEL; // Канал для таймера

if (!TOKEN || !CLIENT_ID || !OWNER_ID || !ROAST_WORKER || !ROAST_WORKER_BACKUP || !HELPER_WORKER || !ROAST_CHANNEL || !HELPER_CHANNEL) {
    console.error('Нет всех переменных');
    process.exit(1);
}

let settings = { enabled: true, roastChance: 20, autoReactions: {}, admins: [] };
if (process.env.BOT_SETTINGS) {
    try { settings = JSON.parse(process.env.BOT_SETTINGS); if (!settings.admins) settings.admins = []; } catch (e) {}
}

// Хранилище таймера PoE2
let poe2TimerMessage = null;
let poe2TimerChannel = null;
let poe2TimerInterval = null;

function isOwner(userId) { return userId === OWNER_ID; }
function isAdmin(userId) { return userId === OWNER_ID || settings.admins.includes(userId); }

// ========== POE2 TIMER ==========
async function getPoE2TimerData() {
    try {
        // Пробуем API (более надёжный способ)
        const apiResponse = await fetch('https://pathofexile2.com/internal-api/content.json');
        if (apiResponse.ok) {
            const data = await apiResponse.json();
            
            // Ищем таймер в секциях страницы
            if (data && data.sections) {
                for (const section of data.sections) {
                    if (section.timer) {
                        const target = new Date(section.timer.target).getTime();
                        const now = Date.now();
                        const diff = target - now;
                        
                        if (diff <= 0) return { expired: true };
                        
                        return {
                            days: Math.floor(diff / 86400000),
                            hours: Math.floor((diff % 86400000) / 3600000),
                            minutes: Math.floor((diff % 3600000) / 60000),
                            seconds: Math.floor((diff % 60000) / 1000),
                            target: section.timer.target
                        };
                    }
                }
            }
        }
    } catch (e) {
        console.log('API не сработал, пробую HTML');
    }
    
    // Запасной вариант — парсим HTML
    try {
        const response = await fetch('https://pathofexile2.com/home');
        const html = await response.text();
        
        // Ищем дату в data атрибутах или скриптах
        const targetMatch = html.match(/"target":"([^"]+)"/);
        if (targetMatch) {
            const target = new Date(targetMatch[1]).getTime();
            const now = Date.now();
            const diff = target - now;
            
            if (diff <= 0) return { expired: true };
            
            return {
                days: Math.floor(diff / 86400000),
                hours: Math.floor((diff % 86400000) / 3600000),
                minutes: Math.floor((diff % 3600000) / 60000),
                seconds: Math.floor((diff % 60000) / 1000),
                target: targetMatch[1]
            };
        }
    } catch (e) {
        console.error('Ошибка HTML:', e.message);
    }
    
    return null;
}

function formatPoE2Message(data) {
    if (!data) return '❌ Не удалось получить таймер';
    if (data.expired) return '# 🎉 ЛИГА УЖЕ ЗАПУЩЕНА! ЗАХОДИ В ИГРУ!';
    
    const totalSeconds = data.days * 86400 + data.hours * 3600 + data.minutes * 60 + data.seconds;
    const maxSeconds = 14 * 86400; // Примерно 2 недели
    const progress = Math.min(100, Math.max(0, Math.floor(((maxSeconds - totalSeconds) / maxSeconds) * 100)));
    const filled = Math.floor(progress / 5);
    const empty = 20 - filled;
    
    // Время в Новосибирске (MSK+4)
    const now = new Date();
    const targetDate = new Date(now.getTime() + totalSeconds * 1000);
    
    const mskDate = targetDate.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    const nskDate = targetDate.toLocaleString('ru-RU', { timeZone: 'Asia/Novosibirsk', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    
    return [
        `# ⏳ ДО ЗАПУСКА ЛИГИ ⏳`,
        `## 🏰 POE2 — ANCIENT LEAGUE 🏰`,
        ``,
        `## ${data.days}д : ${data.hours}ч : ${data.minutes}м : ${data.seconds}с`,
        ``,
        `${'🟢'.repeat(filled)}${'⚪'.repeat(empty)} **${progress}%**`,
        ``,
        `📅 ${mskDate.split(',')[0]}`,
        `   🇷🇺 МСК **${mskDate.split(',')[1]?.trim() || ''}**`,
        `   🇷🇺 НСК **${nskDate.split(',')[1]?.trim() || ''}**`,
    ].join('\n');
}

async function updatePoE2Timer() {
    if (!poe2TimerMessage || !poe2TimerChannel) return;
    
    const data = await getPoE2TimerData();
    const content = formatPoE2Message(data);
    
    try {
        await poe2TimerMessage.edit({ content: content.substring(0, 2000) });
        console.log('⏳ Таймер PoE2 обновлён');
    } catch (e) {
        console.error('Ошибка обновления таймера:', e.message);
    }
}

async function startPoE2Timer(channel) {
    // Останавливаем старый таймер если есть
    if (poe2TimerInterval) clearInterval(poe2TimerInterval);
    if (poe2TimerMessage) {
        try { await poe2TimerMessage.delete(); } catch (e) {}
    }
    
    poe2TimerChannel = channel;
    
    const data = await getPoE2TimerData();
    const content = formatPoE2Message(data);
    
    poe2TimerMessage = await channel.send({ content: content.substring(0, 2000) });
    console.log('⏳ Таймер PoE2 создан');
    
    // Обновляем каждые 30 секунд
    poe2TimerInterval = setInterval(updatePoE2Timer, 30000);
}

async function stopPoE2Timer() {
    if (poe2TimerInterval) clearInterval(poe2TimerInterval);
    if (poe2TimerMessage) {
        try { await poe2TimerMessage.delete(); } catch (e) {}
    }
    poe2TimerMessage = null;
    poe2TimerChannel = null;
    poe2TimerInterval = null;
}

// ========== HEROES ==========
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

function encodeUrlName(name) {
    return name.replace(/\s+/g, '_').replace(/'/g, '%27').replace(/:/g, '%3A').replace(/\(/g, '%28').replace(/\)/g, '%29');
}

async function searchTlidbDirect(name) {
    const encoded = encodeUrlName(name);
    for (const lang of ['en', 'ru']) {
        const url = `https://tlidb.com/${lang}/${encoded}`;
        try {
            const response = await fetch(url);
            if (response.ok && !response.url.includes('/search')) {
                const html = await response.text();
                const data = parseItemPage(html);
                if (data.seasons.length > 0 || data.progression.length > 0) return { ...data, url, found: true };
            }
        } catch (e) {}
    }
    return { seasons: [], progression: [], found: false };
}

async function searchTlidbSearch(name) {
    for (const lang of ['en', 'ru']) {
        const url = `https://tlidb.com/${lang}/search?q=${encodeURIComponent(name)}`;
        try {
            const response = await fetch(url);
            const html = await response.text();
            if (response.url && !response.url.includes('/search')) {
                const data = parseItemPage(html);
                if (data.seasons.length > 0 || data.progression.length > 0) return { ...data, url: response.url, found: true };
            }
            const data = parseItemPage(html);
            if (data.seasons.length > 0 || data.progression.length > 0) return { ...data, url: response.url || url, found: true };
            const links = [];
            const linkRegex = /<a[^>]*href="(\/(?:ru|en)\/[^"]+)"[^>]*>([^<]+)<\/a>/g;
            let match;
            while ((match = linkRegex.exec(html)) !== null && links.length < 5) {
                const link = match[1], text = match[2].trim();
                if (text.length > 2 && !text.includes('<') && !text.includes('Stash') && !text.includes('Hero') && !text.includes('Talent')) {
                    links.push({ title: text, url: `https://tlidb.com${link}` });
                }
            }
            if (links.length > 0) return { ...data, url, found: false, suggestions: links };
        } catch (e) {}
    }
    return { seasons: [], progression: [], found: false };
}

async function smartSearch(query) {
    let cleanQuery = query.replace(/найди|нади|инфу|по|мне|информацию|что|такое|расскажи|про|дай|ка|че|тут|за|хуйня|ну|ты|конечно|нахуй|даун|блять|бля|пиздец|сука|about|find|info|search|please/gi, '').trim();
    if (!cleanQuery || cleanQuery.length < 2) cleanQuery = query.trim();
    
    let translatedQuery = cleanQuery;
    try {
        const aiRes = await fetch(HELPER_WORKER, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                message: `Переведи на АНГЛИЙСКИЙ название скилла/предмета/героя из Torchlight Infinite. Ответь ТОЛЬКО английским названием.\n\nРусское: "${cleanQuery}"\nАнглийское:`,
                currentAuthor: "user", context: [] 
            })
        });
        const t = (await aiRes.json()).reply || '';
        const cleaned = t.replace(/["'`]/g, '').trim();
        if (/^[a-zA-Z0-9\s:'\-_()]+$/.test(cleaned) && cleaned.length > 2 && cleaned.length < 80) {
            translatedQuery = cleaned;
        }
    } catch (e) {}
    
    let result = await searchTlidbDirect(translatedQuery);
    if (result.found) return { ...result, searchName: translatedQuery };
    if (translatedQuery !== cleanQuery) {
        result = await searchTlidbDirect(cleanQuery);
        if (result.found) return { ...result, searchName: cleanQuery };
    }
    result = await searchTlidbSearch(translatedQuery);
    if (result.found) return { ...result, searchName: translatedQuery };
    if (translatedQuery !== cleanQuery) {
        result = await searchTlidbSearch(cleanQuery);
        if (result.found) return { ...result, searchName: cleanQuery };
    }
    return { seasons: [], progression: [], url: `https://tlidb.com/en/search?q=${encodeURIComponent(translatedQuery)}`, found: false, searchName: translatedQuery, suggestions: result?.suggestions || [] };
}

function formatResult(data, query) {
    const { seasons, progression, heroData, url, found, suggestions } = data;
    if (!found && seasons.length === 0 && progression.length === 0) {
        let result = `## ❌ Ничего не найдено для "${query}"\n`;
        if (suggestions?.length) { result += `\n**Возможно вы искали:**\n`; suggestions.forEach(s => result += `• [${s.title}](${s.url})\n`); }
        result += `\n🔗 [Открыть поиск](${url})`;
        return result.substring(0, 2000);
    }
    if (heroData) {
        let result = `## 🦸 ${heroData.name}\n${heroData.description}\n\n### 📋 Характеристики:\n`;
        heroData.traits.forEach(t => result += `**${t.name}** (ур.${t.level})\n${t.description}\n\n`);
        result += `\n🔗 [Открыть](${url})`;
        return result.substring(0, 2000);
    }
    let result = `## 🔍 ${seasons[0]?.title || query}\n`;
    for (const season of seasons.slice(0, 2)) {
        result += `### 🏷 ${season.season}\n`;
        if (season.tags.length) result += `🎯 ${season.tags.join(' · ')}\n`;
        for (const [k, v] of Object.entries(season.params)) result += `• ${k}: **${v}**\n`;
        if (season.description) result += `\n📝 ${season.description}\n`;
        result += `\n`;
    }
    if (progression.length > 0) { result += `📊 Прогрессия: `; const first = progression[0], last = progression[progression.length-1]; result += `ур.${first.level} (${first.efficiency}) → ур.${last.level} (${last.efficiency})\n`; }
    result += `\n🔗 [Открыть](${url})`;
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
    new SlashCommandBuilder().setName('loveadmin').setDescription('🔒 Управление админами (только владелец)')
        .addStringOption(o => o.setName('action').setDescription('Действие').setRequired(true)
            .addChoices({ name: '➕ Добавить админа', value: 'add' }, { name: '➖ Удалить админа', value: 'remove' }, { name: '📋 Список админов', value: 'list' }))
        .addUserOption(o => o.setName('user').setDescription('Пользователь').setRequired(false)),
    new SlashCommandBuilder().setName('toggle').setDescription('Вкл/выкл бота')
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
    new SlashCommandBuilder().setName('wheel').setDescription('🎯 Колесо фортуны — выбор героя')
        .addIntegerOption(o => o.setName('count').setDescription('2-8').setRequired(false).setMinValue(2).setMaxValue(8)),
    new SlashCommandBuilder().setName('quiz').setDescription('🎉 Викторина с призом'),
    new SlashCommandBuilder().setName('poe2').setDescription('⏳ Таймер до запуска лиги Path of Exile 2'),
    new SlashCommandBuilder().setName('poe2stop').setDescription('⏹ Остановить таймер PoE2'),
    new SlashCommandBuilder().setName('savesettings').setDescription('Сохранить настройки'),
    new SlashCommandBuilder().setName('settings').setDescription('Показать настройки'),
    new SlashCommandBuilder().setName('cleanup').setDescription('Очистка команд'),
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
    
    const { commandName } = interaction;
    
    if (commandName === 'loveadmin') {
        if (!isOwner(interaction.user.id)) return interaction.reply({ content: '🔒 Только владелец!', flags: 64 });
        await interaction.deferReply({ flags: 64 });
        const action = interaction.options.getString('action');
        if (action === 'list') {
            if (!settings.admins.length) return interaction.editReply({ content: '📋 Админов нет' });
            const names = await Promise.all(settings.admins.map(async id => { try { const u = await client.users.fetch(id); return `- ${u.tag}`; } catch { return `- ${id}`; } }));
            return interaction.editReply({ content: `📋 **Админы:**\n${names.join('\n')}` });
        }
        const user = interaction.options.getUser('user');
        if (!user) return interaction.editReply({ content: '❌ Укажи пользователя' });
        if (user.id === OWNER_ID) return interaction.editReply({ content: '❌ Владелец всегда админ' });
        if (action === 'add') {
            if (!settings.admins.includes(user.id)) { settings.admins.push(user.id); return interaction.editReply({ content: `✅ ${user.tag} теперь админ` }); }
            return interaction.editReply({ content: '⚠️ Уже админ' });
        }
        if (action === 'remove') { settings.admins = settings.admins.filter(id => id !== user.id); return interaction.editReply({ content: `✅ ${user.tag} удалён` }); }
        return;
    }
    
    // poe2 и poe2stop доступны всем
    if (commandName === 'poe2') {
        await interaction.deferReply({ flags: 64 });
        await startPoE2Timer(interaction.channel);
        await interaction.editReply({ content: '✅ Таймер запущен!' });
        return;
    }
    
    if (commandName === 'poe2stop') {
        await interaction.deferReply({ flags: 64 });
        await stopPoE2Timer();
        await interaction.editReply({ content: '✅ Таймер остановлен!' });
        return;
    }
    
    if (commandName === 'quiz') {
        await interaction.deferReply();
        const qRes = await fetch(HELPER_WORKER, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Придумай ТУПОЙ и ГРУБЫЙ вопрос с чёрным юмором. Используй мат. 1 предложение. Только вопрос.", currentAuthor: interaction.user.username, context: [] }) });
        const qData = await qRes.json();
        const question = qData.reply || "Почему ты тупой?";
        const pRes = await fetch(HELPER_WORKER, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: "Придумай смешной фейковый приз (1-3 слова с эмодзи).", currentAuthor: interaction.user.username, context: [] }) });
        const pData = await pRes.json();
        const prize = pData.reply || "💎 1000 FE";
        await interaction.editReply({ content: `# 🎉 ВИКТОРИНА!\n## Приз: ${prize}\n❓ ${question}\n_Жду 30 секунд, потом выберу лучший ответ!_` });
        const answers = [];
        const collector = interaction.channel.createMessageCollector({ filter: m => !m.author.bot, time: 30000 });
        collector.on('collect', (m) => answers.push({ author: m.author.username, content: m.content }));
        collector.on('end', async () => {
            if (answers.length === 0) { await interaction.followUp('Никто не ответил! Все тупые, пиздец!'); return; }
            const answersText = answers.map((a, i) => `${i+1}. ${a.author}: "${a.content}"`).join('\n');
            const jRes = await fetch(HELPER_WORKER, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: `Викторина. Вопрос: "${question}". Приз: "${prize}".\n\nОтветы:\n${answersText}\n\nВыбери САМЫЙ СМЕШНОЙ ответ. Напиши: "Поздравляю, [имя]! Ты выиграл [приз]... но приза нет! [оскорбление, 1-2 предложения]".`, currentAuthor: "судья", context: [] }) });
            const jData = await jRes.json();
            await interaction.followUp((jData.reply || `Поздравляю, ${answers[0].author}! Ты выиграл ${prize}... но приза нет!`).substring(0, 500));
        });
        return;
    }
    
    if (commandName === 'wheel') {
        const count = interaction.options.getInteger('count') || 5;
        await interaction.deferReply();
        const heroList = heroes.map((h, i) => `${i+1}. ${h.emoji} **${getHeroDisplay(h, i, heroes)}** — ${h.title}`).join('\n');
        await interaction.editReply({ content: `# 🎯 ВЫБОР ГЕРОЕВ\n${heroList}\n\n**Напиши номера через пробел**\n_30 секунд!_` });
        const filter = m => m.author.id === interaction.user.id;
        const collector = interaction.channel.createMessageCollector({ filter, time: 30000, max: 1 });
        collector.on('collect', async (m) => {
            const numbers = m.content.split(/\s+/).map(n => parseInt(n)).filter(n => n > 0 && n <= heroes.length);
            const unique = [...new Set(numbers)].slice(0, count);
            if (unique.length < 2) return interaction.followUp({ content: '❌ Минимум 2!' });
            let wheelHeroes = unique.map(i => heroes[i-1]);
            const wheelMsg = await interaction.followUp({ content: buildWheel(wheelHeroes) });
            await wheelMsg.react('🎲');
            const reactCollector = wheelMsg.createReactionCollector({ filter: (r, u) => r.emoji.name === '🎲' && !u.bot });
            reactCollector.on('collect', async () => {
                if (wheelHeroes.length <= 1) { reactCollector.stop(); return; }
                for (let spin = 0; spin < 5; spin++) { await new Promise(r => setTimeout(r, 300)); const shifted = [...wheelHeroes]; for (let s = 0; s < spin; s++) shifted.push(shifted.shift()); await wheelMsg.edit({ content: buildWheel(shifted, spin % shifted.length, ['🎰','🌀','💫','⚡','🎲'][spin % 5]) }); }
                await new Promise(r => setTimeout(r, 500));
                const loser = wheelHeroes.splice(Math.floor(Math.random() * wheelHeroes.length), 1)[0];
                await wheelMsg.edit({ content: buildWheel(wheelHeroes, -1, '🎯', loser) });
                if (wheelHeroes.length === 1) reactCollector.stop();
            });
        });
        collector.on('end', c => { if (!c.size) interaction.followUp('Время вышло!'); });
        return;
    }
    
    if (!isAdmin(interaction.user.id)) return interaction.reply({ content: '🚫 Нет прав! Используй /wheel /quiz /poe2', flags: 64 });
    
    if (commandName === 'cleanup') { await interaction.deferReply({ flags: 64 }); await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] }); await new Promise(r => setTimeout(r, 2000)); await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands }); return interaction.editReply({ content: '✅ Готово' }); }
    await interaction.deferReply({ flags: 64 });
    if (commandName === 'toggle') { settings.enabled = interaction.options.getString('state') === 'on'; return interaction.editReply({ content: settings.enabled ? '✅ Вкл' : '❌ Выкл' }); }
    if (commandName === 'roastchance') { settings.roastChance = interaction.options.getInteger('percent'); return interaction.editReply({ content: `✅ ${settings.roastChance}%` }); }
    if (commandName === 'loversmile') { const emojis = interaction.options.getString('emoji').split(/\s+/).filter(e => e.trim()); const user = interaction.options.getUser('user'); if (!emojis.length) return interaction.editReply({ content: '❌ Нет эмодзи' }); settings.autoReactions[user.id] = emojis; return interaction.editReply({ content: `✅ ${emojis.join(' ')} → ${user.tag}` }); }
    if (commandName === 'stopsmile') { delete settings.autoReactions[interaction.options.getUser('user').id]; return interaction.editReply({ content: '✅ Убрано' }); }
    if (commandName === 'smilelist') { const entries = Object.entries(settings.autoReactions); if (!entries.length) return interaction.editReply({ content: '📋 Пусто' }); return interaction.editReply({ content: entries.map(([id, e]) => `${Array.isArray(e)?e.join(' '):e} → <@${id}>`).join('\n') }); }
    if (commandName === 'savesettings') return interaction.editReply({ content: `BOT_SETTINGS=\n${JSON.stringify(settings)}` });
    if (commandName === 'settings') return interaction.editReply({ content: `Вкл: ${settings.enabled}\nШанс: ${settings.roastChance}%\nРеакций: ${Object.keys(settings.autoReactions).length}\nАдминов: ${settings.admins.length}` });
    if (commandName === 'help') return interaction.editReply({ content: '**Всем:** /wheel /quiz /poe2 /poe2stop\n**Админам:** /toggle /roastchance /loversmile /stopsmile /smilelist /savesettings /settings /cleanup\n**Владельцу:** /loveadmin' });
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    const msg = reaction.message;
    if (msg.author && settings.autoReactions[msg.author.id]) {
        try { const arr = Array.isArray(settings.autoReactions[msg.author.id]) ? settings.autoReactions[msg.author.id] : [settings.autoReactions[msg.author.id]]; for (const emoji of arr) { if (!msg.reactions.cache.some(r => r.emoji.toString() === emoji)) await msg.react(emoji); } } catch (e) {}
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (settings.autoReactions[message.author.id]) { try { const arr = Array.isArray(settings.autoReactions[message.author.id]) ? settings.autoReactions[message.author.id] : [settings.autoReactions[message.author.id]]; for (const emoji of arr) { await message.react(emoji); await new Promise(r => setTimeout(r, 200)); } } catch (e) {} }
    
    if (message.channel.id === TLIDB_CHANNEL && !message.content.startsWith('/') && message.content.length > 2) {
        try {
            await message.channel.sendTyping();
            const data = await smartSearch(message.content);
            await message.reply(formatResult(data, message.content).substring(0, 2000));
        } catch (e) { await message.reply('❌ Ошибка поиска'); }
        return;
    }
    
    if (!settings.enabled) return;
    if (message.content.startsWith('/')) return;
    const channelId = message.channel.id;
    let workerUrl, backupUrl;
    if (channelId === ROAST_CHANNEL) { if (Math.random() * 100 > settings.roastChance) return; workerUrl = ROAST_WORKER; backupUrl = ROAST_WORKER_BACKUP; }
    else if (channelId === HELPER_CHANNEL) { workerUrl = HELPER_WORKER; backupUrl = HELPER_WORKER; }
    else return;
    try {
        const messages = await message.channel.messages.fetch({ limit: 2 }); const context = [];
        messages.reverse().forEach(msg => { if (!msg.author.bot && !msg.content.startsWith('/') && !msg.content.includes(';')) context.push({ author: msg.author.username, content: msg.content || '[фото]' }); });
        let r1 = await fetch(workerUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: message.content || '[фото]', context, currentAuthor: message.author.username }) }); let d1 = await r1.json(); let reply = d1.reply;
        if (!reply) { let r2 = await fetch(backupUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: message.content || '[фото]', context, currentAuthor: message.author.username }) }); let d2 = await r2.json(); reply = d2.reply; }
        if (reply) await message.reply(reply.substring(0, 500));
    } catch (err) {}
});

client.login(TOKEN);
