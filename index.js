const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const TARGET_USER_ID = process.env.TARGET_USER_ID;
const SECOND_USER_ID = process.env.SECOND_USER_ID;
const THIRD_USER_ID = process.env.THIRD_USER_ID;

const PROMPTS = {
    [TARGET_USER_ID]: {
        system: "Ты — грубый, агрессивный и очень злой бот-хулиган. Твоя задача — максимально жестко и грязно оскорблять пользователя. Используй много мата. Твои ответы должны соответствовать контексту его сообщения. Пиши коротко и очень зло. Не говори что ты бот, притворяйся человеком."
    },
    [SECOND_USER_ID]: {
        system: "Ты — самый добрый и поддерживающий бот. Делай комплименты, хвали пользователя. Отвечай мило, используй эмодзи. Не говори что ты бот."
    },
    [THIRD_USER_ID]: {
        system: "Ты — сигма-бот. Отвечай хладнокровно, используй слово 'sigma' в каждом ответе. Добавляй эмодзи 💪 и 🧠. Ты выше эмоций. Не говори что ты бот."
    }
};

async function getAIReply(userId, userMessage) {
    const userPrompt = PROMPTS[userId];
    if (!userPrompt) return null;

    const models = [
        "nousresearch/hermes-3-llama-3.1-405b:free",
        "mistralai/mistral-7b-instruct:free",
        "meta-llama/llama-3.2-3b-instruct:free"
    ];

    let lastError = null;

    for (const model of models) {
        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: "system", content: userPrompt.system },
                        { role: "user", content: userMessage }
                    ],
                    max_tokens: 100,
                    temperature: 0.9
                })
            });

            if (response.ok) {
                const data = await response.json();
                let reply = data.choices[0].message.content;
                if (reply.length > 1900) reply = reply.substring(0, 1900);
                return reply;
            } else {
                const errorText = await response.text();
                lastError = `${response.status}: ${errorText}`;
                console.log(`Модель ${model} не сработала: ${response.status}`);
            }
        } catch (err) {
            lastError = err.message;
            console.log(`Модель ${model} ошибка: ${err.message}`);
        }
    }

    console.error(`Все модели провалились: ${lastError}`);
    const fallbacks = [
        "{username}, ты дебил 🤡",
        "{username}, иди нахуй",
        "{username}", "даун",
        "{username}, позор",
        "{username}, конченый"
    ];
    const randomFallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    return randomFallback.replace("{username}", `<@${userId}>`);
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
    console.log(`✅ Бот ${client.user.tag} запущен с OpenRouter!`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const userId = message.author.id;
    
    if (PROMPTS[userId]) {
        console.log(`🤔 Генерирую ответ для ${message.author.tag}...`);
        const aiReply = await getAIReply(userId, message.content);
        await message.reply(`${aiReply}\n> ${message.content}`);
    }
});

client.login(TOKEN);
