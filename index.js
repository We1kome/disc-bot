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
    console.log(`🔄 Worker URL: ${WORKER_URL}`);
});

client.on('messageCreate', async (message) => {
    // Игнорируем ботов
    if (message.author.bot) {
        console.log(`🤖 Игнор бота: ${message.author.tag}`);
        return;
    }
    
    // Игнорируем сообщения с ;
    if (message.content.includes(";")) {
        console.log(`🚫 Игнор (содержит ;): "${message.content}" от ${message.author.tag}`);
        return;
    }
    
    console.log(`\n📨 [${message.author.tag}] "${message.content}"`);
    
    try {
        console.log(`📤 Отправка в Worker...`);
        
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "User-Agent": "DiscordBot/1.0"
            },
            body: JSON.stringify({ message: message.content })
        });
        
        console.log(`📥 Статус ответа: ${response.status} ${response.statusText}`);
        
        if (!response.ok) {
            console.error(`❌ Worker вернул ошибку: ${response.status}`);
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`📦 Данные от Worker:`, JSON.stringify(data));
        
        if (data.reply && data.reply.trim() !== "") {
            const replyText = `${data.reply}\n-# ||${message.content}||`;
            await message.reply(replyText);
            console.log(`✅ Ответ отправлен в канал`);
        } else {
            console.log(`⚠️ Worker вернул пустой reply`);
        }
        
    } catch (err) {
        console.error(`💥 Ошибка: ${err.message}`);
        
        // Фолбек если Worker недоступен
        try {
            const localFallbacks = [
                "Ты долбаёб, я сейчас не в настроении, отъебись!",
                "Чё пристал, пидор, сервер лежит из-за таких как ты!",
                "Слышь, хуесос, дай отдохнуть, заебал уже!"
            ];
            const fallback = localFallbacks[Math.floor(Math.random() * localFallbacks.length)];
            await message.reply(fallback);
            console.log(`🔄 Отправлен локальный fallback`);
        } catch (replyError) {
            console.error(`❌ Не удалось отправить даже fallback: ${replyError.message}`);
        }
    }
});

// Обработка ошибок подключения
client.on('error', (error) => {
    console.error(`🔴 Ошибка Discord клиента: ${error.message}`);
});

client.on('disconnect', () => {
    console.log(`🔌 Бот отключился от Discord`);
});

console.log(`🚀 Запуск бота...`);
client.login(TOKEN);
