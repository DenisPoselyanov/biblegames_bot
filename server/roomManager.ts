import type { Question } from '../src/types/index';
import type {
  KahootPhase,
  KahootPlayer,
  KahootQuestionView,
  KahootRoomSettings,
  KahootRoomState,
} from '../src/types/kahoot';
import { normalizeKahootSettings } from '../src/types/kahoot';
import { buildPlayerRanks } from '../src/lib/kahootRanking';
import { getKahootQuestionsByIdsSync, getKahootQuestionsSync } from '../src/data/kahootQuestions';
import { calcQuestionPoints } from './kahootScoring';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REVEAL_MS_AUTO = 5000;
const LEADERBOARD_MS_AUTO = 4000;

interface PlayerRecord extends KahootPlayer {
  socketId: string;
  answeredIndex: number | null;
  answeredAt: number | null;
  disconnectedAt?: number;
}

interface Room {
  code: string;
  hostId: string;
  hostTelegramId?: string;
  phase: KahootPhase;
  settings: KahootRoomSettings;
  players: Map<string, PlayerRecord>;
  questions: Question[];
  questionIndex: number;
  questionStartedAt: number;
  thinkStartedAt: number;
  revealTimer: ReturnType<typeof setTimeout> | null;
  questionTimer: ReturnType<typeof setTimeout> | null;
  thinkTimer: ReturnType<typeof setTimeout> | null;
  leaderboardTimer: ReturnType<typeof setTimeout> | null;
  displaySockets: Set<string>;
  sessionSaved: boolean;
}

function makeCode(existing: Set<string>): string {
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
  } while (existing.has(code));
  return code;
}

export type SessionFinishedCallback = (roomCode: string) => void;

export class RoomManager {
  private rooms = new Map<string, Room>();

  constructor(
    private emit: (code: string, state: KahootRoomState | null) => void,
    private onSessionFinished?: SessionFinishedCallback,
  ) {}

  createRoom(
    hostSocketId: string,
    hostName: string,
    rawSettings: KahootRoomSettings,
    hostTelegramId?: string,
  ): KahootRoomState {
    const code = makeCode(new Set(this.rooms.keys()));
    const settings = normalizeKahootSettings(rawSettings);

    const host: PlayerRecord = {
      id: hostSocketId,
      socketId: hostSocketId,
      name: hostName.trim() || 'Ведучий',
      score: 0,
      streak: 0,
      answeredIndex: null,
      answeredAt: null,
      isHost: true,
    };

    const room: Room = {
      code,
      hostId: hostSocketId,
      hostTelegramId,
      phase: 'lobby',
      settings,
      players: new Map([[hostSocketId, host]]),
      questions: [],
      questionIndex: -1,
      questionStartedAt: 0,
      thinkStartedAt: 0,
      revealTimer: null,
      questionTimer: null,
      thinkTimer: null,
      leaderboardTimer: null,
      displaySockets: new Set(),
      sessionSaved: false,
    };

    this.rooms.set(code, room);
    const state = this.toPublicState(room);
    this.emit(code, state);
    return state;
  }

