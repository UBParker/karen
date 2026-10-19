// Pure: which complaints get today's reminder, and what it says.
const next = (r = {}) => (!r.united ? "file it with United" : !r.dot ? "file it with DOT" : "mark it done once United replies");

export function dueReminders(list, today) {
  return list
    .filter((c) => c.status !== "done" && c.facts?.date && c.facts.date < today)
    .map((c) => ({ id: c.id, text: `UA ${c.facts.flightNumber} on ${c.facts.date}: ${next(c.refs)}.` }));
}
