const { Client, GatewayIntentBits } = require('discord.js');

// НАСТРОЙКИ
const TOKEN = process.env.DISCORD_TOKEN;
const TARGET_USER_ID = process.env.TARGET_USER_ID;

// ОТЛАДКА: проверим, видит ли бот переменные
console.log("=== ОТЛАДКА ===");
console.log("Токен получен?", TOKEN ? "ДА" : "НЕТ");
console.log("Токен начинается с:", TOKEN ? TOKEN.substring(0, 15) + "..." : "пусто");
console.log("ID цели получен?", TARGET_USER_ID ? "ДА" : "НЕТ");
console.log("ID цели:", TARGET_USER_ID);
console.log("==============");

if (!TOKEN) {
    console.error("❌ ОШИБКА: Токен не найден! Переменная DISCORD_TOKEN не установлена в Railway");
    process.exit(1);
}

if (!TARGET_USER_ID) {
    console.error("❌ ОШИБКА: ID пользователя не найден! Переменная TARGET_USER_ID не установлена");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

client.on('ready', () => {
    console.log(`✅ Бот ${client.user.tag} запущен и следит за другом!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    console.log(`Получено сообщение от ${message.author.tag}`);
    if (message.author.id === TARGET_USER_ID) {
        console.log(`🎯 Целевой пользователь! Отправляю ответ...`);
        await message.reply(`⬆️ Пишет дебил. \n> ${message.content}`);
    }
});

client.login(TOKEN).catch(err => {
    console.error("❌ Ошибка при логине:", err.message);
});
