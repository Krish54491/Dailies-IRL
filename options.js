const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const SCHEDULE_LABELS = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

const form = document.getElementById("settings");
const statusEl = document.getElementById("status");
const retryBtn = document.getElementById("retry");
const accountEl = document.getElementById("account");
const timezoneInput = document.getElementById("timezone");
const dayOffInput = document.getElementById("dayOffOdds");
const doubleInput = document.getElementById("doubleOdds");
const categoriesEl = document.getElementById("categories");
const noCategoriesEl = document.getElementById("noCategories");
const dirtyEl = document.getElementById("dirty");
const saveBtn = document.getElementById("save");
const categoryTemplate = document.getElementById("categoryTemplate");
const taskTemplate = document.getElementById("taskTemplate");

// bumped on every edit so a save that finishes after more edits doesn't mark them saved
let editVersion = 0;
let dirty = false;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function setDirty(value) {
  dirty = value;
  if (value) editVersion++;
  dirtyEl.textContent = value ? "Unsaved changes" : "";
  dirtyEl.classList.remove("error");
}

function isValidTimeZone(tz) {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function defaultConfig() {
  return {
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dayOffOdds: 0,
    doubleOdds: 0,
    categories: [],
  };
}

function newCategory() {
  return {
    id: crypto.randomUUID(),
    name: "",
    schedule: "daily",
    count: 1,
    weekStart: 1, // Monday
    weekEnd: 0, // Sunday
    autoDelete: false,
    tasks: [{ title: "", big: false }],
  };
}

// ---------- rendering ----------

function render(config) {
  timezoneInput.value = config.timezone ?? "";
  dayOffInput.value = config.dayOffOdds ?? 0;
  doubleInput.value = config.doubleOdds ?? 0;
  categoriesEl.replaceChildren(...config.categories.map(renderCategory));
  updateEmpty();
}

function renderCategory(cat) {
  const card = categoryTemplate.content.firstElementChild.cloneNode(true);
  const $ = (sel) => card.querySelector(sel);
  card.dataset.id = cat.id;
  $(".cat-name").value = cat.name;
  $(".cat-schedule").value = cat.schedule;
  $(".cat-count").value = cat.count;
  for (const sel of [".cat-weekStart", ".cat-weekEnd"]) {
    $(sel).append(...WEEKDAYS.map((day, i) => new Option(day, i)));
  }
  $(".cat-weekStart").value = cat.weekStart;
  $(".cat-weekEnd").value = cat.weekEnd;
  $(".cat-autoDelete").checked = cat.autoDelete;
  $(".task-list").append(...cat.tasks.map(renderTask));
  refreshCategory(card);
  return card;
}

function renderTask(task) {
  const li = taskTemplate.content.firstElementChild.cloneNode(true);
  li.querySelector(".task-title").value = task.title;
  li.querySelector(".task-big").checked = task.big;
  return li;
}

// keeps the summary line, hints and visible fields in step with the inputs
function refreshCategory(card) {
  const $ = (sel) => card.querySelector(sel);
  const schedule = $(".cat-schedule").value;
  const count = Number($(".cat-count").value) || 0;
  const taskCount = [...card.querySelectorAll(".task-title")].filter((i) =>
    i.value.trim(),
  ).length;

  card.dataset.schedule = schedule;
  $(".cat-title").textContent = $(".cat-name").value.trim() || "New category";

  let when = SCHEDULE_LABELS[schedule];
  if (schedule === "weekly") {
    const start = WEEKDAYS[$(".cat-weekStart").value].slice(0, 3);
    const end = WEEKDAYS[$(".cat-weekEnd").value].slice(0, 3);
    when += ` ${start}–${end}`;
  }
  $(".cat-meta").textContent =
    `${when} · ${count} of ${taskCount} task${taskCount === 1 ? "" : "s"}`;

  $(".count-hint").textContent =
    taskCount > 0 && count > taskCount
      ? `More than the ${taskCount} tasks in this category: each task is added once, then random extras.`
      : "";
  if (taskCount > 0) $(".task-error").hidden = true;
}

function updateEmpty() {
  noCategoriesEl.hidden = categoriesEl.children.length > 0;
}

// ---------- data use notice ----------

// bump when the notice in options.html changes, so everyone is asked again
const CONSENT_VERSION = 1;
const CONSENT_KEY = "consent";

// { version, at } once agreed to this version of the notice, otherwise null
function getConsent() {
  try {
    const consent = JSON.parse(localStorage.getItem(CONSENT_KEY));
    return consent?.version === CONSENT_VERSION ? consent : null;
  } catch {
    return null;
  }
}

function saveConsent() {
  const consent = { version: CONSENT_VERSION, at: new Date().toISOString() };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
  } catch {
    // storage blocked, the notice will just be shown again next time
  }
  return consent;
}

