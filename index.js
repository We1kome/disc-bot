import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import fs from 'fs';

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

let settings = { enabled: true, roastChance: 15 };

try {
    if (fs.existsSync('./settings.json')) {
        settings = JSON.parse(fs.readFileSync('./settings.json', 'utf8'));
        console.log('📂 Настройки загружены:', settings);
    }
} catch (e) {}

function saveSettings() {
    fs.writeFileSync('./settings.json', JSON.stringify(settings, null, 2));
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const commands = [
    new SlashCommandBuilder()
        .setName('toggle')
        .setDescription('Вкл/выкл бота')
        .addStringOption(o => o.setName('state').setDescription('Состояние').setRequired(true)
            .addChoices({ name: 'Включить', value: 'on' }, { name: 'Выключить', value: 'off' })),
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
        .setDescription('Очистить старые команды'),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Список команд')
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(TOKEN);

client.on('ready', async () => {
    console.log('✅ Бот запущен:', client.user.tag);
    console.log('⚙️ Настройки:', settings);
    try {
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
        console.log('✅ Команды зарегистрированы');
    } catch (e) {
        console.error('❌ Ошибка:', e.message);
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.user.id !== OWNER_ID) {
        return interaction.reply({ content: 'Нет прав', flags: 64 });
    }
    
    const { commandName } = interaction;
    
    if (commandName === 'cleanup') {
        await interaction.deferReply({ flags: 64 });
        try {
            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
            await new Promise(r => setTimeout(r, 2000));
            await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
            return interaction.editReply({ content: '✅ Очищено!' });
        } catch (e) {
            return interaction.editReply({ content: '❌ Ошибка' });
        }
    }
    
    await interaction.deferReply({ flags: 64 });
    
    if (commandName === 'toggle') {
        settings.enabled = interaction.options.getString('state') === 'on';
        saveSettings();
        return interaction.editReply({ content: settings.enabled ? '✅ Включен' : '❌ Выключен' });
    }
    
    if (commandName === 'roastchance') {
        settings.roastChance = interaction.options.getInteger('percent');
        saveSettings();
        return interaction.editReply({ content: `✅ Шанс агро: ${settings.roastChance}%` });
    }
    
    if (commandName === 'settings') {
        return interaction.editReply({ content: `⚙️ Вкл: ${settings.enabled}\nШанс агро: ${settings.roastChance}%` });
    }
    
    if (commandName === 'help') {
        return interaction.editReply({ content: '/toggle /roastchance /settings /cleanup /help' });
    }
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!settings.enabled) return;
    if (message.content.startsWith('/')) return;
    
    const channelId = message.channel.id;
    
    let workerUrl;
    
    if (channelId === ROAST_CHANNEL) {
        const roll = Math.random() * 100;
        console.log(`🎲 Шанс ${settings.roastChance}%, выпало ${roll.toFixed(1)}%`);
        if (roll > settings.roastChance) return;
        workerUrl = ROAST_WORKER;
    } else if (channelId === HELPER_CHANNEL) {
        workerUrl = HELPER_WORKER;
    } else {
        return;
    }
    
    try {
        const messages = await message.channel.messages.fetch({ limit: 3 });
        const context = [];
        messages.reverse().forEach(msg => {
            // Пропускаем сообщения ботов (включая нашего)
            if (msg.author.bot) return;
            if (!msg.content.startsWith('/') && !msg.content.includes(';')) {
                let ctx = msg.author.username + ': ';
                ctx += msg.content || (msg.attachments.size > 0 ? '[фото/файл]' : '');
                context.push({ author: msg.author.username, content: ctx });
            }
        });
        
        let sendMessage = message.content || (message.attachments.size > 0 ? '[фото]' : '');
        
        console.log(`📤 Отправляю в Worker: "${sendMessage}"`);
        console.log(`📋 Контекст: ${context.length} сообщения`);
        
        const response = await fetch(workerUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: sendMessage,
                context: context,
                currentAuthor: message.author.username
            })
        });
        
        console.log(`📡 Статус: ${response.status}`);
        
        const data = await response.json();
        
        if (data.reply) {
            let replyText = data.reply;
            if (replyText.length > 500) replyText = replyText.substring(0, 497) + "...";
            await message.reply(replyText);
            console.log('✅ Отправлено');
        } else {
            console.log('🔇 Пустой ответ');
        }
    } catch (err) {
        console.error('❌ Ошибка:', err.message);
    }
});

client.login(TOKEN);
