import { REST, Routes } from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || "1498208678723977216";

const rest = new REST({ version: '10' }).setToken(TOKEN);

console.log('🗑 Удаляю ВСЕ команды...');

// Удаляем глобальные
await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
console.log('✅ Глобальные удалены');

// Удаляем команды для каждого сервера (на всякий случай)
const guilds = ['857600197809668159', '1498239736320622684'];
for (const guildId of guilds) {
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: [] });
        console.log(`✅ Сервер ${guildId} очищен`);
    } catch (e) {
        console.log(`⚠️ Сервер ${guildId}: ${e.message}`);
    }
}

console.log('✅ Всё чисто! Можно возвращать основной код.');
process.exit(0);
