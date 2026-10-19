// Dictation into a textarea. Prefers on-device recognition so audio stays on the computer;
// otherwise Chrome's default service (Google) transcribes it, and the status line says so.
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const canSpeak = !!SR;

export async function dictate(textarea, status, onStop) {
  const r = new SR();
  const lang = navigator.language || "en-US";
  r.lang = lang; r.continuous = true; r.interimResults = true;
  let where = "Chrome sends the audio to Google to turn it into text";
  if (SR.available && "processLocally" in r) {
    let a = await SR.available({ langs: [lang], processLocally: true }).catch(() => "unavailable");
    if (a === "downloadable" || a === "downloading") a = (await SR.install({ langs: [lang], processLocally: true }).catch(() => false)) ? "available" : a;
    if (a === "available") { r.processLocally = true; where = "on this computer"; }
  }
  const base = textarea.value ? textarea.value.replace(/\s*$/, " ") : "";
  let done = "";
  r.onresult = (e) => {
    let live = "";
    for (let i = e.resultIndex; i < e.results.length; i++) e.results[i].isFinal ? (done += e.results[i][0].transcript + " ") : (live += e.results[i][0].transcript);
    textarea.value = base + done + live;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  };
  let failed = false;
  r.onerror = (e) => (failed = true, status.textContent = e.error === "not-allowed" ? "Allow the microphone for Karen (the icon in the address bar), then try again." : "Couldn't hear that: " + e.error);
  r.onend = () => { if (!failed) status.textContent = ""; onStop?.(done.trim()); };
  r.start();
  status.textContent = `Listening (${where}). Tap Stop when you're done.`;
  return () => r.stop();
}
