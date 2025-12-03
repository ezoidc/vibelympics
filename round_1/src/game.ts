import { formatEmojiTime, shuffle, toEmojiNumber } from './index';

declare global {
  interface Window {
    secretSolvePuzzle?: () => Promise<void>;
  }
}

type DifficultyKey = 'chill' | 'zest' | 'inferno';

type CardState = 'idle' | 'flipped' | 'matched';

type DifficultyConfig = {
  key: DifficultyKey;
  emoji: string;
  pairs: number;
  cols: number;
  cardAura: string;
  pool: string[];
};

const difficulties: Record<DifficultyKey, DifficultyConfig> = {
  chill: {
    key: 'chill',
    emoji: '🙂',
    pairs: 6,
    cols: 4,
    cardAura: 'from-yellow-200/50 via-amber-200/40 to-orange-200/40',
    pool: ['🍉', '🍋', '🍇', '🍊', '🍓', '🍍', '🥝', '🍒', '🍑', '🍈']
  },
  zest: {
    key: 'zest',
    emoji: '🥶',
    pairs: 8,
    cols: 4,
    cardAura: 'from-orange-400/40 via-amber-500/35 to-rose-400/30',
    pool: ['💎', '🔷', '🔹', '🔵', '🌀', '💠', '🔮', '🪬', '🔭', '🧿']
  },
  inferno: {
    key: 'inferno',
    emoji: '💀',
    pairs: 12,
    cols: 6,
    cardAura: 'from-rose-700/40 via-red-700/35 to-fuchsia-700/30',
    pool: ['🔵', '🔹', '🔘', '⚫️', '⚪️', '🔴', '🟠', '🟡', '🟢', '🟣', '🔷', '🔶', '🟦', '🟥', '🟧', '🟪', '🔳', '🔲', '◼️', '◻️', '▪️', '▫️', '◽️', '◾️']
  }
};

type GameState = {
  difficulty: DifficultyKey;
  deck: string[];
  matched: number[];
  moves: number;
  elapsedMs: number;
  runningSince: number | null;
  bestTimes: Partial<Record<DifficultyKey, number>>;
  flipped: number[];
  locked: boolean;
  victory: boolean;
};
const victoryBurstEmojis = ['🎉', '🏆', '✨', '🎊', '🥳', '💥', '🌟'];
const FLIP_DURATION = 650;
const MISMATCH_RESET_DELAY = FLIP_DURATION + 900;
const WAIT_AFTER_MATCH = FLIP_DURATION + 300;

const boardElement = document.querySelector<HTMLDivElement>('#board');
const timerElement = document.querySelector<HTMLDivElement>('#timer');
const movesElement = document.querySelector<HTMLDivElement>('#moves');
const bestElement = document.querySelector<HTMLDivElement>('#best');
const resetButton = document.querySelector<HTMLButtonElement>('#reset-btn');
const difficultyButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.difficulty-pill'));
const particlesRoot = document.querySelector<HTMLDivElement>('.victory-pop');

if (!boardElement || !timerElement || !movesElement || !bestElement || !resetButton || !particlesRoot) {
  throw new Error('Missing game nodes');
}

const buildDeck = (config: DifficultyConfig): string[] => {
  const picks = shuffle(config.pool).slice(0, config.pairs);
  return shuffle(picks.flatMap((symbol) => [symbol, symbol]));
};

const defaultDifficulty: DifficultyKey = 'chill';

const createInitialState = (): GameState => {
  const initialConfig = difficulties[defaultDifficulty];
  return {
    difficulty: defaultDifficulty,
    deck: buildDeck(initialConfig),
    matched: [],
    moves: 0,
    elapsedMs: 0,
    runningSince: null,
    bestTimes: {},
    flipped: [],
    locked: false,
    victory: false
  };
};

const state = createInitialState();
const hasActiveProgress = () =>
  state.moves > 0 || state.matched.length > 0 || state.elapsedMs > 0 || state.flipped.length > 0;
const difficultyChangeWarning = '⚠️❓➡️🎮♻️❗️';
let timerHandle: number | null = null;
const cardRefs: HTMLButtonElement[] = [];

const sleep = (duration: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration);
  });

const setFeedback = (index: number, mood?: 'good' | 'bad') => {
  const card = cardRefs[index];
  if (!card) {
    return;
  }
  if (!mood) {
    delete card.dataset.feedback;
    return;
  }
  card.dataset.feedback = mood;
};

