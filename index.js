const { Client, GatewayIntentBits } = require('discord.js');
const TOKEN = process.env.DISCORD_TOKEN;

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    try {
        const test = await fetch('https://openrouter.ai/api/v1/auth/key', {
            headers: { 'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}` }
        });
        await message.reply(`Статус соединения с API: ${test.status}`);
    } catch(e) { await message.reply(`Ошибка соединения: ${e.message}`); }
});

client.login(TOKEN);
