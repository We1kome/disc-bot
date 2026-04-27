const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const TARGET_USER_ID = process.env.TARGET_USER_ID;
const SECOND_USER_ID = process.env.SECOND_USER_ID;
const THIRD_USER_ID = process.env.THIRD_USER_ID;

// ... (твои PROMPTS остаются без изменений) ...
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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getAIReply(userId, userMessage) {
    const userPrompt = PROMPTS[userId];
    if (!userPrompt) return null;

    // === АКТУАЛЬНЫЙ СПИСОК БЕСПЛАТНЫХ МОДЕЛЕЙ (Апрель 2026) ===
    const models = [
        "qwen/qwen3.6-plus-preview:free",        // Новая мощная бесплатная модель
        "deepseek/deepseek-chat:free",            // Стабильная DeepSeek
        "google/gemini-2.0-flash-lite-preview-02-05:free" // Быстрая Gemini
    ];

    for (const model of models) {
        for (let attempt = 1; attempt <= 2; attempt++) { // Две попытки на модель
            try {
                console.log(`🔄 Попытка ${attempt} для модели: ${model}`);
                
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
                    console.log(`⚠️ Лимит модели ${model}, ждём 3 секунды...`);
                    await delay(3000);
                    continue;
                }

                if (response.status === 404) {
                    console.log(`❌ Модель ${model} не найдена (404) - пропускаем`);
                    break; // Модель мертва, переходим к следующей
                }

                if (response.ok) {
                    const data = await response.json();
                    let reply = data.choices[0].message.content;
                    reply = reply.replace(/<\|.*?\|>/g, '').trim();
                    console.log(`✅ Успешный ответ от ${model}`);
                    return reply;
                } else {
                    console.log(`❌ Ошибка ${response.status} для ${model}`);
                }
            } catch (err) {
                console.log(`❌ Исключение для ${model}: ${err.message}`);
            }
        }
    }

    // Фоллбэк (твои старые фразы)
    console.log(`⚠️ Все ИИ-модели отказали, включаю режим "дебил"`);
    const fallbacks = {
        [TARGET_USER_ID]: [`<@${userId}>, ты дебил 🤡`, `<@${userId}>, иди нахуй`],
        [SECOND_USER_ID]: [`<@${userId}>, ты крутой 🔥`],
        [THIRD_USER_ID]: [`<@${userId}>, sigma 💪`]
    };
    const list = fallbacks[userId] || [`<@${userId}>, привет`];
    return list[Math.floor(Math.random() * list.length)];
}

// ... (остальной код клиента без изменений) ...
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
    console.log(`📋 Используются актуальные бесплатные модели (Апрель 2026)`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const userId = message.author.id;
    
    if (PROMPTS[userId]) {
        console.log(`🤔 Получено сообщение от ${message.author.tag}`);
        const aiReply = await getAIReply(userId, message.content);
        await message.reply(`${aiReply}\n> ${message.content}`);
    }
});

client.login(TOKEN);