const flashFeedback = (indices: number[], mood: 'good' | 'bad', duration: number) => {
  indices.forEach((idx) => setFeedback(idx, mood));
  window.setTimeout(() => {
    indices.forEach((idx) => {
      const card = cardRefs[idx];
      if (!card) {
        return;
      }
      if (mood === 'good' && card.dataset.state === 'matched') {
        return;
      }
      delete card.dataset.feedback;
    });
  }, duration);
};

const updateTimer = () => {
  timerElement.textContent = `⏱️${formatEmojiTime(state.elapsedMs)}`;
};

const updateMoves = () => {
  const matches = state.matched.length / 2;
  movesElement.textContent = `🔄${toEmojiNumber(state.moves, 2)} 🎯${toEmojiNumber(matches, 2)}`;
};

const updateBest = () => {
  const bestValue = state.bestTimes[state.difficulty];
  bestElement.textContent = bestValue
    ? `🏆⏱️${formatEmojiTime(bestValue)}`
    : '🏆⏱️0️⃣0️⃣🟰0️⃣0️⃣';
};

const syncDifficultyPills = () => {
  difficultyButtons.forEach((button) => {
    button.dataset.active = button.dataset.level === state.difficulty ? 'true' : 'false';
  });
};

const rebuildBoard = () => {
  const config = difficulties[state.difficulty];
  boardElement.innerHTML = '';
  boardElement.style.setProperty('--cols', config.cols.toString());
  cardRefs.length = 0;

  state.deck.forEach((symbol, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `card-shell relative w-full overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br ${config.cardAura} p-1 shadow-inner shadow-black/40 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-400/60`;
    card.dataset.index = index.toString();

    const core = document.createElement('div');
    core.className = 'card-core absolute inset-0 flex h-full w-full items-center justify-center rounded-2xl bg-black/50 text-4xl';

    const front = document.createElement('div');
    front.className = 'card-face absolute inset-0 flex items-center justify-center text-4xl';
    front.textContent = '❔';

    const back = document.createElement('div');
    back.className = 'card-face absolute inset-0 flex items-center justify-center text-5xl';
    back.style.transform = 'rotateY(180deg)';
    back.textContent = symbol;

    core.append(front, back);
    card.append(core);

    card.addEventListener('click', () => handleFlip(index));
    boardElement.appendChild(card);
    cardRefs.push(card);

    if (state.matched.includes(index)) {
      requestAnimationFrame(() => setCardVisualState(index, 'matched'));
    }
  });
};

// Keeps the emoji clock in sync with real time.
const tickTimer = () => {
  if (state.runningSince === null) {
    return;
  }
  state.elapsedMs = Date.now() - state.runningSince;
  updateTimer();
};

const startTimer = (preserveAnchor = false) => {
  if (state.runningSince !== null && !preserveAnchor) {
    return;
  }
  if (!preserveAnchor) {
    state.runningSince = Date.now();
    state.elapsedMs = 0;
  }
  if (timerHandle) {
    window.clearInterval(timerHandle);
  }
  tickTimer();
  timerHandle = window.setInterval(tickTimer, 400);
};

const stopTimer = () => {
  if (timerHandle) {
    window.clearInterval(timerHandle);
    timerHandle = null;
  }
  if (state.runningSince !== null) {
    state.elapsedMs = Date.now() - state.runningSince;
  }
  state.runningSince = null;
};

const setCardVisualState = (index: number, next: CardState) => {
  const card = cardRefs[index];
  if (!card) {
    return;
  }
  card.dataset.state = next;
};

const queueMismatchReset = (indices: number[]) => {
  state.locked = true;
  window.setTimeout(() => {
    flashFeedback(indices, 'bad', 800);
  }, FLIP_DURATION);
  setTimeout(() => {
    indices.forEach((idx) => setCardVisualState(idx, 'idle'));
    indices.forEach((idx) => setFeedback(idx));
    state.flipped = [];
    state.locked = false;
  }, MISMATCH_RESET_DELAY);
};

const pickNextPair = (): [number, number] | null => {
  const matchedSet = new Set(state.matched);
  const buckets = new Map<string, number[]>();
  state.deck.forEach((symbol, index) => {
    if (matchedSet.has(index)) {
      return;
    }
    const group = buckets.get(symbol) ?? [];
    group.push(index);
    buckets.set(symbol, group);
  });
  for (const group of buckets.values()) {
    if (group.length >= 2) {
      return [group[0]!, group[1]!];
    }
  }
  return null;
};

