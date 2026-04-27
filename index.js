const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN ? process.env.DISCORD_TOKEN.trim().replace(/^["']|["']$/g, '') : null;
const TARGET_USER_ID = process.env.TARGET_USER_ID;

console.log("=== ОТЛАДКА ===");
console.log("Токен получен?", TOKEN ? "ДА" : "НЕТ");
console.log("Длина токена:", TOKEN ? TOKEN.length : 0);
console.log("Токен начинается с:", TOKEN ? TOKEN.substring(0, 20) + "..." : "пусто");
console.log("ID цели получен?", TARGET_USER_ID ? "ДА" : "НЕТ");
console.log("ID цели:", TARGET_USER_ID);
console.log("==============");

if (!TOKEN) {
    console.error("❌ ОШИБКА: Токен не найден");
    process.exit(1);
}

if (TOKEN.length < 50) {
    console.error("❌ ОШИБКА: Токен слишком короткий —", TOKEN.length, "символов (должно быть около 70-100)");
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
    console.log(`✅ Бот ${client.user.tag} запущен!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.author.id === TARGET_USER_ID) {
        await message.reply(`⬆️ Пишет дебил.\n> ${message.content}`);
    }
});

client.login(TOKEN).catch(err => {
    console.error("❌ Ошибка при логине:", err.message);
});
