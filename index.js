import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || "1498208678723977216";
const OWNER_ID = process.env.OWNER_ID;
const WORKER_URL = "https://loverbot.vladikkotik3.workers.dev";

if (!TOKEN || !OWNER_ID) {
    console.error('❌ Нужны переменные: DISCORD_TOKEN, OWNER_ID');
    process.exit(1);
}

const settings = {
    enabled: true,
    mode: 'agressive',
    whitelist: [],
    blacklist: [],
    channels: [],
    replyChance: 100,
    customPrompt: null
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ]
});

const messageHistory = new Map();

const commands = [
    new SlashCommandBuilder()
        .setName('mode')
        .setDescription('Сменить режим бота')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('Режим')
                .setRequired(true)
                .addChoices(
                    { name: '😡 Агрессивный (гопник)', value: 'agressive' },
                    { name: '😊 Адекватный (помощник)', value: 'normal' },
                    { name: '😐 Нейтральный (собеседник)', value: 'neutral' }
                )),
    
    new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Показать настройки'),
    
    new SlashCommandBuilder()
        .setName('toggle')
        .setDescription('Включить/выключить')
        .addStringOption(option =>
            option.setName('state')
                .setDescription('Состояние')
                .setRequired(true)
                .addChoices(
                    { name: '✅ Включить', value: 'on' },
                    { name: '❌ Выключить', value: 'off' }
                )),
    
    new SlashCommandBuilder()
        .setName('chance')
        .setDescription('Шанс ответа (0-100%)')
        .addIntegerOption(option =>
            option.setName('percent')
                .setDescription('Процент')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(100))
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

// Регистрируем команды ПЕРЕД запуском
try {
    console.log('🔄 Регистрация команд...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Команды зарегистрированы!');
} catch (error) {
    console.error('❌ Ошибка регистрации:', error.message);
}

client.on('ready', () => {
    console.log(`✅ Бот ${client.user.tag} запущен!`);
});

// ВАЖНО: обработчик interactionCreate
client.on('interactionCreate', async (interaction) => {
    // Только слеш-команды
    if (!interaction.isChatInputCommand()) return;
    
    console.log(`🔧 Команда: /${interaction.commandName} от ${interaction.user.username}`);
    
    // Проверка владельца
    if (interaction.user.id !== OWNER_ID) {
        return interaction.reply({ 
            content: '🚫 Только владелец может использовать команды!', 
            ephemeral: true 
        });
    }
    
    const { commandName } = interaction;
    
    if (commandName === 'mode') {
        const mode = interaction.options.getString('type');
        settings.mode = mode;
        const names = { 
            agressive: '😡 Агрессивный (гопник)', 
            normal: '😊 Адекватный (помощник)', 
            neutral: '😐 Нейтральный (собеседник)' 
        };
        await interaction.reply({ 
            content: `✅ Режим изменён на: **${names[mode]}**`, 
            ephemeral: true 
        });
        console.log(`🔄 Режим → ${mode}`);
    } 
    else if (commandName === 'settings') {
        await interaction.reply({ 
            content: `⚙️ **Настройки:**\n\`\`\`json\n${JSON.stringify(settings, null, 2)}\n\`\`\``, 
            ephemeral: true 
        });
    } 
    else if (commandName === 'toggle') {
        settings.enabled = interaction.options.getString('state') === 'on';
        await interaction.reply({ 
            content: `✅ Бот **${settings.enabled ? 'включен' : 'выключен'}**`, 
            ephemeral: true 
        });
    } 
    else if (commandName === 'chance') {
        settings.replyChance = interaction.options.getInteger('percent');
        await interaction.reply({ 
            content: `✅ Шанс ответа: **${settings.replyChance}%**`, 
            ephemeral: true 
        });
    }
});

// Обработка обычных сообщений
client.on('messageCreate', async (message) => {
    // Игнорируем команды (они обрабатываются в interactionCreate)
    if (message.content.startsWith('/')) {
        console.log(`⏭ Пропуск команды: ${message.content}`);
        return;
    }
    
    if (message.author.bot) return;
    if (!settings.enabled) return;
    if (message.content.includes(";")) return;
    if (Math.random() * 100 > settings.replyChance) return;
    if (settings.blacklist.includes(message.author.id)) return;
    if (settings.whitelist.length > 0 && !settings.whitelist.includes(message.author.id)) return;
    if (settings.channels.length > 0 && !settings.channels.includes(message.channel.id)) return;
    
    const channelId = message.channel.id;
    if (!messageHistory.has(channelId)) messageHistory.set(channelId, []);
    
    const history = messageHistory.get(channelId);
    let cleanContent = message.content;
    const mentionedUsers = message.mentions.users;
    
    if (mentionedUsers.size > 0) {
        mentionedUsers.forEach((user, id) => {
            cleanContent = cleanContent.replace(new RegExp(`<@!?${id}>`, 'g'), `@${user.username}`);
        });
    }
    
    history.push({ author: message.author.username, content: cleanContent, timestamp: Date.now() });
    if (history.length > 10) history.shift();
    
    console.log(`📨 [${message.author.username}]: "${cleanContent}"`);
    
    try {
        const response = await fetch(WORKER_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: cleanContent,
                context: history.slice(-5),
                currentAuthor: message.author.username,
                mode: settings.mode,
                customPrompt: settings.customPrompt
            })
        });
        
        const data = await response.json();
        
        if (data.reply) {
            let replyText = data.reply;
            mentionedUsers.forEach((user, id) => {
                const escaped = user.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                replyText = replyText.replace(new RegExp(`@${escaped}`, 'gi'), `<@${id}>`);
            });
            
            if (replyText.length > 500) replyText = replyText.substring(0, 497) + "...";
            await message.reply(replyText);
            console.log(`✅ Ответ отправлен`);
        }
    } catch (err) {
        console.error(`💥 Ошибка: ${err.message}`);
    }
});

client.login(TOKEN);
