const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const WORKER_URL = "https://loverbot.vladikkotik3.workers.dev";

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
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    // Берем только текст, фото игнорируем
    const text = message.content;
    
    console.log(`📨 ${message.author.tag}: "${text}"`);
    
    try {
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: text })
        });
        
        const data = await response.json();
        
        if (data.ignore === true) {
            console.log(`🚫 Сообщение проигнорировано`);
            return;
        }
        
        if (data.reply) {
            await message.reply(`${data.reply}\n> ${text}`);
        }
    } catch (err) {
        console.error(`❌ Ошибка: ${err.message}`);
    }
});

client.login(TOKEN);
