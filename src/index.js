const fs = require('fs');
const path = require('path');
const { Client, Events, REST, Routes, SlashCommandBuilder, GatewayIntentBits } = require('discord.js');
const { token, clientId, guildId, channelId } = require('./config.json');
const ACHIEVEMENTS = require('./achievements.js');

const COOLDOWN_TIME = 3600000;
const COOLDOWN_DB_PATH = path.resolve(__dirname, "./cooldowns.json");

let cooldowns = {};
if (fs.existsSync(COOLDOWN_DB_PATH)) {
    try {
        const data = fs.readFileSync(COOLDOWN_DB_PATH, 'utf-8');
        cooldowns = JSON.parse(data);
    } catch (err) {
        console.error('Error reading cooldowns.json, starting with empty cooldowns.', err);
        cooldowns = {};
    }
}

function saveCooldowns() {
    try {
        fs.writeFileSync(COOLDOWN_DB_PATH, JSON.stringify(cooldowns, null, 2), 'utf-8');
    } catch (err) {
        console.error('Error writing cooldowns.json', err);
    }
}

const commands = [
    new SlashCommandBuilder()
        .setName('комару')
        .setDescription('Отправит карточку')
        .toJSON(),
    new SlashCommandBuilder()
        .setName('сброс')
        .setDescription('Сбросить весь прогресс')
        .toJSON(),
    new SlashCommandBuilder()
        .setName('информация')
        .setDescription('Показать информацию о распределении карточек')
        .toJSON(),
    new SlashCommandBuilder()
        .setName('топ')
        .setDescription('Показать топ игроков по количеству карточек и монет')
        .toJSON(),
    new SlashCommandBuilder()
        .setName('команды')
        .setDescription('Показать список всех доступных команд')
        .toJSON(),
    new SlashCommandBuilder()
        .setName('достижения')
        .setDescription('Показать достижения')
        .addUserOption(option =>
            option.setName('пользователь')
                .setDescription('Пользователь, чьи достижения вы хотите посмотреть')
                .setRequired(false))
        .toJSON(),
    new SlashCommandBuilder()
        .setName('коллекция')
        .setDescription('Показать вашу коллекцию карточек')
        .toJSON()
];

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    console.log('Started refreshing application (/) commands.');

    try {
        await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands }
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error(error);
    }
})();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once(Events.ClientReady, async readyClient => {
    console.log(`Ready! Card bot Logged in as ${readyClient.user.tag}`);

    client.user.setActivity('KBRP.ru', { type: 'PLAYING' });

    const channel = await client.channels.fetch(channelId).catch(console.error);

    if (!channel) {
        console.error(`Channel with ID ${channelId} not found!`);
        return;
    }

    setInterval(() => {
        channel.send('## 🎴 Время собирать карточки!\n\n' +
                    '### ✨ Новая карточка ждет тебя!\n' +
                    '└ Используй команду `/комару` чтобы получить её\n\n' +
                    '### 💫 Что ты можешь получить?\n' +
                    '└ 🟢 Обычные карточки\n' +
                    '└ 🟣 Необычные карточки\n' +
                    '└ 🔵 Редкие карточки\n' +
                    '└ 🟠 Эпические карточки\n' +
                    '└ 🟡 Легендарные карточки\n\n' +
                    '### ⚡️ Не упусти свой шанс!');
    }, 3600000); 

});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'информация') {
        await interaction.reply({
            content: `## 📊 Распределение карточек по редкости\n\n` +
                    `🟢 **Обычные**: ~40% карточек\n` +
                    `🟣 **Необычные**: ~25% карточек\n` +
                    `🟣 **Редкие**: ~15% карточек\n` +
                    `🟠 **Эпические**: ~10% карточек\n` +
                    `🟡 **Легендарные**: ~10% карточек`
        });
        return;
    }

    if (interaction.commandName === 'сброс') {
        const userId = interaction.user.id;
        
        // Load storage data
        let storage = {};
        if (fs.existsSync(path.resolve(__dirname, './storage.json'))) {
            try {
                const data = fs.readFileSync(path.resolve(__dirname, './storage.json'), 'utf-8');
                storage = JSON.parse(data);
            } catch (err) {
                console.error('Error reading storage.json', err);
                storage = {};
            }
        }

        // Reset user's data
        storage[userId] = {
            cardsUnlockedCount: "0",
            coins: "0",
            unlockedCards: {}
        };

        // Save updated storage
        try {
            fs.writeFileSync(path.resolve(__dirname, './storage.json'), JSON.stringify(storage, null, 2), 'utf-8');
            await interaction.reply({
                content: '✅ Ваш прогресс успешно сброшен!'
            });
        } catch (err) {
            console.error('Error writing storage.json', err);
            await interaction.reply({
                content: '❌ Произошла ошибка при сбросе прогресса.'
            });
        }
        return;
    }

    if (interaction.commandName === 'комару') {
        const userId = interaction.user.id;
        const username = interaction.user.username;
        const now = Date.now();

        if (cooldowns[userId]) {
            const elapsed = now - cooldowns[userId];
            if (elapsed < COOLDOWN_TIME) {
                const remainingMs = COOLDOWN_TIME - elapsed;
                const remainingMinutes = Math.floor(remainingMs / 60000);
                const remainingSeconds = Math.floor((remainingMs % 60000) / 1000);
                await interaction.reply({
                    content: `Вы искали, но Комару не оказалось рядом 👻. \n Попробуйте через ${remainingMinutes} минут и ${remainingSeconds} секунд.`
                });
                return;
            }
        }

        cooldowns[userId] = now;
        saveCooldowns();

        // Load storage data
        let storage = {};
        if (fs.existsSync(path.resolve(__dirname, './storage.json'))) {
            try {
                const data = fs.readFileSync(path.resolve(__dirname, './storage.json'), 'utf-8');
                storage = JSON.parse(data);
            } catch (err) {
                console.error('Error reading storage.json', err);
                storage = {};
            }
        }

        // Initialize user storage if doesn't exist
        if (!storage[userId]) {
            storage[userId] = {
                cardsUnlockedCount: "0",
                coins: "0",
                unlockedCards: {}
            };
        }

        const cards = require('./cards.json');
        const cardNames = Object.keys(cards);
        
        // Filter out cards that user already has
        const availableCards = cardNames.filter(cardName => !storage[userId].unlockedCards[cardName]);
        
        // If user has all cards, reset available cards
        const randomCard = availableCards.length > 0 
            ? availableCards[Math.floor(Math.random() * availableCards.length)]
            : cardNames[Math.floor(Math.random() * cardNames.length)];

        const cardPath = cards[randomCard].image_path;
        const cardRarity = cards[randomCard].rare;
        const cardCoins = parseInt(cards[randomCard].coins);

        // Update user's storage
        storage[userId].unlockedCards[randomCard] = true;
        storage[userId].cardsUnlockedCount = (parseInt(storage[userId].cardsUnlockedCount) + 1).toString();
        storage[userId].coins = (parseInt(storage[userId].coins) + cardCoins).toString();

        // Save updated storage
        try {
            fs.writeFileSync(path.resolve(__dirname, './storage.json'), JSON.stringify(storage, null, 2), 'utf-8');
        } catch (err) {
            console.error('Error writing storage.json', err);
        }

        // Create a more beautiful card opening message
        const rarityEmojis = {
            common: '🟢',
            uncommon: '🟣',
            rare: '🔵',
            epic: '🟠',
            legendary: '🟡'
        };

        const rarityColors = {
            common: '#2ecc71',    // Green
            uncommon: '#9b59b6',  // Purple
            rare: '#3498db',      // Blue
            epic: '#e67e22',      // Orange
            legendary: '#f1c40f'  // Yellow
        };

        const rarityNames = {
            common: 'Обычная',
            uncommon: 'Необычная',
            rare: 'Редкая',
            epic: 'Эпическая',
            legendary: 'Легендарная'
        };

        const cardMessage = `## 🎴 Новая карточка!

### ${rarityEmojis[cardRarity]} ${randomCard}
└ ${rarityNames[cardRarity]}

### 💰 Награда
└ Получено монет: ${cardCoins}
└ Всего монет: ${storage[userId].coins}

### 📊 Статистика
└ Всего карточек: ${storage[userId].cardsUnlockedCount}`;

        await interaction.reply({
            content: cardMessage,
            files: [path.resolve(__dirname, cardPath)]
        });

        // Update achievement notification to only show new achievements
        const newAchievements = checkAchievements(userId, storage, cardRarity);
        if (newAchievements.length > 0) {
            let achievementMessage = '## 🎉 Новые достижения!\n\n';
            newAchievements.forEach(achievement => {
                achievementMessage += `${achievement.icon} **${achievement.name}**\n`;
                achievementMessage += `└ ${achievement.description}\n\n`;
            });
            
            await interaction.followUp({
                content: achievementMessage
            });
        }
    }

    if (interaction.commandName === 'топ') {
        // Загружаем данные хранилища
        let storage = {};
        if (fs.existsSync(path.resolve(__dirname, './storage.json'))) {
            try {
                const data = fs.readFileSync(path.resolve(__dirname, './storage.json'), 'utf-8');
                storage = JSON.parse(data);
            } catch (err) {
                console.error('Error reading storage.json', err);
                await interaction.reply({
                    content: '❌ Произошла ошибка при загрузке данных.'
                });
                return;
            }
        }

        // Создаем массив игроков для сортировки
        const players = Object.entries(storage).map(([userId, data]) => ({
            userId,
            cardsCount: parseInt(data.cardsUnlockedCount),
            coins: parseInt(data.coins)
        }));

        // Сортируем по количеству карточек
        const topByCards = [...players].sort((a, b) => b.cardsCount - a.cardsCount).slice(0, 10);
        // Сортируем по количеству монет
        const topByCoins = [...players].sort((a, b) => b.coins - a.coins).slice(0, 10);

        // Формируем сообщение
        let message = '## 🏆 Топ игроков\n\n';
        
        message += '### 👑 Топ по количеству карточек:\n';
        for (const [index, player] of topByCards.entries()) {
            let user = client.users.cache.get(player.userId);
            if (!user) {
                try {
                    user = await client.users.fetch(player.userId);
                } catch (err) {
                    console.error(`Error fetching user ${player.userId}:`, err);
                }
            }
            const username = user ? user.username : 'Неизвестный игрок';
            message += `${index + 1}. ${username} - ${player.cardsCount} карточек\n`;
        }

        message += '\n### 💰 Топ по количеству монет:\n';
        for (const [index, player] of topByCoins.entries()) {
            let user = client.users.cache.get(player.userId);
            if (!user) {
                try {
                    user = await client.users.fetch(player.userId);
                } catch (err) {
                    console.error(`Error fetching user ${player.userId}:`, err);
                }
            }
            const username = user ? user.username : 'Неизвестный игрок';
            message += `${index + 1}. ${username} - ${player.coins} монет\n`;
        }

        await interaction.reply({
            content: message
        });
        return;
    }

    if (interaction.commandName === 'команды') {
        const commandsList = `
## 📋 Список доступных команд

### 🎴 Основные команды
\`/комару\` - Получить случайную карточку
\`/коллекция\` - Показать вашу коллекцию карточек
\`/информация\` - Показать информацию о распределении карточек
\`/топ\` - Показать топ игроков по количеству карточек и монет
\`/достижения\` - Показать ваши достижения

### ⚙️ Управление
\`/сброс\` - Сбросить весь прогресс
\`/команды\` - Показать этот список команд

### ℹ️ Информация
• Кулдаун между запросами карточек: 1 час
• Карточки имеют разную редкость: Обычные, Необычные, Редкие, Эпические и Легендарные
• За каждую карточку вы получаете монеты, количество зависит от редкости
`;

        await interaction.reply({
            content: commandsList
        });
        return;
    }

    if (interaction.commandName === 'достижения') {
        const targetUser = interaction.options.getUser('пользователь') || interaction.user;
        const userId = targetUser.id;
        let storage = {};
        
        if (fs.existsSync(path.resolve(__dirname, './storage.json'))) {
            try {
                const data = fs.readFileSync(path.resolve(__dirname, './storage.json'), 'utf-8');
                storage = JSON.parse(data);
            } catch (err) {
                console.error('Error reading storage.json', err);
                await interaction.reply({
                    content: '❌ Произошла ошибка при загрузке данных.'
                });
                return;
            }
        }

        if (!storage[userId] || !storage[userId].achievements) {
            await interaction.reply({
                content: targetUser.id === interaction.user.id 
                    ? 'У вас пока нет достижений. Продолжайте собирать карточки!'
                    : `У пользователя ${targetUser.username} пока нет достижений.`
            });
            return;
        }

        const userAchievements = storage[userId].achievements;
        let message = `## 🏆 Достижения ${targetUser.username}\n\n`;
        
        Object.entries(ACHIEVEMENTS).forEach(([id, achievement]) => {
            const isUnlocked = userAchievements[id] || false;
            message += `${isUnlocked ? '✅' : '❌'} ${achievement.icon} **${achievement.name}**\n`;
            message += `└ ${achievement.description}\n\n`;
        });

        const totalAchievements = Object.keys(ACHIEVEMENTS).length;
        const unlockedAchievements = Object.values(userAchievements).filter(Boolean).length;
        message += `\n**Прогресс:** ${unlockedAchievements}/${totalAchievements} достижений`;

        await interaction.reply({
            content: message
        });
        return;
    }

    if (interaction.commandName === 'коллекция') {
        const userId = interaction.user.id;
        let storage = {};
        
        if (fs.existsSync(path.resolve(__dirname, './storage.json'))) {
            try {
                const data = fs.readFileSync(path.resolve(__dirname, './storage.json'), 'utf-8');
                storage = JSON.parse(data);
            } catch (err) {
                console.error('Error reading storage.json', err);
                await interaction.reply({
                    content: '❌ Произошла ошибка при загрузке данных.'
                });
                return;
            }
        }

        if (!storage[userId] || !storage[userId].unlockedCards) {
            await interaction.reply({
                content: 'У вас пока нет карточек в коллекции. Используйте команду /комару чтобы начать собирать!'
            });
            return;
        }

        const cards = require('./cards.json');
        const userCards = storage[userId].unlockedCards;
        
        // Группируем карточки по редкости
        const cardsByRarity = {
            common: [],
            uncommon: [],
            rare: [],
            epic: [],
            legendary: []
        };

        Object.entries(userCards).forEach(([cardName, isUnlocked]) => {
            if (isUnlocked && cards[cardName]) {
                const card = cards[cardName];
                cardsByRarity[card.rare].push({
                    name: cardName,
                    image: card.image_path,
                    coins: card.coins
                });
            }
        });

        // Формируем сообщение
        let message = '## 🎴 Ваша коллекция карточек\n\n';
        
        // Добавляем статистику
        const totalCards = Object.values(cardsByRarity).reduce((sum, arr) => sum + arr.length, 0);
        message += `**Всего карточек:** ${totalCards}\n\n`;

        // Добавляем карточки по редкости
        const rarityNames = {
            common: '🟢 Обычные',
            uncommon: '🟣 Необычные',
            rare: '🔵 Редкие',
            epic: '🟠 Эпические',
            legendary: '🟡 Легендарные'
        };

        Object.entries(cardsByRarity).forEach(([rarity, cards]) => {
            if (cards.length > 0) {
                message += `### ${rarityNames[rarity]} (${cards.length})\n`;
                cards.forEach(card => {
                    message += `• **${card.name}** - ${card.coins} монет\n`;
                });
                message += '\n';
            }
        });

        // Добавляем прогресс коллекции
        const totalPossibleCards = Object.keys(cards).length;
        const completionPercentage = Math.round((totalCards / totalPossibleCards) * 100);
        message += `\n**Прогресс коллекции:** ${completionPercentage}% (${totalCards}/${totalPossibleCards})`;

        await interaction.reply({
            content: message
        });
        return;
    }
});