const flipPairAutomatically = async (first: number, second: number) => {
  const firstCard = cardRefs[first];
  const secondCard = cardRefs[second];
  if (!firstCard || !secondCard) {
    return;
  }
  firstCard.click();
  await sleep(FLIP_DURATION + 120);
  secondCard.click();
  await sleep(WAIT_AFTER_MATCH);
};

const attachSecretSolver = () => {
  window.secretSolvePuzzle = async () => {
    if (state.victory) {
      return;
    }
    let guard = 0;
    while (!state.victory && guard < 200) {
      if (state.locked) {
        await sleep(FLIP_DURATION);
        continue;
      }
      const pair = pickNextPair();
      if (!pair) {
        break;
      }
      await flipPairAutomatically(pair[0], pair[1]);
      guard += 1;
    }
  };
};

// Emoji particle burst to celebrate clears.
const triggerVictoryBurst = () => {
  particlesRoot.innerHTML = '';
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 60; i += 1) {
    const shard = document.createElement('span');
    shard.textContent =
      victoryBurstEmojis[Math.floor(Math.random() * victoryBurstEmojis.length)] ?? '✨';
    const spreadX = Math.random() * 360 - 180;
    const spreadY = Math.random() * -260 - 60;
    shard.style.left = `${50 + Math.random() * 40 - 20}%`;
    shard.style.top = `${35 + Math.random() * 40 - 20}%`;
    shard.style.fontSize = `${1 + Math.random() * 1.5}rem`;
    shard.style.setProperty('--x', `${spreadX}px`);
    shard.style.setProperty('--y', `${spreadY}px`);
    fragment.appendChild(shard);
    window.setTimeout(() => shard.remove(), 2400);
  }
  particlesRoot.appendChild(fragment);
};

const handleWin = () => {
  state.victory = true;
  stopTimer();
  const duration = state.elapsedMs;
  const previousBest = state.bestTimes[state.difficulty];
  if (!previousBest || duration < previousBest) {
    state.bestTimes[state.difficulty] = duration;
  }
  updateBest();
  triggerVictoryBurst();
};

const checkVictory = () => {
  if (state.matched.length === state.deck.length && !state.victory) {
    handleWin();
  }
};

const handleFlip = (index: number) => {
  if (state.locked || state.victory) {
    return;
  }
  if (state.flipped.includes(index) || state.matched.includes(index)) {
    return;
  }

  if (state.runningSince === null) {
    startTimer();
  }

  state.flipped.push(index);
  setCardVisualState(index, 'flipped');

  if (state.flipped.length === 2) {
    state.moves += 1;
    const [first, second] = state.flipped as [number, number];
    const firstSymbol = state.deck[first];
    const secondSymbol = state.deck[second];
    if (!firstSymbol || !secondSymbol) {
      state.flipped = [];
      state.locked = false;
      updateMoves();
      return;
    }
    if (firstSymbol === secondSymbol) {
      state.matched.push(first, second);
      setTimeout(() => {
        setCardVisualState(first, 'matched');
        setCardVisualState(second, 'matched');
      }, 250);
      window.setTimeout(() => {
        flashFeedback([first, second], 'good', 2000);
      }, FLIP_DURATION);
      state.flipped = [];
      updateMoves();
      checkVictory();
      return;
    }
    updateMoves();
    queueMismatchReset([first, second]);
    return;
  }

  updateMoves();
};

const softReset = (level: DifficultyKey) => {
  const config = difficulties[level];
  stopTimer();
  state.difficulty = level;
  state.deck = buildDeck(config);
  state.matched = [];
  state.moves = 0;
  state.elapsedMs = 0;
  state.runningSince = null;
  state.flipped = [];
  state.locked = false;
  state.victory = false;
  rebuildBoard();
  updateTimer();
  updateMoves();
  updateBest();
  syncDifficultyPills();
};

resetButton.addEventListener('click', () => {
  softReset(state.difficulty);
});

difficultyButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const level = button.dataset.level as DifficultyKey;
    if (level && level !== state.difficulty) {
      if (hasActiveProgress() && !window.confirm(difficultyChangeWarning)) {
        return;
      }
      softReset(level);
    }
  });
});

attachSecretSolver();

rebuildBoard();
updateTimer();
updateMoves();
updateBest();
syncDifficultyPills();
