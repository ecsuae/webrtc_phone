function createSubscriptionStore() {
  // Format: { extension: [{ subscription, timestamp }] }
  const subscriptions = new Map();

  function listSummary() {
    const list = [];
    subscriptions.forEach((subs, extension) => {
      list.push({
        extension,
        devices: subs.length,
        lastUpdate: Math.max(...subs.map((s) => s.timestamp)),
      });
    });
    return list;
  }

  function clearAll() {
    const count = subscriptions.size;
    subscriptions.clear();
    return count;
  }

  return {
    subscriptions,
    listSummary,
    clearAll,
  };
}

module.exports = { createSubscriptionStore };
