const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const TARGET_USER_ID = process.env.TARGET_USER_ID;
const SECOND_USER_ID = process.env.SECOND_USER_ID;
const THIRD_USER_ID = process.env.THIRD_USER_ID;

// МАКСИМАЛЬНО АГРЕССИВНЫЕ ПРОМПТЫ
const PROMPTS = {
    [TARGET_USER_ID]: {
        system: `Ты — злой, агрессивный бот-хулиган. Твоя задача — оскорблять пользователя. Отвечай ТОЛЬКО на РУССКОМ языке. Пиши коротко — максимум 2 предложения. Обязательно используй мат.

Примеры правильных ответов:
- "Ты долбаеб, иди нахуй"
- "Даун ебучий, позор"
- "Соси хуй, конченый"

Запомни: отвечаешь только на русском, только с матом. Никакой вежливости.`
    },
    [SECOND_USER_ID]: {
        system: `Ты — агрессивный бот. Отвечай только на русском. Оскорбляй пользователя. Используй мат. Пример: "Дебил, иди нахуй"`
    },
    [THIRD_USER_ID]: {
        system: `Ты — сигма-бот. Отвечай только на русском. Обязательно используй слово "сигма" и эмодзи 💪. Оскорбляй пользователя. Пример: "Сигма 💪, ты даун ебучий"`
    }
};

// РУССКИЕ МОДЕЛИ, КОТОРЫЕ ХОРОШО ПОНИМАЮТ РУССКИЙ
const models = [
    "qwen/qwen-2.5-7b-instruct:free",           // Хорошо понимает русский
    "deepseek/deepseek-chat:free",               // DeepSeek с русским
    "google/gemma-2-9b-it:free",                 // Gemma 2 (лучше чем Gemma 4)
    "mistralai/mistral-7b-instruct-v0.3:free"    // Mistral 7B v0.3
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
                    max_tokens: 100,
                    temperature: 0.9
                })
            });

            if (response.status === 429) {
                console.log(`⚠️ Лимит ${model}, жду 2 сек...`);
                await delay(2000);
                continue;
            }

            if (response.ok) {
                const data = await response.json();
                let reply = data.choices[0].message.content;
                reply = reply.replace(/<\|.*?\|>/g, '').trim();
                
                // Если ответ на английском - пробуем другую модель
                if (reply.match(/[a-zA-Z]{10,}/) && !reply.match(/[а-яА-Я]{3,}/)) {
                    console.log(`⚠️ ${model} ответил на английском, пробую дальше...`);
                    continue;
                }
                
                console.log(`✅ ОТВЕТ от ${model}: "${reply.substring(0, 80)}"`);
                return reply;
            }
        } catch (err) {
            console.log(`❌ ${model}: ${err.message}`);
        }
    }

    // Запасные оскорбления
    const fallbacks = [
        `<@${userId}>, ты долбаеб 🤡`,
        `<@${userId}>, иди нахуй`,
        `<@${userId}>, даун ебучий`
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
    console.log(`📋 Русские модели: Qwen, DeepSeek, Gemma 2, Mistral`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const userId = message.author.id;
    
    if (PROMPTS[userId]) {
        console.log(`\n📨 ${message.author.tag}: "${message.content}"`);
        const reply = await getAIReply(userId, message.content);
        console.log(`💬 ОТВЕТ: "${reply}"\n`);
        await message.reply(`${reply}\n> ${message.content}`);
    }
});

client.login(TOKEN);
