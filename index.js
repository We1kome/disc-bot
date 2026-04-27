const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const TARGET_USER_ID = process.env.TARGET_USER_ID;     // Кому шлем оскорбления
const SECOND_USER_ID = process.env.SECOND_USER_ID;     // Кому шлем комплименты
const THIRD_USER_ID = process.env.THIRD_USER_ID;       // Кому шлем sigma 💪

// === Жесткие оскорбления ===
const hardInsults = [
    "{username}, написал долбаеб 🤡",
    "{username}, иди нахуй, клоун",
    "{username}, ivanzolo2004 prime",
    "{username}, ты ебанат конченый",
    "{username}, съешь говна и угомонись",
    "{username}, да ты тупой как пробка ебучая",
    "{username}, че ты несешь, блять?",
    "{username}, ты ебанат?",
    "{username}, даун, иди в окно прыгни",
    "{username}, позор человечества",
    "{username}, конченый, блять",
    "{username}, выйди вон, слабоумие",
    "{username}, боже, какой же ты тупой"
];

// === Противоположные фразы (комплименты/поддержка) ===
const niceResponses = [
    "{username}, ты гений мысли 🧠✨",
    "{username}, продолжай в том же духе!",
    "{username}, сказал как отрезал 🔥",
    "{username}, лучший в этом чате ❤️",
    "{username}, с тобой приятно общаться",
    "{username}, умница, горжусь 🤝",
    "{username}, респект за слова",
    "{username}, прямо в сердце ❤️‍🔥",
    "{username}, ты сегодня в ударе",
    "{username}, каждое слово — золото 🏆",
    "{username}, так держать!",
    "{username}, наконец-то адекватный человек",
    "{username}, мудро, очень мудро",
    "{username}, ты меня вдохновляешь",
    "{username}, лучший комментарий за сегодня"
];

// === Sigma-фразы (всегда одинаковые, но можно сделать массив с вариациями) ===
const sigmaPhrases = [
    "{username}, sigma... 💪",
    "{username}, sigma male grindset 💪",
    "{username}, sigma... 💪🔥",
    "{username}, sigma boy 💪🧠",
    "{username}, sigma... и точка 💪"
];

// === Выбор ответа в зависимости от пользователя ===
function getResponseForUser(userId) {
    // Для третьего пользователя — всегда sigma
    if (userId === THIRD_USER_ID) {
        // Если хочешь всегда одну фразу — используй sigmaPhrases[0]
        // Или случайную из массива:
        const randomSigma = sigmaPhrases[Math.floor(Math.random() sigmaPhrases.length)];
        return randomSigma.replace("{username}", `<@${userId}>`);
    }
    
    // Для основного — оскорбления
    if (userId === TARGET_USER_ID) {
        const randomInsult = hardInsults[Math.floor(Math.random() * hardInsults.length)];
        return randomInsult.replace("{username}", `<@${userId}>`);
    }
    
    // Для второго — комплименты
    if (userId === SECOND_USER_ID) {
        const randomNice = niceResponses[Math.floor(Math.random() * niceResponses.length)];
        return randomNice.replace("{username}", `<@${userId}>`);
    }
    
    // Остальным — не отвечаем
    return null;
}

// === ЗАПУСК БОТА ===
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

client.on('clientReady', () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
    console.log(`👿 Оскорбления для: ${TARGET_USER_ID || "не задан"}`);
    console.log(`😇 Комплименты для: ${SECOND_USER_ID || "не задан"}`);
    console.log(`💪 Sigma для: ${THIRD_USER_ID || "не задан"}`);
});

client.on('ready', () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const userId = message.author.id;
    const response = getResponseForUser(userId);
    
    if (response) {
        await message.reply(`${response}\n> ${message.content}`);
    }
});

client.login(TOKEN);
