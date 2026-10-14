document.getElementById("settings").onclick = () =>
  chrome.runtime.openOptionsPage();

const out = document.getElementById("out");
async function show(promise) {
  try {
    out.textContent = JSON.stringify(await promise, null, 2);
  } catch (e) {
    out.textContent = e.message;
  }
}

document.getElementById("ping").onclick = () =>
  show(runScript("ping", ["hello"]));
document.getElementById("trigger").onclick = () =>
  show(runScript("installTriggerTest"));
