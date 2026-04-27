const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const WORKER_URL = "https://loverbot.vladikkotik3.workers.dev";

const TARGET_USER_ID = process.env.TARGET_USER_ID;
const SECOND_USER_ID = process.env.SECOND_USER_ID;
const THIRD_USER_ID = process.env.THIRD_USER_ID;

// Запасные оскорбления (если Worker не ответит)
const FALLBACKS = {
    [TARGET_USER_ID]: [
        "<@{id}>, ты долбаеб конченый 🤡",
        "<@{id}>, иди нахуй, ебанат",
        "<@{id}>, даун ебучий, позор",
        "<@{id}>, соси хуй, уебок"
    ],
    [SECOND_USER_ID]: [
        "<@{id}>, ты дебил 🤡",
        "<@{id}>, иди нахуй"
    ],
    [THIRD_USER_ID]: [
        "<@{id}>, сигма 💪, иди нахуй",
        "Сигма 💪, даун <@{id}>"
    ]
};

function getFallback(userId) {
    const list = FALLBACKS[userId] || FALLBACKS[TARGET_USER_ID];
    return list[Math.floor(Math.random() * list.length)].replace("{id}", userId);
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
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const userId = message.author.id;
    
    if (FALLBACKS[userId]) {
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
    }
});

client.login(TOKEN);
