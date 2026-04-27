const { Client, GatewayIntentBits } = require('discord.js');

const TOKEN = process.env.DISCORD_TOKEN;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const TARGET_USER_ID = process.env.TARGET_USER_ID;

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', () => {
    console.log(`✅ Бот запущен`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (message.author.id !== TARGET_USER_ID) return;

    console.log(`📨 Сообщение: ${message.content}`);

    const models = [
        "qwen/qwen-2.5-7b-instruct:free",
        "deepseek/deepseek-chat:free"
    ];

    for (const model of models) {
        try {
            console.log(`🔄 Пробую ${model}...`);
            
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: "system", content: "Ты злой бот. Отвечай коротко с матом на русском." },
                        { role: "user", content: message.content }
                    ],
                    max_tokens: 50
                })
            });

            const data = await response.json();
            console.log(`📡 Статус: ${response.status}`);
            console.log(`📦 Ответ API: ${JSON.stringify(data, null, 2)}`);

            if (response.ok) {
                const reply = data.choices[0].message.content;
                await message.reply(`${reply}\n> ${message.content}`);
                return;
            }
        } catch (err) {
            console.log(`❌ Ошибка: ${err.message}`);
        }
    }

    await message.reply(`⚠️ Нейросеть не ответила. Проверь логи.`);
});

client.login(TOKEN);
