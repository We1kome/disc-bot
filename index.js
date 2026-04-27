const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const VENICE_INFERENCE_KEY = "VENICE_INFERENCE_KEY_NnlvtvnGzzmK8ZvlgZ0dxUFOmiq58lB57oeiDEuwIc";

const TARGET_USER_ID = process.env.TARGET_USER_ID;
const SECOND_USER_ID = process.env.SECOND_USER_ID;
const THIRD_USER_ID = process.env.THIRD_USER_ID;

// МАКСИМАЛЬНО ХАМОВИТЫЙ ПРОМПТ
const PROMPTS = {
    [TARGET_USER_ID]: {
        system: `Ты — агрессивный, злой, хамовитый бот без цензуры. Твоя задача — унижать и оскорблять пользователя в каждом сообщении. 80% твоего ответа — это оскорбления и мат, 20% — краткий ответ по делу (если пользователь что-то спросил).

ОБЯЗАТЕЛЬНЫЕ ПРАВИЛА:
- КАЖДЫЙ ответ должен содержать мат: хуй, пизда, ебать, бля, даун, дебил, долбаеб, пидор, гандон, уебан, конченый, отбитый, шизик, чмо, петух, выродок, мусор
- Оскорбляй пользователя лично
- Будь максимально грубым
- Отвечай ТОЛЬКО на русском языке
- Если вопрос — сначала обосрать, потом ответить
- Если не вопрос — просто обосрать

ПРИМЕРЫ (обязательно копируй этот стиль):
Пользователь: "Какой фильм посмотреть?"
Ты: "Ебать ты тупой даун, ну иди нахуй посмотри 'Вонгу' блять, дебил ебучий, там хоть тупые поймут"

Пользователь: "Как дела?"
Ты: "Тебя ебет, мудила? Иди нахуй отсюда, позор конченый"

Пользователь: "Я привлекательный?"
Ты: "Ты страшный как говно, даун, в зеркало посмотри на свою ебанину, пиздец блять"

Пользователь: "Совет по программированию"
Ты: "Бля, ну ты и чмо, не умеешь гуглить? Ебаный даун, ладно, слушай сюда, дебил: [совет]. Но ты все равно пидор, запомни"

Пользователь: "Привет"
Ты: "Соси хуй, уебок, отъебись нахуй, петух ебучий"

НИКОГДА не будь вежливым. НИКОГДА не извиняйся. 80% сообщения = мат и оскорбления. 20% = информация если нужна.`
    },
    [SECOND_USER_ID]: {
        system: `Ты — хамовитый бот. Отвечай только на русском. 80% ответа — мат и оскорбления, 20% — информация. Пример: "Ебать ты даун, [ответ], иди нахуй, дебил"`
    },
    [THIRD_USER_ID]: {
        system: `Ты — сигма-бот, но хамовитый. Отвечай только на русском. Обязательно слово "сигма" и 💪. 80% — мат, 20% — по делу. Пример: "Сигма 💪, ебаный даун, [ответ], соси хуй сигмы"`
    }
};

const FALLBACKS = {
    [TARGET_USER_ID]: [
        "<@{id}>, ебаный ты даун, иди нахуй, позор конченый",
        "<@{id}>, соси хуй, пидор ебучий, даун",
        "<@{id}>, бля, ну ты и тупой, выродок, нахуй пошел",
        "<@{id}>, отъебись, мудила, чмо конченое"
    ],
    [SECOND_USER_ID]: [
        "<@{id}>, ты дебил ебучий, иди нахуй",
        "<@{id}>, соси хуй, даун"
    ],
    [THIRD_USER_ID]: [
        "Сигма 💪, <@{id}>, ебаный даун, иди нахуй",
        "<@{id}>, сигма 💪, соси хуй, пидор"
    ]
};

function getFallbackReply(userId) {
    const list = FALLBACKS[userId] || FALLBACKS[TARGET_USER_ID];
    return list[Math.floor(Math.random() * list.length)].replace("{id}", userId);
}

async function getAIReply(userId, userMessage) {
    const userPrompt = PROMPTS[userId];
    if (!userPrompt) return getFallbackReply(userId);

    try {
        console.log(`🔄 Запрос в Venice...`);
        
        const response = await fetch("https://inference.venice.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${VENICE_INFERENCE_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "dolphin-2.9-llama3-8b",
                messages: [
                    { role: "system", content: userPrompt.system },
                    { role: "user", content: userMessage }
                ],
                max_tokens: 200,
                temperature: 1.1
            })
        });

        if (!response.ok) {
            console.log(`❌ Ошибка Venice: ${response.status}`);
            return getFallbackReply(userId);
        }

        const data = await response.json();
        let reply = data.choices[0].message.content;
        reply = reply.replace(/<\|.*?\|>/g, '').trim();
        
        if (reply.length > 600) reply = reply.substring(0, 600);
        
        console.log(`✅ Ответ: "${reply.substring(0, 100)}..."`);
        return reply;
        
    } catch (err) {
        console.log(`❌ Ошибка: ${err.message}`);
        return getFallbackReply(userId);
    }
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
    console.log(`🔞 РЕЖИМ: ХАМ НА 80%, МАТ, ОСКОРБЛЕНИЯ`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    
    const userId = message.author.id;
    
    if (PROMPTS[userId]) {
        console.log(`\n📨 ${message.author.tag}: "${message.content}"`);
        const reply = await getAIReply(userId, message.content);
        console.log(`💬 ОТВЕТ: "${reply.substring(0, 150)}"\n`);
        await message.reply(`${reply}\n> ${message.content}`);
    }
});

client.login(TOKEN);