function checkAchievements(userId, storage, cardRarity) {
    if (!storage[userId].achievements) {
        storage[userId].achievements = {};
    }

    const userData = storage[userId];
    const achievements = userData.achievements;
    const newAchievements = [];
    const cards = require('./cards.json');

    // Helper function to check and add new achievement
    const checkAndAddAchievement = (achievementId, condition) => {
        if (!achievements[achievementId] && condition) {
            achievements[achievementId] = true;
            newAchievements.push(ACHIEVEMENTS[achievementId]);
        }
    };

    // Count cards by rarity
    const rarityCounts = {
        common: 0,
        uncommon: 0,
        rare: 0,
        epic: 0,
        legendary: 0
    };

    Object.entries(userData.unlockedCards).forEach(([cardName, isUnlocked]) => {
        if (isUnlocked) {
            const card = require('./cards.json')[cardName];
            if (card && card.rare) {
                rarityCounts[card.rare]++;
            }
        }
    });

    // Check achievements
    checkAndAddAchievement('firstCard', parseInt(userData.cardsUnlockedCount) > 0);
    checkAndAddAchievement('cardCollector', parseInt(userData.cardsUnlockedCount) >= 10);
    checkAndAddAchievement('cardMaster', parseInt(userData.cardsUnlockedCount) >= 50);
    checkAndAddAchievement('legendaryCard', cardRarity === 'legendary');
    checkAndAddAchievement('epicCollector', rarityCounts.epic >= 5);
    checkAndAddAchievement('rareCollector', rarityCounts.rare >= 10);
    checkAndAddAchievement('coinCollector', parseInt(userData.coins) >= 1000);
    checkAndAddAchievement('coinMaster', parseInt(userData.coins) >= 5000);
    checkAndAddAchievement('commonCollector', rarityCounts.common >= 20);
    checkAndAddAchievement('uncommonCollector', rarityCounts.uncommon >= 15);
    checkAndAddAchievement('firstEpic', cardRarity === 'epic');
    checkAndAddAchievement('firstRare', cardRarity === 'rare');
    checkAndAddAchievement('firstUncommon', cardRarity === 'uncommon');
    checkAndAddAchievement('legendaryMaster', rarityCounts.legendary >= 3);
    checkAndAddAchievement('epicMaster', rarityCounts.epic >= 10);
    checkAndAddAchievement('rareMaster', rarityCounts.rare >= 20);
    checkAndAddAchievement('coinLegend', parseInt(userData.coins) >= 10000);
    checkAndAddAchievement('collectionMaster', parseInt(userData.cardsUnlockedCount) >= 100);
    checkAndAddAchievement('cardEnthusiast', parseInt(userData.cardsUnlockedCount) >= 3);
    checkAndAddAchievement('cardAddict', parseInt(userData.cardsUnlockedCount) >= 14);
    checkAndAddAchievement('cardLegend', parseInt(userData.cardsUnlockedCount) >= 100);
    checkAndAddAchievement('coinMillionaire', parseInt(userData.coins) >= 100000);
    checkAndAddAchievement('coinBillionaire', parseInt(userData.coins) >= 1000000);
    checkAndAddAchievement('cardArchivist', parseInt(userData.cardsUnlockedCount) >= 200);
    checkAndAddAchievement('cardHistorian', parseInt(userData.cardsUnlockedCount) >= 500);
    checkAndAddAchievement('cardMythologist', parseInt(userData.cardsUnlockedCount) >= 1000);

    // Check for cardPerfectionist achievement
    const allCardsOfRarity = {};
    Object.entries(userData.unlockedCards).forEach(([cardName, isUnlocked]) => {
        if (isUnlocked) {
            const card = require('./cards.json')[cardName];
            if (card && card.rare) {
                allCardsOfRarity[card.rare] = (allCardsOfRarity[card.rare] || 0) + 1;
            }
        }
    });

    // Check if user has all cards of any rarity
    const rarityTotals = {};
    Object.values(cards).forEach(card => {
        if (card.rare) {
            rarityTotals[card.rare] = (rarityTotals[card.rare] || 0) + 1;
        }
    });

    Object.entries(allCardsOfRarity).forEach(([rarity, count]) => {
        if (count === rarityTotals[rarity]) {
            checkAndAddAchievement('cardPerfectionist', true);
        }
    });

    // Check for cardGod achievement
    const totalCards = Object.keys(cards).length;
    checkAndAddAchievement('cardGod', parseInt(userData.cardsUnlockedCount) === totalCards);

    // Save storage if there are new achievements
    if (newAchievements.length > 0) {
        try {
            fs.writeFileSync(path.resolve(__dirname, './storage.json'), JSON.stringify(storage, null, 2), 'utf-8');
        } catch (err) {
            console.error('Error saving achievements to storage.json', err);
        }
    }

    return newAchievements;
}

client.login(token);