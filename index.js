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

// ПРАВИЛЬНЫЕ ID МОДЕЛЕЙ (из твоего лога)
const models = [
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "meta-llama/llama-3.2-3b-instruct:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "liquid/lfm-2.5-1.2b-instruct:free",
    "inclusionai/ling-2.6-flash:free",
    "tencent/hy3-preview:free",
    "cognitivecomputations/dolphin-mistral-24b-venice-edition:free"
];

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getAIReply(userId, userMessage) {
    const userPrompt = PROMPTS[userId];
    if (!userPrompt) return null;

    for (const model of models) {
        try {
            console.log(`🔄 Пробую: ${model}`);
            
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
                console.log(`⚠️ Лимит ${model}, ждём 2 сек...`);
                await delay(2000);
                continue;
            }

            if (response.ok) {
                const data = await response.json();
                let reply = data.choices[0].message.content;
                reply = reply.replace(/<\|.*?\|>/g, '').trim();
                if (reply.length > 500) reply = reply.substring(0, 500);
                console.log(`✅ Ответ от ${model}`);
                return reply;
            } else {
                const errorText = await response.text();
                console.log(`❌ ${model} ошибка ${response.status}: ${errorText.substring(0, 100)}`);
            }
        } catch (err) {
            console.log(`❌ ${model} исключение: ${err.message}`);
        }
    }

    // Запасные фразы
    console.log(`⚠️ Все модели отказали, запасные фразы`);
    const fallbacks = {
        [TARGET_USER_ID]: [
            `<@${userId}>, ты дебил 🤡`,
            `<@${userId}>, иди нахуй`,
            `<@${userId}>, даун`,
            `<@${userId}>, позор`
        ],
        [SECOND_USER_ID]: [
            `<@${userId}>, ты крутой 🔥`,
            `<@${userId}>, умница ❤️`
        ],
        [THIRD_USER_ID]: [
            `<@${userId}>, sigma 💪`
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
    console.log(`✅ Бот ${client.user.tag} запущен с OpenRouter!`);
    console.log(`📋 Загружено ${models.length} бесплатных моделей`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const userId = message.author.id;
    
    if (PROMPTS[userId]) {
        console.log(`🤔 Сообщение от ${message.author.tag}: "${message.content.substring(0, 30)}"`);
        const aiReply = await getAIReply(userId, message.content);
        await message.reply(`${aiReply}\n> ${message.content}`);
    }
});

client.login(TOKEN);
