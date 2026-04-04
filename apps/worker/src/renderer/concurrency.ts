let activeRenders = 0;
const queue: Array<() => void> = [];

export async function withRenderSlot<T>(limit: number, fn: () => Promise<T>): Promise<T> {
  await acquire(limit);

  try {
    return await fn();
  } finally {
    release();
  }
}

export function getRenderConcurrencyState() {
  return {
    activeRenders,
    queuedRenders: queue.length
  };
}

function acquire(limit: number) {
  if (activeRenders < limit) {
    activeRenders += 1;
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    queue.push(() => {
      activeRenders += 1;
      resolve();
    });
  });
}

function release() {
  activeRenders = Math.max(0, activeRenders - 1);
  const next = queue.shift();

  if (next) {
    next();
  }
}
