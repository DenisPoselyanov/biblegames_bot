import type { Question } from '../src/types/index';
import type {
  KahootPhase,
  KahootPlayer,
  KahootQuestionView,
  KahootRoomSettings,
  KahootRoomState,
} from '../src/types/kahoot';
import { getKahootQuestionsByIdsSync, getKahootQuestionsSync } from '../src/data/kahootQuestions';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REVEAL_MS = 5000;

interface PlayerRecord extends KahootPlayer {
  socketId: string;
  answeredIndex: number | null;
}

interface Room {
  code: string;
  hostId: string;
  phase: KahootPhase;
  settings: KahootRoomSettings;
  players: Map<string, PlayerRecord>;
  questions: Question[];
  questionIndex: number;
  questionStartedAt: number;
  revealTimer: ReturnType<typeof setTimeout> | null;
  questionTimer: ReturnType<typeof setTimeout> | null;
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

function calcPoints(elapsedMs: number, timeLimitMs: number, correct: boolean): number {
  if (!correct) return 0;
  const ratio = Math.max(0, Math.min(1, 1 - elapsedMs / timeLimitMs));
  return Math.max(200, Math.round(800 + 1200 * ratio));
}

export class RoomManager {
  private rooms = new Map<string, Room>();

  constructor(private emit: (code: string, state: KahootRoomState | null) => void) {}

