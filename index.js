const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const TARGET_USER_ID = process.env.TARGET_USER_ID;
const SECOND_USER_ID = process.env.SECOND_USER_ID;
const THIRD_USER_ID = process.env.THIRD_USER_ID;

const PROMPTS = {
    [TARGET_USER_ID]: {
        system: "Ты — грубый, агрессивный и очень злой бот-хулиган. Отвечай максимально жестко и грязно оскорбляя пользователя. Используй много мата. Отвечай на русском. Пиши коротко — максимум 2 предложения. Не говори что ты бот."
    },
    [SECOND_USER_ID]: {
        system: "Ты — самый добрый и поддерживающий бот. Делай комплименты, хвали пользователя. Отвечай мило, используй эмодзи. Отвечай на русском. Пиши коротко. Не говори что ты бот."
    },
    [THIRD_USER_ID]: {
        system: "Ты — сигма-бот. Отвечай хладнокровно, используй слово 'sigma' в каждом ответе. Добавляй эмодзи 💪. Отвечай на русском. Пиши коротко. Не говори что ты бот."
    }
};

// Задержка между попытками
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getAIReply(userId, userMessage) {
    const userPrompt = PROMPTS[userId];
    if (!userPrompt) return null;

    // ТОЛЬКО РАБОЧИЕ БЕСПЛАТНЫЕ МОДЕЛИ НА OPENROUTER
    const models = [
        "google/gemini-2.0-flash-lite-preview-02-05:free",
        "microsoft/phi-3.5-mini-128k-instruct:free",
        "qwen/qwen-2.5-7b-instruct:free"
    ];

    for (const model of models) {
        try {
            console.log(`🔄 Пробую модель: ${model}`);
            
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
                    max_tokens: 80,
                    temperature: 0.9
                })
            });

            if (response.status === 429) {
                console.log(`⚠️ Модель ${model} лимит превышен, ждём 3 секунды...`);
                await delay(3000);
                continue;
            }

            if (response.status === 404) {
                console.log(`❌ Модель ${model} не найдена, пробуем следующую...`);
                continue;
            }

            if (response.ok) {
                const data = await response.json();
                let reply = data.choices[0].message.content;
                reply = reply.replace(/<\|.*?\|>/g, '').trim();
                if (reply.length > 500) reply = reply.substring(0, 500);
                console.log(`✅ Ответ получен от модели: ${model}`);
                return reply;
            } else {
                console.log(`❌ Модель ${model} ошибка ${response.status}`);
            }
        } catch (err) {
            console.log(`❌ Модель ${model} исключение: ${err.message}`);
        }
    }

    // Запасные фразы если все модели отказали
    console.log(`⚠️ Все модели отказали, использую запасные фразы`);
    const fallbacks = {
        [TARGET_USER_ID]: [
            `<@${userId}>, ты дебил 🤡`,
            `<@${userId}>, иди нахуй`,
            `<@${userId}>, даун`,
            `<@${userId}>, позор`,
            `<@${userId}>, конченый`
        ],
        [SECOND_USER_ID]: [
            `<@${userId}>, ты крутой 🔥`,
            `<@${userId}>, умница ❤️`
        ],
        [THIRD_USER_ID]: [
            `<@${userId}>, sigma 💪`
        ]
    };
    const userFallbacks = fallbacks[userId] || [`<@${userId}>, привет`];
    return userFallbacks[Math.floor(Math.random() * userFallbacks.length)];
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
    console.log(`📋 Доступные модели: google/gemini-2.0-flash-lite, microsoft/phi-3.5, qwen/qwen-2.5`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const userId = message.author.id;
    
    if (PROMPTS[userId]) {
        console.log(`🤔 Получено сообщение от ${message.author.tag}: "${message.content.substring(0, 50)}"`);
        const aiReply = await getAIReply(userId, message.content);
        await message.reply(`${aiReply}\n> ${message.content}`);
    }
});

client.login(TOKEN);
