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

// Хранилище последних сообщений по каналам
const messageHistory = new Map();

client.once('ready', () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
    console.log(`🔄 Worker URL: ${WORKER_URL}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    if (message.content.includes(";")) {
        console.log(`🚫 Игнор (;): "${message.content}"`);
        return;
    }
    
    const channelId = message.channel.id;
    
    // Инициализируем историю для канала если нужно
    if (!messageHistory.has(channelId)) {
        messageHistory.set(channelId, []);
    }
    
    const history = messageHistory.get(channelId);
    
    // Добавляем сообщение в историю
    history.push({
        author: message.author.username,
        content: message.content,
        timestamp: Date.now()
    });
    
    // Храним только последние 10 сообщений
    if (history.length > 10) {
        history.shift();
    }
    
    console.log(`\n📨 [${message.author.tag}] "${message.content}"`);
    console.log(`📜 История канала: ${history.length} сообщений`);
    
    try {
        // Отправляем в Worker последние сообщения для контекста
        const recentMessages = history.slice(-5); // Последние 5 сообщений
        
        console.log(`📤 Отправка в Worker c ${recentMessages.length} сообщениями контекста`);
        
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "User-Agent": "DiscordBot/1.0"
            },
            body: JSON.stringify({ 
                message: message.content,
                context: recentMessages,
                currentAuthor: message.author.username
            })
        });
        
        console.log(`📥 Статус: ${response.status}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`📦 Ответ Worker:`, JSON.stringify(data).substring(0, 200));
        
        if (data.reply && data.reply.trim() !== "") {
            // Обрезаем если слишком длинное и обрывается
            let replyText = data.reply;
            if (replyText.length > 500) {
                replyText = replyText.substring(0, 497) + "...";
            }
            
            await message.reply(replyText);
            console.log(`✅ Ответ отправлен (${replyText.length} символов)`);
        } else {
            console.log(`⚠️ Пустой reply от Worker`);
        }
        
    } catch (err) {
        console.error(`💥 Ошибка: ${err.message}`);
    }
});

client.on('error', (error) => {
    console.error(`🔴 Ошибка Discord: ${error.message}`);
});

console.log(`🚀 Запуск бота...`);
client.login(TOKEN);
