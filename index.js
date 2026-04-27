const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', async () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
    
    // Запрашиваем список всех моделей из OpenRouter
    try {
        const response = await fetch("https://openrouter.ai/api/v1/models", {
            headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}` }
        });
        const data = await response.json();
        
        // Фильтруем только бесплатные модели
        const freeModels = data.data.filter(m => m.id.includes("free"));
        
        console.log(`\n📋 НАЙДЕНО ${freeModels.length} БЕСПЛАТНЫХ МОДЕЛЕЙ:\n`);
        freeModels.forEach(m => {
            console.log(`ID: ${m.id}`);
            console.log(`Название: ${m.name}`);
            console.log(`---`);
        });
    } catch (err) {
        console.error("Ошибка получения моделей:", err);
    }
});

client.login(TOKEN);
