const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const TARGET_USER_ID = process.env.TARGET_USER_ID;

// Жесткие оскорбления с обращением к пользователю
const directInsults = [
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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

client.on('clientReady', () => {
    console.log(`✅ Бот ${client.user.tag} запущен и следит за другом!`);
});

// Для совместимости со старой версией
client.on('ready', () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
});

client.on('messageCreate', async (message) => {
    // Игнорируем сообщения самого бота
    if (message.author.bot) return;
    
    // Если автор — наша цель
    if (message.author.id === TARGET_USER_ID) {
        // Выбираем случайное оскорбление
        const randomInsult = directInsults[Math.floor(Math.random() * directInsults.length)];
        // Подставляем упоминание пользователя
        const finalMessage = randomInsult.replace("{username}", `<@${message.author.id}>`);
        
        // Отправляем ответ с цитатой
        await message.reply(`${finalMessage}\n> ${message.content}`);
    }
});

client.login(TOKEN);
