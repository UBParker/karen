import { dueReminders } from "./reminders.js";

const URLS = { dot: "https://airconsumer.dot.gov/consumer/s/oacp-form", united: "https://www.united.com/en/us/customercare" };
const HOSTS = { dot: "airconsumer.dot.gov", united: "www.united.com" };
const openApp = () => chrome.tabs.create({ url: "app.html" });

chrome.action.onClicked.addListener(openApp);
chrome.notifications.onClicked.addListener(openApp);
chrome.runtime.onInstalled.addListener((d) => {
  chrome.alarms.create("daily", { when: Date.now() + 60000, periodInMinutes: 1440 });
  if (d.reason === "install") openApp();
});

chrome.alarms.onAlarm.addListener(async () => {
  const { complaints = [] } = await chrome.storage.local.get("complaints");
  const today = new Date().toLocaleDateString("en-CA");
  for (const r of dueReminders(complaints, today))
    chrome.notifications.create(r.id, { type: "basic", iconUrl: "icon.png", title: "Karen: time to complain", message: r.text });
});

chrome.runtime.onMessage.addListener(async (m, sender) => {
  if (m.karen === "file") {
    const tab = await chrome.tabs.create({ url: URLS[m.job.kind] });
    await chrome.storage.session.set({ ["job" + tab.id]: m.job });
  }
  if (m.karen === "submitted") {
    const { complaints = [] } = await chrome.storage.local.get("complaints");
    const c = complaints.find((x) => x.id === m.id);
    if (c) {
      (c.refs ||= {})[m.kind] = m.ref || "submitted";
      c.status = "filed";
      (c.log ||= []).push({ at: new Date().toISOString(), text: `Filed with ${m.kind === "dot" ? "DOT" : "United"}${m.ref ? `, case ${m.ref}` : ""}` });
      await chrome.storage.local.set({ complaints });
    }
  }
  if (m.karen === "log") {
    const { complaints = [] } = await chrome.storage.local.get("complaints");
    const c = complaints.find((x) => x.id === m.id);
    if (c) { (c.log ||= []).push({ at: new Date().toISOString(), text: m.text }); await chrome.storage.local.set({ complaints }); }
  }
});

// Inject the filler on every full page load of a Karen tab (sign-in can reload the page).
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== "complete") return;
  const job = (await chrome.storage.session.get("job" + tabId))["job" + tabId];
  if (!job || !tab.url?.includes(HOSTS[job.kind])) return;
  await chrome.scripting.executeScript({ target: { tabId }, files: ["fill.js"] });
  await chrome.scripting.executeScript({ target: { tabId }, func: (j) => window.karenRun(j), args: [job] });
});
chrome.tabs.onRemoved.addListener((tabId) => chrome.storage.session.remove("job" + tabId));
