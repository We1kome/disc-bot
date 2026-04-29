import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const OWNER_ID = process.env.OWNER_ID;
const ROAST_WORKER = process.env.ROAST_WORKER;
const HELPER_WORKER = process.env.HELPER_WORKER;
const ROAST_CHANNEL = process.env.ROAST_CHANNEL;
const HELPER_CHANNEL = process.env.HELPER_CHANNEL;

if (!TOKEN || !CLIENT_ID || !OWNER_ID || !ROAST_WORKER || !HELPER_WORKER || !ROAST_CHANNEL || !HELPER_CHANNEL) {
    console.error('Нет всех переменных');
    process.exit(1);
}

const settings = {
    enabled: true,
    roastChance: 15
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
    new SlashCommandBuilder()
        .setName('toggle')
        .setDescription('Вкл/выкл бота')
        .addStringOption(o => o.setName('state').setDescription('Состояние').setRequired(true)
            .addChoices(
                { name: 'Включить', value: 'on' }, 
                { name: 'Выключить', value: 'off' }
            )),
    new SlashCommandBuilder()
        .setName('roastchance')
        .setDescription('Шанс агрессивного ответа')
        .addIntegerOption(o => o.setName('percent').setDescription('0-100%').setRequired(true)
            .setMinValue(0).setMaxValue(100)),
    new SlashCommandBuilder()
        .setName('settings')
        .setDescription('Показать настройки'),
    new SlashCommandBuilder()
        .setName('cleanup')
        .setDescription('Очистить старые команды (при багах)'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Список команд')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.on('ready', async () => {
    console.log('Бот запущен:', client.user.tag);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('Команды зарегистрированы');
    } catch (e) {
        console.error('Ошибка регистрации:', e.message);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.user.id !== OWNER_ID) {
        return interaction.reply({ content: 'Нет прав', flags: 64 });
    }
    
    const { commandName } = interaction;
    
    // Для cleanup не делаем defer — он может занять время
    if (commandName === 'cleanup') {
        await interaction.deferReply({ flags: 64 });
        try {
            // Удаляем все текущие команды
            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
            // Ждём
            await new Promise(r => setTimeout(r, 2000));
            // Регистрируем заново
            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
            return interaction.editReply({ content: '✅ Старые команды удалены, новые зарегистрированы!' });
        } catch (e) {
            return interaction.editReply({ content: '❌ Ошибка: ' + e.message });
        }
    }
    
    await interaction.deferReply({ flags: 64 });
    
    if (commandName === 'toggle') {
        settings.enabled = interaction.options.getString('state') === 'on';
        return interaction.editReply({ content: settings.enabled ? '✅ Включен' : '❌ Выключен' });
    }
    
    if (commandName === 'roastchance') {
        settings.roastChance = interaction.options.getInteger('percent');
        return interaction.editReply({ content: `✅ Шанс агро: ${settings.roastChance}%` });
    }
    
    if (commandName === 'settings') {
        return interaction.editReply({ 
            content: `⚙️ **Настройки:**\nВкл: ${settings.enabled}\nШанс агро: ${settings.roastChance}%` 
        });
    }
    
    if (commandName === 'help') {
        return interaction.editReply({ 
            content: `**Команды:**\n/toggle — вкл/выкл\n/roastchance — шанс агро\n/settings — настройки\n/cleanup — очистка команд\n/help — этот список` 
        });
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!settings.enabled) return;
    if (message.content.startsWith('/')) return;
    
    const channelId = message.channel.id;
    let workerUrl;
    
    if (channelId === ROAST_CHANNEL) {
        if (Math.random() * 100 > settings.roastChance) return;
        workerUrl = ROAST_WORKER;
    } else if (channelId === HELPER_CHANNEL) {
        workerUrl = HELPER_WORKER;
    } else {
        return;
    }
    
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
