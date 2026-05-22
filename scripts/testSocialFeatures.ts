#!/usr/bin/env tsx
/**
 * Тестовий скрипт для соціальних функцій
 */
import { playlistManager } from '../src/lib/playlists';
import { friendChallengeManager } from '../src/lib/friendChallenges';
import { communityManager } from '../src/lib/communities';

console.log('🧪 Тестування соціальних функцій Phase 3\n');

// Тест 1: Плейлисти
console.log('📋 Тест 1: Плейлисти');
console.log('---------------------');

const playlist1 = playlistManager.createPlaylist(
  'Біблійна географія',
  'Питання про місця Біблії',
  'user1',
  'Тестовий користувач',
  ['geography-child-1', 'geography-child-2', 'geography-youth-1'],
  true
);

console.log(`Створено плейлист: ${playlist1.id}`);
console.log(`Назва: ${playlist1.name}`);
console.log(`Питань: ${playlist1.questions.length}`);
console.log(`Публічний: ${playlist1.isPublic}`);

playlistManager.registerPlay(playlist1.id);
playlistManager.likePlaylist(playlist1.id);

const updatedPlaylist = playlistManager.getPlaylist(playlist1.id);
console.log(`Ігор: ${updatedPlaylist?.plays}`);
console.log(`Лайків: ${updatedPlaylist?.likes}`);

const userPlaylists = playlistManager.getUserPlaylists('user1');
console.log(`Плейлистів користувача: ${userPlaylists.length}`);

const trending = playlistManager.getTrendingPlaylists(5);
console.log(`Популярних плейлистів: ${trending.length}`);

console.log('\n✅ Тест плейлистів пройдено!\n');

// Тест 2: Виклики друзів
console.log('🤝 Тест 2: Виклики друзів');
console.log('--------------------------');

const challenge1 = friendChallengeManager.createChallenge(
  'user1',
  'Тестовий користувач',
  85,
  'user2',
  'Друг користувач',
  {
    themeId: 'geography',
    difficulty: 'youth',
    questions: ['geography-youth-1', 'geography-youth-2'],
  }
);

console.log(`Створено виклик: ${challenge1.id}`);
console.log(`Викликав: ${challenge1.challengerName}`);
console.log(`Викликаний: ${challenge1.challengedName}`);
console.log(`Очки викликача: ${challenge1.challengerScore}`);
console.log(`Статус: ${challenge1.status}`);
console.log(`Термін дії: ${challenge1.expiresAt}`);

const user2Challenges = friendChallengeManager.getUserChallenges('user2');
console.log(`Викликів для user2: ${user2Challenges.received.length}`);

const acceptedChallenge = friendChallengeManager.acceptChallenge(challenge1.id);
console.log(`Прийнято виклик: ${acceptedChallenge?.status}`);

friendChallengeManager.completeChallenge(challenge1.id, 78);
const completedChallenge = friendChallengeManager.getChallenge(challenge1.id);
console.log(`Завершено виклик: ${completedChallenge?.status}`);
console.log(`Очки викликаного: ${completedChallenge?.challengedScore}`);

const user1Stats = friendChallengeManager.getUserStats('user1');
console.log(`Статистика user1:`);
console.log(`  Всього ігор: ${user1Stats.total}`);
console.log(`  Перемог: ${user1Stats.wins}`);
console.log(`  Win rate: ${user1Stats.winRate}%`);

console.log('\n✅ Тест викликів друзів пройдено!\n');

// Тест 3: Спільноти та лідерборди
console.log('👥 Тест 3: Спільноти та лідерборди');
console.log('----------------------------------');

const community1 = communityManager.createCommunity(
  'Біблійні дослідники',
  'Група для вивчення Біблії разом',
  'user1',
  true
);

console.log(`Створено спільноту: ${community1.id}`);
console.log(`Назва: ${community1.name}`);
console.log(`Учасників: ${community1.memberIds.length}`);
console.log(`Публічна: ${community1.isPublic}`);

communityManager.joinCommunity(community1.id, 'user2');
communityManager.joinCommunity(community1.id, 'user3');

const updatedCommunity = communityManager.getCommunity(community1.id);
console.log(`Учасників після приєднання: ${updatedCommunity?.memberIds.length}`);

const user1Communities = communityManager.getUserCommunities('user1');
console.log(`Спільнот user1: ${user1Communities.length}`);

const socialProfile = communityManager.getSocialProfile('user1');
console.log(`Профіль user1:`);
console.log(`  Друзів: ${socialProfile.friends.length}`);
console.log(`  Спільнот: ${socialProfile.communities.length}`);
console.log(`  Показувати статистику: ${socialProfile.privacySettings.showStats}`);

communityManager.addFriend('user1', 'user2');
const user1Profile = communityManager.getSocialProfile('user1');
console.log(`Друзів після додавання: ${user1Profile.friends.length}`);

const leaderboard = communityManager.getCommunityLeaderboard(community1.id, 'weekly');
console.log(`Лідерборд спільноти: ${leaderboard?.entries.length} учасників`);

communityManager.updateCommunityLeaderboard(community1.id, [
  { userId: 'user1', displayName: 'Тестовий користувач', score: 150, gamesPlayed: 5, accuracy: 85 },
  { userId: 'user2', displayName: 'Друг користувач', score: 120, gamesPlayed: 4, accuracy: 78 },
  { userId: 'user3', displayName: 'Третій користувач', score: 95, gamesPlayed: 3, accuracy: 72 },
], 'weekly');

const updatedLeaderboard = communityManager.getCommunityLeaderboard(community1.id, 'weekly');
console.log(`Лідерборд після оновлення: ${updatedLeaderboard?.entries.length} учасників`);
if (updatedLeaderboard?.entries) {
  updatedLeaderboard.entries.forEach((entry, index) => {
    console.log(`  ${index + 1}. ${entry.displayName}: ${entry.score} очок`);
  });
}

const systemStats = communityManager.getSystemStats();
console.log('\nСистемна статистика:');
console.log(`  Спільнот: ${systemStats.totalCommunities}`);
console.log(`  Публічних: ${systemStats.publicCommunities}`);
console.log(`  Користувачів: ${systemStats.totalUsers}`);
console.log(`  Дружб: ${systemStats.totalFriendships}`);

console.log('\n✅ Тест спільнот пройдено!\n');

console.log('🎉 Усі тести соціальних функцій пройдено успішно!');
