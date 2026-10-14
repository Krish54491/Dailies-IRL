document.getElementById("settings").onclick = () =>
  chrome.runtime.openOptionsPage();

// theme switch, getTheme/setTheme come from theme.js
for (const radio of document.querySelectorAll('input[name="theme"]')) {
  radio.checked = radio.value === getTheme();
  radio.addEventListener("change", () => setTheme(radio.value));
}

const out = document.getElementById("out");
async function show(promise) {
  try {
    out.textContent = JSON.stringify(await promise, null, 2);
  } catch (e) {
    out.textContent = e.message;
  }
}

// testing buttons, comment these out with the Testing section in window.html before publishing
// document.getElementById("ping").onclick = () =>
//   show(runScript("ping", ["hello"]));
// document.getElementById("run").onclick = () => show(runScript("runScheduler"));
// // clears lastRun so "Run scheduler now" adds every category again
// document.getElementById("reset").onclick = () =>
//   show(runScript("resetLastRun"));
// // adds 3 test tasks, checks only the old unfinished one is auto deleted, then removes them
// document.getElementById("testAutoDelete").onclick = () =>
//   show(runScript("testAutoDelete"));
