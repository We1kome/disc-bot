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
    
    // ЕСЛИ В СООБЩЕНИИ ЕСТЬ ; — НЕ ОТПРАВЛЯЕМ В WORKER
    if (message.content.includes(";")) {
        console.log(`🚫 Сообщение с ; игнорируется: ${message.content}`);
        return;
    }
    
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
        }
    } catch (err) {
        console.error(`❌ Ошибка: ${err.message}`);
    }
});

client.login(TOKEN);