// agreed during this visit, kept here too in case storage is blocked
let consent = getConsent();

// ---------- reading and validating ----------

function readForm() {
  return {
    consent, // saveConfig refuses to store anything without it
    timezone: timezoneInput.value.trim(),
    dayOffOdds: Number(dayOffInput.value),
    doubleOdds: Number(doubleInput.value),
    categories: [...categoriesEl.querySelectorAll(".category")].map((card) => {
      const $ = (sel) => card.querySelector(sel);
      return {
        id: card.dataset.id,
        name: $(".cat-name").value.trim(),
        schedule: $(".cat-schedule").value,
        count: Number($(".cat-count").value),
        weekStart: Number($(".cat-weekStart").value),
        weekEnd: Number($(".cat-weekEnd").value),
        autoDelete: $(".cat-autoDelete").checked,
        tasks: [...card.querySelectorAll(".task")]
          .map((li) => ({
            title: li.querySelector(".task-title").value.trim(),
            big: li.querySelector(".task-big").checked,
          }))
          .filter((task) => task.title), // blank rows are dropped
      };
    }),
  };
}

// marks every problem and focuses the first one, returns true if the form can be saved
function validate() {
  timezoneInput.setCustomValidity(
    isValidTimeZone(timezoneInput.value.trim())
      ? ""
      : "Unknown time zone, pick one from the list (Ex. America/Chicago)",
  );

  let firstBad = null;
  for (const input of form.querySelectorAll("input")) {
    if (!input.checkValidity()) {
      input.classList.add("touched");
      firstBad ??= input;
    }
  }
  for (const card of categoriesEl.querySelectorAll(".category")) {
    const hasTask = [...card.querySelectorAll(".task-title")].some((i) =>
      i.value.trim(),
    );
    card.querySelector(".task-error").hidden = hasTask;
    if (!hasTask) firstBad ??= card.querySelector(".add-task");
  }

  if (!firstBad) return true;
  firstBad.closest("details")?.setAttribute("open", "");
  firstBad.focus();
  firstBad.reportValidity?.();
  return false;
}

// ---------- events ----------

form.addEventListener("input", (e) => {
  if (e.target.classList.contains("paste-text")) return; // nothing changes until "Add tasks"
  if (e.target === timezoneInput) timezoneInput.setCustomValidity("");
  setDirty(true);
  const card = e.target.closest(".category");
  if (card) refreshCategory(card);
});
form.addEventListener("change", (e) => {
  // selects and checkboxes
  if (e.target.classList.contains("paste-text")) return;
  setDirty(true);
  const card = e.target.closest(".category");
  if (card) refreshCategory(card);
});

form.addEventListener("click", (e) => {
  const button = e.target.closest("button");
  if (!button) return;
  const card = button.closest(".category");

  // opening and closing the import box isn't an edit
  if (button.classList.contains("paste-tasks")) {
    const box = card.querySelector(".paste-box");
    box.hidden = false;
    box.querySelector(".paste-text").focus();
    return;
  }
  if (button.classList.contains("paste-cancel")) {
    closePasteBox(card);
    return;
  }

  if (button.id === "addCategory") {
    const newCard = renderCategory(newCategory());
    categoriesEl.append(newCard);
    newCard.querySelector(".cat-name").focus();
    updateEmpty();
  } else if (button.classList.contains("add-task")) {
    const li = renderTask({ title: "", big: false });
    card.querySelector(".task-list").append(li);
    li.querySelector(".task-title").focus();
  } else if (button.classList.contains("paste-add")) {
    if (!importTasks(card)) return;
  } else if (button.classList.contains("remove-task")) {
    button.closest(".task").remove();
  } else if (button.classList.contains("remove-category")) {
    const name = card.querySelector(".cat-name").value.trim() || "this category";
    if (!confirm(`Delete "${name}" and all its tasks?`)) return;
    card.remove();
    updateEmpty();
  } else {
    return;
  }
  if (card?.isConnected) refreshCategory(card);
  setDirty(true);
});

function closePasteBox(card) {
  const box = card.querySelector(".paste-box");
  box.querySelector(".paste-text").value = "";
  box.hidden = true;
}

