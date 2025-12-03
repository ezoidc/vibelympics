const cards = Array.from(document.querySelectorAll<HTMLButtonElement>('.demo-card'));

if (cards.length) {
  const FLIP_DURATION = 650;
  const initDemo = () => {
    const bucket = new Map<string, HTMLButtonElement[]>();
    cards.forEach((card) => {
      const symbol = card.dataset.symbol;
      if (!symbol) {
        return;
      }
      const group = bucket.get(symbol) ?? [];
      group.push(card);
      bucket.set(symbol, group);
    });

    const symbols = Array.from(bucket.keys());
    if (!symbols.length) {
      return;
    }
    if (symbols.length === 1 && symbols[0]) {
      symbols.push(symbols[0]!);
    }

    let cursor = 0;
    let mode: 'mismatch' | 'match' = 'mismatch';

    const getSymbol = (offset: number): string => {
      const index = (cursor + offset) % symbols.length;
      const normalized = index < 0 ? index + symbols.length : index;
      return symbols[normalized] ?? symbols[0]!;
    };

    const resetAll = () => {
      cards.forEach((card) => {
        card.dataset.state = 'idle';
        card.dataset.match = 'false';
        delete card.dataset.feedback;
      });
    };

    const showMismatch = () => {
      const firstSymbol = getSymbol(0);
      const secondSymbol = getSymbol(1);
      const firstCard = bucket.get(firstSymbol)?.[0];
      const secondCard = bucket.get(secondSymbol)?.[0];
      if (!firstCard || !secondCard) {
        return;
      }
      [firstCard, secondCard].forEach((card) => {
        card.dataset.state = 'flip';
      });
      window.setTimeout(() => {
        [firstCard, secondCard].forEach((card) => {
          card.dataset.feedback = 'bad';
        });
      }, FLIP_DURATION);
      setTimeout(() => {
        [firstCard, secondCard].forEach((card) => {
          card.dataset.state = 'idle';
          delete card.dataset.feedback;
        });
      }, 900);
    };

    const showMatch = () => {
      const symbol = getSymbol(0);
      const pair = bucket.get(symbol)?.slice(0, 2);
      if (!pair || pair.length < 2) {
        return;
      }
      pair.forEach((card) => {
        card.dataset.state = 'flip';
      });
      window.setTimeout(() => {
        pair.forEach((card) => {
          card.dataset.feedback = 'good';
        });
      }, FLIP_DURATION);
      setTimeout(() => {
        pair.forEach((card) => {
          card.dataset.match = 'true';
        });
      }, 400);
      setTimeout(() => {
        pair.forEach((card) => {
          card.dataset.match = 'false';
          delete card.dataset.feedback;
          card.dataset.state = 'idle';
        });
      }, 2000);
    };

    const cycle = () => {
      resetAll();
      if (mode === 'mismatch') {
        showMismatch();
        mode = 'match';
      } else {
        showMatch();
        mode = 'mismatch';
        cursor = (cursor + 1) % symbols.length;
      }
    };

    cycle();
    window.setInterval(cycle, 2600);
  };

  initDemo();
}
