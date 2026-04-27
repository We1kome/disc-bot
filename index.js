const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const TARGET_USER_ID = process.env.TARGET_USER_ID;     // Кому шлем оскорбления
const SECOND_USER_ID = process.env.SECOND_USER_ID;     // Кому шлем комплименты

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

// === Выбор ответа в зависимости от пользователя ===
function getResponseForUser(userId, username) {
    let phrasesList;
    
    if (userId === TARGET_USER_ID) {
        phrasesList = hardInsults;      // Оскорбления
    } else if (userId === SECOND_USER_ID) {
        phrasesList = niceResponses;    // Комплименты
    } else {
        return null;                    // Остальным не отвечаем
    }
    
    const randomPhrase = phrasesList[Math.floor(Math.random() * phrasesList.length)];
    return randomPhrase.replace("{username}", `<@${userId}>`);
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
