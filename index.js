const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;

const TARGET_USER_ID = process.env.TARGET_USER_ID;
const SECOND_USER_ID = process.env.SECOND_USER_ID;
const THIRD_USER_ID = process.env.THIRD_USER_ID;

// МАКСИМАЛЬНО ОСКОРБИТЕЛЬНЫЕ ФРАЗЫ (работают мгновенно, без глюков)
const INSULTS = {
    [TARGET_USER_ID]: [
        "<@{id}>, ты долбаеб конченый 🤡",
        "<@{id}>, иди нахуй, ебанат",
        "<@{id}>, ты даун ебучий, позор",
        "<@{id}>, отъебись, пидор",
        "<@{id}>, соси хуй, уебок",
        "<@{id}>, ты даже привлекательным быть не можешь, дебил",
        "<@{id}>, закрой ебало, петух",
        "<@{id}>, гондон, не беси",
        "<@{id}>, ты шизик конченый",
        "<@{id}>, позор человечества, иди в окно",
        "<@{id}>, у тебя лицо ебанатское",
        "<@{id}>, ты чмо, а не человек",
        "<@{id}>, отбитый даун, вылечись",
        "<@{id}>, хуесос, молчал бы лучше"
    ],
    [SECOND_USER_ID]: [
        "<@{id}>, ты дебил 🤡",
        "<@{id}>, иди нахуй",
        "<@{id}>, даун ебучий",
        "<@{id}>, позор, конченый"
    ],
    [THIRD_USER_ID]: [
        "<@{id}>, сигма 💪, иди нахуй",
        "Сигма 💪, даун, ты даже не сигма",
        "<@{id}>, сигма-пидор 💪",
        "Сигма 💪, соси сигму, ебанат"
    ]
};

function getRandomInsult(userId) {
    const insults = INSULTS[userId];
    if (!insults) return `<@${userId}>, привет 🤡`;
    
    const randomIndex = Math.floor(Math.random() * insults.length);
    return insults[randomIndex].replace("{id}", userId);
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
    console.log(`🔞 РЕЖИМ: МАКСИМАЛЬНЫЕ ОСКОРБЛЕНИЯ (без нейросети)`);
    console.log(`💀 Загружено фраз: ${Object.values(INSULTS).reduce((a,b) => a + b.length, 0)}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const userId = message.author.id;
    
    if (INSULTS[userId]) {
        const insult = getRandomInsult(userId);
        console.log(`📨 ${message.author.tag}: "${message.content}"`);
        console.log(`💬 ОТВЕТ: "${insult}"`);
        await message.reply(`${insult}\n> ${message.content}`);
    }
});

client.login(TOKEN);
