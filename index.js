const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const WORKER_URL = "https://loverbot.vladikkotik3.workers.dev";

// Запасные оскорбления (если Worker не ответит)
const FALLBACKS = [
    "<@{id}>, ты долбаеб конченый 🤡",
    "<@{id}>, иди нахуй, ебанат",
    "<@{id}>, даун ебучий, позор",
    "<@{id}>, соси хуй, уебок",
    "<@{id}>, пидор, закрой ебало",
    "Отъебись, <@{id}>, конченый",
    "<@{id}>, ебаный даун, иди лечись"
];

function getFallback(userId) {
    const randomIndex = Math.floor(Math.random() * FALLBACKS.length);
    return FALLBACKS[randomIndex].replace("{id}", userId);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

client.once('ready', () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
    console.log(`🔗 Worker: ${WORKER_URL}`);
    console.log(`👿 РЕЖИМ: ОСКОРБЛЯЕТ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ`);
});

client.on('messageCreate', async (message) => {
    // Игнорируем сообщения самого бота
    if (message.author.bot) return;
    
    const userId = message.author.id;
    
    console.log(`📨 ${message.author.tag}: "${message.content}"`);
    
    try {
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: message.content })
        });
        
        const data = await response.json();
        
        if (data.reply) {
            await message.reply(`${data.reply}\n> ${message.content}`);
        } else {
            await message.reply(`${getFallback(userId)}\n> ${message.content}`);
        }
    } catch (err) {
        console.error(`❌ Ошибка: ${err.message}`);
        await message.reply(`${getFallback(userId)}\n> ${message.content}`);
    }
});

client.login(TOKEN);
