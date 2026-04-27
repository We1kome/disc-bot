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
    
    if (!messageHistory.has(channelId)) {
        messageHistory.set(channelId, []);
    }
    
    const history = messageHistory.get(channelId);
    
    // Заменяем ID на читаемые ники в сообщении
    let cleanContent = message.content;
    const mentionedUsers = message.mentions.users;
    
    if (mentionedUsers.size > 0) {
        console.log(`👥 Найдены упоминания:`);
        mentionedUsers.forEach((user, id) => {
            console.log(`  - ID: ${id} -> @${user.username}`);
            // Заменяем <@ID> и <@!ID> на @username
            cleanContent = cleanContent.replace(new RegExp(`<@!?${id}>`, 'g'), `@${user.username}`);
        });
    }
    
    // Добавляем в историю с чистыми никами
    history.push({
        author: message.author.username,
        content: cleanContent,
        timestamp: Date.now()
    });
    
    if (history.length > 10) {
        history.shift();
    }
    
    console.log(`\n📨 [${message.author.username}] (ориг): "${message.content}"`);
    console.log(`📨 [${message.author.username}] (чист): "${cleanContent}"`);
    
    try {
        const recentMessages = history.slice(-5);
        
        console.log(`📤 Отправка в Worker с ${recentMessages.length} сообщениями`);
        
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "User-Agent": "DiscordBot/1.0"
            },
            body: JSON.stringify({ 
                message: cleanContent,
                context: recentMessages,
                currentAuthor: message.author.username
            })
        });
        
        console.log(`📥 Статус: ${response.status}`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log(`📦 Ответ Worker: ${JSON.stringify(data).substring(0, 200)}`);
        
        if (data.reply && data.reply.trim() !== "") {
            let replyText = data.reply;
            
            // Заменяем @username обратно на <@ID> для Discord
            mentionedUsers.forEach((user, id) => {
                const usernameRegex = new RegExp(`@${user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
                replyText = replyText.replace(usernameRegex, `<@${id}>`);
            });
            
            if (replyText.length > 500) {
                replyText = replyText.substring(0, 497) + "...";
            }
            
            await message.reply(replyText);
            console.log(`✅ Ответ отправлен (${replyText.length} символов)`);
        } else {
            console.log(`⚠️ Пустой reply`);
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
