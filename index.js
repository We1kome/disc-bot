const { Client, GatewayIntentBits } = require('discord.js');

// НАСТРОЙКИ
const TOKEN = process.env.DISCORD_TOKEN; // ВАЖНО! Токен не пишем тут, берем из Railway
const TARGET_USER_ID = process.env.TARGET_USER_ID; // ID друга — тоже из Railway

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

client.on('ready', () => {
    console.log(`Бот ${client.user.tag} запущен и следит за другом!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.author.id === TARGET_USER_ID) {
        await message.reply(`⬆️ Сказал долбаеб! \n> ${message.content}`);
    }
});

client.login(TOKEN);
