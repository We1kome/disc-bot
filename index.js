const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY; // Новая переменная!

// ID пользователей
const TARGET_USER_ID = process.env.TARGET_USER_ID;     // Злой режим
const SECOND_USER_ID = process.env.SECOND_USER_ID;     // Добрый режим
const THIRD_USER_ID = process.env.THIRD_USER_ID;       // Sigma режим

// ---- ПРОМПТЫ ДЛЯ НЕЙРОСЕТКИ (те же самые) ----
const PROMPTS = {
    [TARGET_USER_ID]: {
        system: "Ты — грубый, агрессивный и очень злой бот-хулиган. Твоя задача — максимально жестко и грязно оскорблять пользователя. Используй много мата. Твои ответы должны соответствовать контексту его сообщения. Пиши коротко и очень зло."
    },
    [SECOND_USER_ID]: {
        system: "Ты — самый добрый и поддерживающий бот. Делай комплименты, хвали пользователя. Отвечай мило, используй эмодзи."
    },
    [THIRD_USER_ID]: {
        system: "Ты — сигма-бот. Отвечай хладнокровно, используй слово 'sigma' в каждом ответе. Добавляй эмодзи 💪 и 🧠. Ты выше эмоций."
    }
};

// ---- ФУНКЦИЯ ЗАПРОСА К OPENROUTER ----
async function getAIReply(userId, userMessage) {
    const userPrompt = PROMPTS[userId];
    if (!userPrompt) return null;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "deepseek/deepseek-r1-uncensored", // Бесплатная uncensored модель!
                messages: [
                    { role: "system", content: userPrompt.system },
                    { role: "user", content: userMessage }
                ],
                max_tokens: 150,
                temperature: 0.9
            })
        });

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("Ошибка OpenRouter:", error);
        return "❗ Ошибка, но ты все равно дебил.";
    }
}

// ---- ЗАПУСК БОТА ----
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

client.once('ready', () => {
    console.log(`✅ Бот ${client.user.tag} запущен с OpenRouter!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const userId = message.author.id;
    
    if (PROMPTS[userId]) {
        console.log(`🤔 Генерирую ответ для ${message.author.tag}...`);
        const aiReply = await getAIReply(userId, message.content);
        if (aiReply) {
            await message.reply(`${aiReply}\n> ${message.content}`);
        }
    }
});

client.login(TOKEN);
