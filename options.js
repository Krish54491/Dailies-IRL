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

// ---------- reading and validating ----------

function readForm() {
  return {
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
  if (e.target === timezoneInput) timezoneInput.setCustomValidity("");
  setDirty(true);
  const card = e.target.closest(".category");
  if (card) refreshCategory(card);
});
form.addEventListener("change", (e) => {
  // selects and checkboxes
  setDirty(true);
  const card = e.target.closest(".category");
  if (card) refreshCategory(card);
});

form.addEventListener("click", (e) => {
  const button = e.target.closest("button");
  if (!button) return;
  const card = button.closest(".category");

  if (button.id === "addCategory") {
    const newCard = renderCategory(newCategory());
    categoriesEl.append(newCard);
    newCard.querySelector(".cat-name").focus();
    updateEmpty();
  } else if (button.classList.contains("add-task")) {
    const li = renderTask({ title: "", big: false });
    card.querySelector(".task-list").append(li);
    li.querySelector(".task-title").focus();
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
    setStatus("");
    // a first-time user's defaults aren't saved yet
    setDirty(!config);
  } catch (err) {
    setStatus(`Couldn't load settings: ${err.message}`, true);
    retryBtn.hidden = false;
  }
}

load();