  createRoom(hostSocketId: string, hostName: string, settings: KahootRoomSettings): KahootRoomState {
    const code = makeCode(new Set(this.rooms.keys()));
    const host: PlayerRecord = {
      id: hostSocketId,
      socketId: hostSocketId,
      name: hostName.trim() || 'Ведучий',
      score: 0,
      streak: 0,
      answeredIndex: null,
    };

    const room: Room = {
      code,
      hostId: hostSocketId,
      phase: 'lobby',
      settings: {
        ...settings,
        themeIds: [...new Set(settings.themeIds)],
        questionIds: settings.questionIds?.length ? [...new Set(settings.questionIds)] : undefined,
      },
      players: new Map([[hostSocketId, host]]),
      questions: [],
      questionIndex: -1,
      questionStartedAt: 0,
      revealTimer: null,
      questionTimer: null,
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

  joinRoom(code: string, socketId: string, playerName: string): KahootRoomState {
    const room = this.getRoomByCode(code);
    if (!room) throw new Error('Кімнату не знайдено');
    if (room.phase !== 'lobby') throw new Error('Гра вже почалась');
    if (room.players.has(socketId)) return this.toPublicState(room);

    const name = playerName.trim() || 'Гравець';
    const duplicate = [...room.players.values()].some(
      (p) => p.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicate) throw new Error('Такий нікнейм уже зайнятий');

    room.players.set(socketId, {
      id: socketId,
      socketId,
      name,
      score: 0,
      streak: 0,
      answeredIndex: null,
    });

    const state = this.toPublicState(room);
    this.emit(code.toUpperCase(), state);
    return state;
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

    const state = this.toPublicState(room);
    this.emit(room.code, state);
    return state;
  }

  startGame(hostSocketId: string): KahootRoomState {
    const room = this.getRoomBySocket(hostSocketId);
    if (!room) throw new Error('Кімнату не знайдено');
    if (room.hostId !== hostSocketId) throw new Error('Лише ведучий може почати гру');
    if (room.phase !== 'lobby') throw new Error('Гра вже почалась');
    if (room.players.size < 1) throw new Error('Потрібен хоча б один гравець');
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
    return this.beginQuestion(room);
  }

  submitAnswer(socketId: string, optionIndex: number): KahootRoomState {
    const room = this.getRoomBySocket(socketId);
    if (!room) throw new Error('Ви не в кімнаті');
    if (room.phase !== 'question') throw new Error('Зараз не час відповідати');

    const player = room.players.get(socketId);
    if (!player) throw new Error('Гравця не знайдено');
    if (player.answeredIndex != null) return this.toPublicState(room);

    player.answeredIndex = optionIndex;

    const allAnswered = [...room.players.values()].every((p) => p.answeredIndex != null);
    if (allAnswered) {
      return this.revealAnswers(room);
    }

    const state = this.toPublicState(room);
    this.emit(room.code, state);
    return state;
  }

  leaveRoom(socketId: string): { code: string; state: KahootRoomState | null } {
    const room = this.getRoomBySocket(socketId);
    if (!room) return { code: '', state: null };

    const code = room.code;
    const wasHost = room.hostId === socketId;
    room.players.delete(socketId);

    if (room.players.size === 0) {
      this.destroyRoom(room);
      this.emit(code, null);
      return { code, state: null };
    }

    if (wasHost) {
      const nextHost = room.players.values().next().value as PlayerRecord;
      room.hostId = nextHost.socketId;
    }

    if (room.phase === 'question') {
      const allAnswered = [...room.players.values()].every((p) => p.answeredIndex != null);
      if (allAnswered) {
        const state = this.revealAnswers(room);
        return { code, state };
      }
    }

    const state = this.toPublicState(room);
    this.emit(code, state);
    return { code, state };
  }

  private beginQuestion(room: Room): KahootRoomState {
    this.clearTimers(room);
    room.questionIndex += 1;
    room.phase = 'question';
    room.questionStartedAt = Date.now();

    for (const player of room.players.values()) {
      player.answeredIndex = null;
      player.lastPoints = undefined;
      player.lastCorrect = undefined;
    }

    room.questionTimer = setTimeout(() => {
      this.revealAnswers(room);
    }, room.settings.timePerQuestion * 1000);

    const state = this.toPublicState(room);
    this.emit(room.code, state);
    return state;
  }

  private revealAnswers(room: Room): KahootRoomState {
    if (room.phase !== 'question') return this.toPublicState(room);

    this.clearQuestionTimer(room);
    room.phase = 'reveal';

    const q = room.questions[room.questionIndex];
    const timeLimitMs = room.settings.timePerQuestion * 1000;

    for (const player of room.players.values()) {
      const answered = player.answeredIndex;
      const correct = answered === q.correctIndex;
      const elapsed =
        answered != null ? Math.min(timeLimitMs, Date.now() - room.questionStartedAt) : timeLimitMs;
      const points = calcPoints(elapsed, timeLimitMs, correct);

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

    room.revealTimer = setTimeout(() => {
      this.goNext(room);
    }, REVEAL_MS);

    return state;
  }

  private goNext(room: Room) {
    if (room.questionIndex >= room.questions.length - 1) {
      room.phase = 'finished';
      const state = this.toPublicState(room);
      this.emit(room.code, state);
      return;
    }
    this.beginQuestion(room);
  }

  private clearQuestionTimer(room: Room) {
    if (room.questionTimer) {
      clearTimeout(room.questionTimer);
      room.questionTimer = null;
    }
  }

  private clearTimers(room: Room) {
    this.clearQuestionTimer(room);
    if (room.revealTimer) {
      clearTimeout(room.revealTimer);
      room.revealTimer = null;
    }
  }

  private destroyRoom(room: Room) {
    this.clearTimers(room);
    this.rooms.delete(room.code);
  }

  private toPublicState(room: Room): KahootRoomState {
    const q = room.questions[room.questionIndex];
    let question: KahootQuestionView | undefined;
    let correctIndex: number | undefined;
    let reference: string | undefined;

    if (q && room.phase !== 'lobby' && room.phase !== 'finished') {
      question = {
        id: q.id,
        text: q.text,
        options: q.options,
        themeId: q.themeId,
        index: room.questionIndex,
        total: room.questions.length,
      };
      if (room.phase === 'reveal') {
        correctIndex = q.correctIndex;
        reference = q.reference;
      }
    }

    const answeredCount =
      room.phase === 'question'
        ? [...room.players.values()].filter((p) => p.answeredIndex != null).length
        : 0;

    return {
      code: room.code,
      phase: room.phase,
      hostId: room.hostId,
      settings: { ...room.settings },
      players: [...room.players.values()]
        .sort((a, b) => b.score - a.score)
        .map((p) => ({
          id: p.id,
          name: p.name,
          score: p.score,
          streak: p.streak,
          lastPoints: p.lastPoints,
          lastCorrect: p.lastCorrect,
        })),
      question,
      questionEndsAt:
        room.phase === 'question'
          ? room.questionStartedAt + room.settings.timePerQuestion * 1000
          : undefined,
      correctIndex,
      reference,
      answeredCount,
    };
  }
}