// adds one task per line from the import box, returns false if there was nothing to add
function importTasks(card) {
  const text = card.querySelector(".paste-text").value;
  // real line breaks, or a literal "\n" typed as text
  const titles = text
    .split(/\r?\n|\\n/)
    .map((line) => line.trim())
    .filter(Boolean); // duplicates are kept, they make a task more likely
  if (titles.length === 0) return false;

  const list = card.querySelector(".task-list");
  // drop empty rows so the imported tasks don't sit under a blank one
  for (const input of list.querySelectorAll(".task-title")) {
    if (!input.value.trim()) input.closest(".task").remove();
  }
  list.append(...titles.map((title) => renderTask({ title, big: false })));
  closePasteBox(card);
  return true;
}

form.addEventListener("keydown", (e) => {
  // Ctrl+Enter (Cmd+Enter on Mac) in the import box adds the tasks
  if (
    e.key === "Enter" &&
    (e.ctrlKey || e.metaKey) &&
    e.target.classList.contains("paste-text")
  ) {
    e.preventDefault();
    const card = e.target.closest(".category");
    if (importTasks(card)) {
      refreshCategory(card);
      setDirty(true);
    }
  }
});

// Enter in a task name adds a new task below it instead of submitting the form
form.addEventListener("keydown", (e) => {
  if (e.key !== "Enter" || !e.target.classList.contains("task-title")) return;
  e.preventDefault();
  const li = renderTask({ title: "", big: false });
  e.target.closest(".task").after(li);
  li.querySelector(".task-title").focus();
  setDirty(true);
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!validate()) return;
  const savingVersion = editVersion;
  saveBtn.disabled = true;
  dirtyEl.textContent = "Saving…";
  dirtyEl.classList.remove("error");
  try {
    const { config } = await runScript("saveConfig", [readForm()]);
    if (editVersion === savingVersion) {
      render(config); // shows what was actually stored (blank rows removed)
      setDirty(false);
      dirtyEl.textContent = "Saved";
    } else {
      dirtyEl.textContent = "Unsaved changes";
    }
  } catch (err) {
    dirtyEl.textContent = `Couldn't save: ${err.message}`;
    dirtyEl.classList.add("error");
  } finally {
    saveBtn.disabled = false;
  }
});

window.addEventListener("beforeunload", (e) => {
  if (dirty) e.preventDefault();
});

retryBtn.addEventListener("click", load);

const disclosureEl = document.getElementById("disclosure");
document.getElementById("agree").addEventListener("click", () => {
  consent = saveConsent();
  disclosureEl.hidden = true;
  load();
});

const yourDataEl = document.getElementById("yourData");
const deleteBtn = document.getElementById("deleteData");
const deleteListBox = document.getElementById("deleteList");
const deleteStatusEl = document.getElementById("deleteStatus");

deleteBtn.addEventListener("click", async () => {
  const alsoList = deleteListBox.checked;
  const what = alsoList
    ? 'your settings, the hourly timer, and the "Dailies IRL" list with every task in it'
    : "your settings and the hourly timer";
  if (!confirm(`Delete ${what}? This can't be undone.`)) return;
  deleteBtn.disabled = true;
  deleteStatusEl.textContent = "Deleting…";
  deleteStatusEl.classList.remove("error");
  try {
    await runScript("deleteMyData", [alsoList]);
    render(defaultConfig()); // nothing is stored any more, saving again starts fresh
    setDirty(false);
    deleteListBox.checked = false;
    deleteStatusEl.textContent = "Your data was deleted.";
  } catch (err) {
    deleteStatusEl.textContent = `Couldn't delete: ${err.message}`;
    deleteStatusEl.classList.add("error");
  } finally {
    deleteBtn.disabled = false;
  }
});

// ---------- startup ----------

const timezoneList = document.getElementById("timezones");
timezoneList.append(
  ...(Intl.supportedValuesOf?.("timeZone") ?? []).map((tz) => new Option(tz)),
);

async function load() {
  retryBtn.hidden = true;
  setStatus("Signing in and loading your settings…");
  try {
    const { email, config } = await runScript("getConfig");
    accountEl.textContent = email ? `Signed in as ${email}` : "";
    render(config ?? defaultConfig());
    form.hidden = false;
    yourDataEl.hidden = false;
    setStatus("");
    // a first-time user's defaults aren't saved yet
    setDirty(!config);
  } catch (err) {
    setStatus(`Couldn't load settings: ${err.message}`, true);
    retryBtn.hidden = false;
  }
}

// nothing signs in or reaches Google until the notice has been agreed to
if (consent) load();
else disclosureEl.hidden = false;
