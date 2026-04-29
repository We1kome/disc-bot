import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || "1498208678723977216";
const OWNER_ID = process.env.OWNER_ID;

const ROAST_WORKER = "https://loverbot.vladikkotik3.workers.dev";
const HELPER_WORKER = "https://loverhelper.vladikkotik3.workers.dev";

const ROAST_CHANNEL = "857600197809668159";
const HELPER_CHANNEL = "1498239736320622684";

if (!TOKEN || !OWNER_ID) process.exit(1);

const settings = {
    enabled: true,
    roastChance: 25
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const messageHistory = new Map();

const commands = [
    new SlashCommandBuilder().setName('roastchance').setDescription('Шанс агрессивного ответа в чате')
        .addIntegerOption(o => o.setName('percent').setDescription('0-100%').setRequired(true).setMinValue(0).setMaxValue(100)),
    new SlashCommandBuilder().setName('toggle').setDescription('Вкл/выкл бота')
        .addStringOption(o => o.setName('state').setDescription('Состояние').setRequired(true)
            .addChoices({ name: 'Вкл', value: 'on' }, { name: 'Выкл', value: 'off' })),
    new SlashCommandBuilder().setName('settings').setDescription('Настройки'),
    new SlashCommandBuilder().setName('help').setDescription('Список команд')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.on('ready', async () => {
    console.log('✅ Бот запущен:', client.user.tag);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Команды зарегистрированы');
    } catch (e) {
        console.error('Ошибка команд:', e.message);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.user.id !== OWNER_ID) {
        return interaction.reply({ content: 'Нет прав', flags: 64 });
    }
    
    await interaction.deferReply({ flags: 64 });
    const { commandName } = interaction;
    
    if (commandName === 'roastchance') {
        settings.roastChance = interaction.options.getInteger('percent');
        return interaction.editReply({ content: `Шанс агро: ${settings.roastChance}%` });
    }
    if (commandName === 'toggle') {
        settings.enabled = interaction.options.getString('state') === 'on';
        return interaction.editReply({ content: settings.enabled ? 'Включен' : 'Выключен' });
    }
    if (commandName === 'settings') {
        return interaction.editReply({ content: `Вкл: ${settings.enabled}\nRoast шанс: ${settings.roastChance}%` });
    }
    if (commandName === 'help') {
        return interaction.editReply({ content: '/roastchance — шанс агро\n/toggle — вкл/выкл\n/settings — настройки' });
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!settings.enabled) return;
    if (message.content.startsWith('/')) return;
    
    const channelId = message.channel.id;
    
    // Определяем какой Worker использовать
    let workerUrl;
    
    if (channelId === ROAST_CHANNEL) {
        // Агрессивный чат — проверяем шанс
        if (Math.random() * 100 > settings.roastChance) return;
        workerUrl = ROAST_WORKER;
    } else if (channelId === HELPER_CHANNEL) {
        // Адекватный чат — всегда отвечаем
        workerUrl = HELPER_WORKER;
    } else {
        // Другие каналы — игнорируем
        return;
    }
    
    // Собираем историю
    if (!messageHistory.has(channelId)) messageHistory.set(channelId, []);
    const history = messageHistory.get(channelId);
    
    let cleanContent = message.content;
    
    history.push({ author: message.author.username, content: cleanContent });
    if (history.length > 5) history.shift();
    
    try {
        const response = await fetch(workerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: cleanContent,
                context: history,
                currentAuthor: message.author.username
            })
        });
        
        const data = await response.json();
        
        if (data.reply) {
            let replyText = data.reply;
            if (replyText.length > 500) replyText = replyText.substring(0, 497) + "...";
            await message.reply(replyText);
        }
    } catch (err) {
        console.error('Ошибка:', err.message);
    }
});

client.login(TOKEN);