  getRoomByCode(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getRoomBySocket(socketId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.players.has(socketId)) return room;
    }
    return undefined;
  }

  joinRoom(
    code: string,
    socketId: string,
    playerName: string,
    customField?: string,
  ): KahootRoomState {
    const room = this.getRoomByCode(code);
    if (!room) throw new Error('Кімнату не знайдено');
    if (room.phase !== 'lobby') throw new Error('Гра вже почалась');
    if (room.players.has(socketId)) return this.toPublicState(room);

    const name = playerName.trim() || 'Гравець';
    const duplicate = [...room.players.values()].some(
      (p) =>
        !p.disconnectedAt &&
        p.id !== room.hostId &&
        p.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) throw new Error('Такий нікнейм уже зайнятий');

    room.players.set(socketId, {
      id: socketId,
      socketId,
      name,
      score: 0,
      streak: 0,
      answeredIndex: null,
      answeredAt: null,
      customField: customField?.trim() || undefined,
    });

    const state = this.toPublicState(room);
    this.emit(code.toUpperCase(), state);
    return state;
  }

  rejoinRoom(code: string, socketId: string, playerName: string): KahootRoomState {
    const room = this.getRoomByCode(code);
    if (!room) throw new Error('Кімнату не знайдено');

    const name = playerName.trim();
    if (!name) throw new Error('Введіть нікнейм');

    const existing = [...room.players.values()].find(
      (p) => p.name.toLowerCase() === name.toLowerCase(),
    );
    if (!existing) throw new Error('Гравця з таким нікнеймом не знайдено в кімнаті');

    if (existing.socketId !== socketId) {
      const oldSocketId = existing.socketId;
      const wasHost = room.hostId === oldSocketId;
      room.players.delete(oldSocketId);
      existing.socketId = socketId;
      existing.id = socketId;
      existing.disconnectedAt = undefined;
      if (wasHost) {
        room.hostId = socketId;
        existing.isHost = true;
      }
      room.players.set(socketId, existing);
    } else {
      existing.disconnectedAt = undefined;
    }

    const state = this.toPublicState(room);
    this.emit(room.code, state);
    return state;
  }

  joinAsDisplay(code: string, socketId: string): KahootRoomState {
    const room = this.getRoomByCode(code);
    if (!room) throw new Error('Кімнату не знайдено');
    room.displaySockets.add(socketId);
    return this.toPublicState(room, true);
  }

  leaveDisplay(code: string, socketId: string): void {
    const room = this.getRoomByCode(code);
    room?.displaySockets.delete(socketId);
  }

  updateSettings(hostSocketId: string, settings: Partial<KahootRoomSettings>): KahootRoomState {
    const room = this.getRoomBySocket(hostSocketId);
    if (!room) throw new Error('Кімнату не знайдено');
    if (room.hostId !== hostSocketId) throw new Error('Лише ведучий може змінювати налаштування');
    if (room.phase !== 'lobby') throw new Error('Налаштування можна змінити лише в лобі');

    if (settings.themeIds) {
      room.settings.themeIds = [...new Set(settings.themeIds)].filter(Boolean);
      room.settings.questionIds = undefined;
      room.settings.playlistId = undefined;
    }
    if (settings.questionIds) {
      room.settings.questionIds = settings.questionIds.length
        ? [...new Set(settings.questionIds)].filter(Boolean)
        : undefined;
    }
    if (settings.playlistId !== undefined) {
      room.settings.playlistId = settings.playlistId || undefined;
    }
    if (settings.questionCount) {
      room.settings.questionCount = Math.min(20, Math.max(3, settings.questionCount));
    }
    if (settings.timePerQuestion) {
      room.settings.timePerQuestion = Math.min(60, Math.max(10, settings.timePerQuestion));
    }
    if (settings.difficulty) {
      room.settings.difficulty = settings.difficulty;
    }
    if (settings.flowMode) room.settings.flowMode = settings.flowMode;
    if (settings.scoringMode) room.settings.scoringMode = settings.scoringMode;
    if (settings.thinkTimeSec !== undefined) {
      room.settings.thinkTimeSec = Math.min(30, Math.max(0, settings.thinkTimeSec));
    }
    if (settings.hostParticipates !== undefined) {
      room.settings.hostParticipates = settings.hostParticipates;
    }
    if (settings.roomTitle !== undefined) {
      room.settings.roomTitle = settings.roomTitle.trim() || undefined;
    }
    if (settings.customFieldLabel !== undefined) {
      room.settings.customFieldLabel = settings.customFieldLabel.trim() || undefined;
    }

    const state = this.toPublicState(room);
    this.emit(room.code, state);
    return state;
  }

  startGame(hostSocketId: string): KahootRoomState {
    const room = this.getRoomBySocket(hostSocketId);
    if (!room) throw new Error('Кімнату не знайдено');
    if (room.hostId !== hostSocketId) throw new Error('Лише ведучий може почати гру');
    if (room.phase !== 'lobby') throw new Error('Гра вже почалась');
    if (room.players.size < 1) throw new Error('Потрібен хоча б один учасник');
    const activeCount = this.getActivePlayers(room).length;
    if (activeCount < 1) throw new Error('Потрібен хоча б один гравець (окрім ведучого)');
    if (!room.settings.questionIds?.length && room.settings.themeIds.length === 0) {
      throw new Error('Оберіть хоча б одну тему або плейлист');
    }

    const questions = room.settings.questionIds?.length
      ? getKahootQuestionsByIdsSync(room.settings.questionIds, room.settings.questionCount)
      : getKahootQuestionsSync(
          room.settings.themeIds,
          room.settings.questionCount,
          room.settings.difficulty,
        );

    if (questions.length < 3) {
      throw new Error('Недостатньо питань для обраних тем');
    }

    room.questions = questions;
    room.settings.questionCount = questions.length;
    room.sessionSaved = false;
    return this.beginQuestionRound(room);
  }

  submitAnswer(socketId: string, optionIndex: number): KahootRoomState {
    const room = this.getRoomBySocket(socketId);
    if (!room) throw new Error('Ви не в кімнаті');
    if (room.phase !== 'question') throw new Error('Зараз не час відповідати');

    const player = room.players.get(socketId);
    if (!player) throw new Error('Гравця не знайдено');
    if (!this.isActivePlayer(room, socketId)) {
      throw new Error('Ведучий не бере участі в відповідях');
    }
    if (player.answeredIndex != null) return this.toPublicState(room);

    const q = room.questions[room.questionIndex];
    if (!q) throw new Error('Питання не знайдено');
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) {
      throw new Error('Невірний варіант відповіді');
    }

    player.answeredIndex = optionIndex;
    player.answeredAt = Date.now();

    const active = this.getActivePlayers(room);
    const allAnswered = active.every((p) => p.answeredIndex != null);
    if (allAnswered) {
      return this.revealAnswers(room);
    }

    const state = this.toPublicState(room);
    this.emit(room.code, state);
    return state;
  }

  advancePhase(hostSocketId: string): KahootRoomState {
    const room = this.getRoomBySocket(hostSocketId);
    if (!room) throw new Error('Кімнату не знайдено');
    if (room.hostId !== hostSocketId) throw new Error('Лише ведучий може керувати грою');
    if (room.settings.flowMode !== 'manual') {
      throw new Error('Ручне керування вимкнено для цієї кімнати');
    }

    if (room.phase === 'reveal') {
      this.clearRevealTimer(room);
      return this.showLeaderboard(room);
    }
    if (room.phase === 'leaderboard') {
      this.clearLeaderboardTimer(room);
      return this.goNext(room);
    }
    throw new Error('Зараз не можна перейти далі');
  }

  /** Keep player in room for rejoin; only drop display sockets on disconnect. */
  handleDisconnect(socketId: string): void {
    for (const room of this.rooms.values()) {
      room.displaySockets.delete(socketId);
    }

    const room = this.getRoomBySocket(socketId);
    if (!room) return;

    const player = room.players.get(socketId);
    if (player) {
      player.disconnectedAt = Date.now();
    }
  }

  leaveRoom(socketId: string): { code: string; state: KahootRoomState | null } {
    const room = this.getRoomBySocket(socketId);
    if (!room) {
      for (const r of this.rooms.values()) {
        r.displaySockets.delete(socketId);
      }
      return { code: '', state: null };
    }

    const code = room.code;
    const wasHost = room.hostId === socketId;
    room.players.delete(socketId);

    if (room.players.size === 0 && room.displaySockets.size === 0) {
      this.destroyRoom(room);
      this.emit(code, null);
      return { code, state: null };
    }

    if (wasHost && room.players.size > 0) {
      const nextHost = room.players.values().next().value as PlayerRecord;
      room.hostId = nextHost.socketId;
      nextHost.isHost = true;
    }

    if (room.phase === 'question') {
      const active = this.getActivePlayers(room);
      if (active.length > 0 && active.every((p) => p.answeredIndex != null)) {
        const state = this.revealAnswers(room);
        return { code, state };
      }
    }

    const state = this.toPublicState(room);
    this.emit(code, state);
    return { code, state };
  }

  private isActivePlayer(room: Room, socketId: string): boolean {
    if (socketId === room.hostId && !room.settings.hostParticipates) return false;
    return room.players.has(socketId);
  }

  private getActivePlayers(room: Room): PlayerRecord[] {
    return [...room.players.values()].filter((p) => this.isActivePlayer(room, p.socketId));
  }

  private beginQuestionRound(room: Room): KahootRoomState {
    this.clearTimers(room);
    room.questionIndex += 1;

    for (const player of room.players.values()) {
      player.answeredIndex = null;
      player.answeredAt = null;
      player.lastPoints = undefined;
      player.lastCorrect = undefined;
    }

    if (room.settings.thinkTimeSec > 0) {
      room.phase = 'think';
      room.thinkStartedAt = Date.now();
      room.thinkTimer = setTimeout(() => {
        this.startQuestionPhase(room);
      }, room.settings.thinkTimeSec * 1000);

      const state = this.toPublicState(room);
      this.emit(room.code, state);
      return state;
    }

    return this.startQuestionPhase(room);
  }

  private startQuestionPhase(room: Room): KahootRoomState {
    this.clearThinkTimer(room);
    room.phase = 'question';
    room.questionStartedAt = Date.now();

    room.questionTimer = setTimeout(() => {
      this.revealAnswers(room);
    }, room.settings.timePerQuestion * 1000);

    const state = this.toPublicState(room);
    this.emit(room.code, state);
    return state;
  }

  private revealAnswers(room: Room): KahootRoomState {
    if (room.phase !== 'question' && room.phase !== 'think') {
      return this.toPublicState(room);
    }

    this.clearQuestionTimer(room);
    this.clearThinkTimer(room);
    room.phase = 'reveal';

    const q = room.questions[room.questionIndex];
    const timeLimitMs = room.settings.timePerQuestion * 1000;

    for (const player of room.players.values()) {
      if (!this.isActivePlayer(room, player.socketId)) {
        player.lastCorrect = undefined;
        player.lastPoints = undefined;
        continue;
      }

      const answered = player.answeredIndex;
      const correct = answered === q.correctIndex;
      const elapsed =
        player.answeredAt != null
          ? Math.min(timeLimitMs, player.answeredAt - room.questionStartedAt)
          : timeLimitMs;
      const streakBefore = player.streak;
      const points = calcQuestionPoints(
        room.settings.scoringMode,
        elapsed,
        timeLimitMs,
        correct,
        streakBefore,
      );

      player.lastCorrect = correct;
      player.lastPoints = points;
      if (correct) {
        player.streak += 1;
        player.score += points;
      } else {
        player.streak = 0;
      }
    }

    const state = this.toPublicState(room);
    this.emit(room.code, state);

    if (room.settings.flowMode === 'auto') {
      room.revealTimer = setTimeout(() => {
        this.showLeaderboard(room);
      }, REVEAL_MS_AUTO);
    }

    return state;
  }

  private showLeaderboard(room: Room): KahootRoomState {
    this.clearRevealTimer(room);
    room.phase = 'leaderboard';

    const state = this.toPublicState(room);
    this.emit(room.code, state);

    if (room.settings.flowMode === 'auto') {
      room.leaderboardTimer = setTimeout(() => {
        this.goNext(room);
      }, LEADERBOARD_MS_AUTO);
    }

    return state;
  }

  private goNext(room: Room): KahootRoomState {
    this.clearLeaderboardTimer(room);

    if (room.questionIndex >= room.questions.length - 1) {
      room.phase = 'finished';
      const state = this.toPublicState(room);
      this.emit(room.code, state);
      if (!room.sessionSaved) {
        room.sessionSaved = true;
        this.onSessionFinished?.(room.code);
      }
      return state;
    }

    return this.beginQuestionRound(room);
  }

  private clearQuestionTimer(room: Room) {
    if (room.questionTimer) {
      clearTimeout(room.questionTimer);
      room.questionTimer = null;
    }
  }

  private clearThinkTimer(room: Room) {
    if (room.thinkTimer) {
      clearTimeout(room.thinkTimer);
      room.thinkTimer = null;
    }
  }

  private clearRevealTimer(room: Room) {
    if (room.revealTimer) {
      clearTimeout(room.revealTimer);
      room.revealTimer = null;
    }
  }

  private clearLeaderboardTimer(room: Room) {
    if (room.leaderboardTimer) {
      clearTimeout(room.leaderboardTimer);
      room.leaderboardTimer = null;
    }
  }

  private clearTimers(room: Room) {
    this.clearQuestionTimer(room);
    this.clearThinkTimer(room);
    this.clearRevealTimer(room);
    this.clearLeaderboardTimer(room);
  }

  private destroyRoom(room: Room) {
    this.clearTimers(room);
    this.rooms.delete(room.code);
  }

  private computeAnswerCounts(room: Room): number[] {
    const counts = [0, 0, 0, 0];
    for (const player of this.getActivePlayers(room)) {
      const idx = player.answeredIndex;
      if (idx != null && idx >= 0 && idx <= 3) counts[idx] += 1;
    }
    return counts;
  }

  private toPublicState(room: Room, displayOnly = false): KahootRoomState {
    const q = room.questions[room.questionIndex];
    let question: KahootQuestionView | undefined;
    let correctIndex: number | undefined;
    let reference: string | undefined;

    const showQuestionPhases: KahootPhase[] = ['think', 'question', 'reveal', 'leaderboard'];
    if (q && showQuestionPhases.includes(room.phase)) {
      question = {
        id: q.id,
        text: q.text,
        options: q.options,
        themeId: q.themeId,
        index: room.questionIndex,
        total: room.questions.length,
      };
      if (room.phase === 'reveal' || room.phase === 'leaderboard') {
        correctIndex = q.correctIndex;
        reference = q.reference;
      }
    }

    const activePlayers = this.getActivePlayers(room);
    const answeredCount =
      room.phase === 'question'
        ? activePlayers.filter((p) => p.answeredIndex != null).length
        : 0;

    const sortedPlayers = [...room.players.values()].sort((a, b) => b.score - a.score);
    const rankable = sortedPlayers.map((p) => ({ id: p.id, score: p.score }));
    const playerRanks =
      room.phase === 'leaderboard' || room.phase === 'finished'
        ? buildPlayerRanks(rankable)
        : undefined;

    const players: KahootPlayer[] = sortedPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      streak: p.streak,
      lastPoints: p.lastPoints,
      lastCorrect: p.lastCorrect,
      rank: playerRanks?.[p.id],
      isHost: p.id === room.hostId,
    }));

    return {
      code: room.code,
      phase: room.phase,
      hostId: room.hostId,
      settings: { ...room.settings },
      players,
      question,
      questionEndsAt:
        room.phase === 'question'
          ? room.questionStartedAt + room.settings.timePerQuestion * 1000
          : undefined,
      thinkEndsAt:
        room.phase === 'think'
          ? room.thinkStartedAt + room.settings.thinkTimeSec * 1000
          : undefined,
      correctIndex,
      reference,
      answeredCount,
      totalActivePlayers: activePlayers.length,
      answerCounts:
        room.phase === 'reveal' || room.phase === 'leaderboard'
          ? this.computeAnswerCounts(room)
          : undefined,
      playerRanks,
      displayOnly: displayOnly || undefined,
    };
  }

  /** Expose room data for session persistence */
  exportSession(roomCode: string) {
    const room = this.getRoomByCode(roomCode);
    if (!room || room.phase !== 'finished') return null;

    const sorted = [...room.players.values()].sort((a, b) => b.score - a.score);
    const rankable = sorted.map((p) => ({ id: p.id, score: p.score }));

    return {
      code: room.code,
      finishedAt: new Date().toISOString(),
      hostTelegramId: room.hostTelegramId,
      settings: { ...room.settings },
      questionCount: room.questions.length,
      players: sorted.map((p) => ({
        name: p.name,
        score: p.score,
        rank: buildPlayerRanks(rankable)[p.id] ?? sorted.length,
        customField: p.customField,
      })),
    };
  }
}
