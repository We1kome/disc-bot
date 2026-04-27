import { REST, Routes } from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || "1498208678723977216";

const rest = new REST({ version: '10' }).setToken(TOKEN);

// Удаляем ВСЕ старые команды
try {
    console.log('🗑 Удаление старых команд...');
    
    // Удаляем глобальные команды
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
    console.log('✅ Глобальные команды удалены');
    
} catch (error) {
    console.error('Ошибка:', error.message);
}
