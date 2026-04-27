const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const TARGET_USER_ID = process.env.TARGET_USER_ID;
const SECOND_USER_ID = process.env.SECOND_USER_ID;
const THIRD_USER_ID = process.env.THIRD_USER_ID;

const PROMPTS = {
    [TARGET_USER_ID]: {
        system: "Ты — грубый, агрессивный и очень злой бот-хулиган. Отвечай ТОЛЬКО на русском языке. Используй много мата. Пиши коротко — максимум 2 предложения. Никогда не отвечай на английском."
    },
    [SECOND_USER_ID]: {
        system: "Ты — самый добрый и поддерживающий бот. Делай комплименты, хвали пользователя. Отвечай ТОЛЬКО на русском языке. Используй эмодзи. Пиши коротко."
    },
    [THIRD_USER_ID]: {
        system: "Ты — сигма-бот. Отвечай ТОЛЬКО на русском языке. Обязательно используй слово 'сигма' в каждом ответе. Добавляй эмодзи 💪. Пиши коротко — одно предложение. Пример: 'Сигма 💪, норм совет.'"
    }
};

const models = [
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "nvidia/nemotron-3-super-120b-a12b:free"
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getAIReply(userId, userMessage) {
    const userPrompt = PROMPTS[userId];
    if (!userPrompt) return null;

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
                    max_tokens: 100,
                    temperature: 0.8
                })
            });

            console.log(`📡 Статус ответа: ${response.status} для модели ${model}`);

            if (response.status === 429) {
                console.log(`⚠️ Лимит ${model}, жду 3 секунды...`);
                await delay(3000);
                continue;
            }

            if (response.status === 401 || response.status === 403) {
                console.log(`❌ Ошибка авторизации! Проверь API ключ на OpenRouter`);
                return getFallbackReply(userId);
            }

            if (response.ok) {
                const data = await response.json();
                let reply = data.choices[0].message.content;
                reply = reply.replace(/<\|.*?\|>/g, '').trim();
                console.log(`✅ УСПЕХ! Модель ${model} ответила: "${reply.substring(0, 50)}..."`);
                return reply;
            } else {
                const errorText = await response.text();
                console.log(`❌ Модель ${model} вернула ошибку ${response.status}: ${errorText.substring(0, 200)}`);
            }
        } catch (err) {
            console.log(`❌ Исключение при запросе к ${model}: ${err.message}`);
        }
    }

    console.log(`🔥 ВСЕ МОДЕЛИ НЕ СРАБОТАЛИ! Использую запасные фразы`);
    return getFallbackReply(userId);
}

function getFallbackReply(userId) {
    console.log(`📢 Отправляю запасную фразу пользователю ${userId}`);
    const fallbacks = {
        [TARGET_USER_ID]: [
            `<@${userId}>, ты дебил 🤡`,
            `<@${userId}>, иди нахуй`
        ],
        [SECOND_USER_ID]: [
            `<@${userId}>, ты крутой 🔥`,
            `<@${userId}>, умница ❤️`
        ],
        [THIRD_USER_ID]: [
            `<@${userId}>, сигма 💪`,
            `<@${userId}>, сигма-бой 💪`
        ]
    };
    const list = fallbacks[userId] || [`<@${userId}>, привет`];
    return list[Math.floor(Math.random() * list.length)];
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
    console.log(`📋 Модели: ${models.join(", ")}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const userId = message.author.id;
    
    if (PROMPTS[userId]) {
        console.log(`\n📨 НОВОЕ СООБЩЕНИЕ от ${message.author.tag}: "${message.content}"`);
        const aiReply = await getAIReply(userId, message.content);
        console.log(`💬 ИТОГОВЫЙ ОТВЕТ: "${aiReply}"\n`);
        await message.reply(`${aiReply}\n> ${message.content}`);
    }
});

client.login(TOKEN);
