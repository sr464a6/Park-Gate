// Real-time push to a logged-in user's open tab(s) via Server-Sent Events.
// (No fake polling-of-fake-data here -- clients that are connected receive
// a genuine event the moment the gate simulator or admin triggers it.)

const clientsByUser = new Map(); // userId -> Set(res)

function subscribe(userId, res) {
  if (!clientsByUser.has(userId)) clientsByUser.set(userId, new Set());
  clientsByUser.get(userId).add(res);
  return () => {
    const set = clientsByUser.get(userId);
    if (set) {
      set.delete(res);
      if (set.size === 0) clientsByUser.delete(userId);
    }
  };
}

function pushToUser(userId, event, payload) {
  const set = clientsByUser.get(userId);
  if (!set) return;
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of set) {
    try {
      res.write(data);
    } catch {
      /* client gone, ignore */
    }
  }
}

module.exports = { subscribe, pushToUser };
