function ping(msg) {
  // return only plain JSON values; Date objects don't serialize, so use ISO strings
  return {
    msg,
    user: Session.getEffectiveUser().getEmail(),
    at: new Date().toISOString(),
  };
}
// testing: clears what's been done so the next runScheduler adds every category again
function resetLastRun() {
  PropertiesService.getUserProperties().deleteProperty("lastRun");
  return "lastRun cleared";
}

function getTaskListId() {
  const taskListName = "Dailies IRL"; // change to the name of your google task list
  const taskLists = Tasks.Tasklists.list().items;
  // Replace with your actual task list ID
  let taskListId = "";
  taskLists.forEach((taskLists) => {
    if (taskLists.title === taskListName) {
      taskListId = taskLists.id;
    }
  });
  if (!taskListId)
    taskListId = Tasks.Tasklists.insert({ title: taskListName }).id;
  return taskListId;
}

function assignRandomTask(
  taskListId,
  count,
  listOfTasks,
  freqType,
  timezone,
  weekEnd = 0,
  bigTasks,
  weekStart,
) {
  // count is how many tasks to assign from listOfTasks
  // freqType is monthly, weekly, daily : due dates are based on it
  // timezone is to make sure it's for the correct timezone

  // Get the current date and time
  // set due date based on type
  const dueDateISO = getDueDate(freqType, timezone, weekEnd, weekStart);
  const tasksAdded = new Set(); // no recurring tasks unless count > listOfTasks.length
  const length = Math.min(count, new Set(listOfTasks).size);
  if (length === 0) return; // only big tasks left for the extras
  for (let i = 0; i < length; i++) {
    // bigTasks and dayOffs/allIn are handled outside of this function
    let task = listOfTasks[Math.floor(Math.random() * listOfTasks.length)];
    while (tasksAdded.has(task)) {
      task = listOfTasks[Math.floor(Math.random() * listOfTasks.length)];
    }
    tasksAdded.add(task);
  }
  for (const task of tasksAdded) {
    if (bigTasks.includes(task)) {
      Tasks.Tasks.insert(
        {
          title: task,
          due: dueDateISO,
        },
        taskListId,
      );
      return;
    }
  }

  for (const task of tasksAdded) {
    Tasks.Tasks.insert(
      {
        title: task,
        due: dueDateISO,
      },
      taskListId,
    );
  }
  count -= length;
  if (count > 0) {
    // prevents continuing when bigTask
    const noBigTasks = listOfTasks.filter((t) => !bigTasks.includes(t));
    assignRandomTask(
      taskListId,
      count,
      noBigTasks,
      freqType,
      timezone,
      weekEnd,
      bigTasks,
      weekStart,
    ); // recursively call to add every task
  }
}

function getDueDate(freqType, timezone, weekEnd = 0, weekStart) {
  const now = new Date();
  const type = freqType.toLowerCase();
  // the user's calendar date, not the server's (Apps Script runs in GMT)
  const [year, month, day] = Utilities.formatDate(now, timezone, "yyyy-MM-dd")
    .split("-")
    .map(Number);
  let dueDate;
  if (type === "daily") {
    dueDate = new Date(Date.UTC(year, month - 1, day));
  } else if (type === "weekly") {
    // "u" is 1 = Monday ... 7 = Sunday, % 7 makes Sunday 0 to match weekEnd
    const today = Number(Utilities.formatDate(now, timezone, "u")) % 7;
    let daysUntilEnd = (weekEnd - today + 7) % 7;
    // same start and end day is a full week, so on the start day it's due next week
    if (daysUntilEnd === 0 && weekStart === weekEnd) daysUntilEnd = 7;
    dueDate = new Date(Date.UTC(year, month - 1, day + daysUntilEnd));
  } else if (type === "monthly") {
    // day 0 of next month is the last day of this month
    dueDate = new Date(Date.UTC(year, month, 0));
  } else {
    throw new Error("400 Type not supported: " + freqType);
  }
  return dueDate.toISOString();
}

function periodKey(category, timezone) {
  const now = new Date();
  const today = Utilities.formatDate(now, timezone, "yyyy-MM-dd");
  if (category.schedule === "daily") return today;
  if (category.schedule === "monthly") return today.slice(0, 7);

  // weekly: 0 = Sunday ... 6 = Saturday, ranges can wrap (Fri–Mon)
  const weekday = Number(Utilities.formatDate(now, timezone, "u")) % 7;
  const daysSinceStart = (weekday - category.weekStart + 7) % 7;
  // same start and end day is a full week (Mon–next Mon), not a single day
  const span =
    category.weekStart === category.weekEnd
      ? 7
      : (category.weekEnd - category.weekStart + 7) % 7;
  if (daysSinceStart > span) return null; // between end day and next start day
  const [year, month, day] = today.split("-").map(Number);
  // the week is named after the date it started
  return new Date(Date.UTC(year, month - 1, day - daysSinceStart))
    .toISOString()
    .slice(0, 10);
}

// makes sure this user has exactly one hourly runScheduler trigger, called on every settings save
function ensureTrigger() {
  let found = false;
  ScriptApp.getProjectTriggers().forEach((t) => {
    const handler = t.getHandlerFunction();
    if (handler === "runScheduler" && !found) {
      found = true;
    } else if (handler === "runScheduler" || handler === "ping") {
      ScriptApp.deleteTrigger(t); // duplicates and the old installTriggerTest one
    }
  });
  if (!found) {
    ScriptApp.newTrigger("runScheduler").timeBased().everyHours(1).create();
  }
}

function runScheduler() {
  const lock = LockService.getUserLock();
  if (!lock.tryLock(0)) return "skipped, another run is already going";
  try {
    const config = getConfig().config;
    if (!config) return "no settings saved yet";
    const props = PropertiesService.getUserProperties();
    const lastRun = JSON.parse(props.getProperty("lastRun") || "{}");
    const taskListId = getTaskListId();
    const tz = config.timezone;

    assignDailies(config, lastRun, taskListId);

    config.categories
      .filter((c) => c.schedule !== "daily")
      .forEach((category) => {
        const key = periodKey(category, tz);
        if (!key || lastRun[category.id] === key) return;
        assignRandomTask(
          taskListId,
          category.count,
          category.tasks.map((t) => t.title),
          category.schedule,
          tz,
          category.weekEnd,
          [], // big tasks are daily only
          category.weekStart,
        );
        lastRun[category.id] = key;
        props.setProperty("lastRun", JSON.stringify(lastRun)); // save after each, in case the run dies midway
      });
    return lastRun;
  } finally {
    lock.releaseLock();
  }
}

function assignDailies(config, lastRun, taskListId) {
  const tz = config.timezone;
  const today = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");
  const dailies = config.categories.filter(
    (c) => c.schedule === "daily" && lastRun[c.id] !== today,
  );
  if (dailies.length === 0) return;

  const dayOff = config.dayOffOdds > 0 && Math.random() < 1 / config.dayOffOdds;
  const double =
    !dayOff && config.doubleOdds > 0 && Math.random() < 1 / config.doubleOdds;

  dailies.forEach((category) => {
    if (!dayOff) {
      assignRandomTask(
        taskListId,
        double ? category.count * 2 : category.count,
        category.tasks.map((t) => t.title),
        "daily",
        tz,
        0,
        category.tasks.filter((t) => t.big).map((t) => t.title),
      );
    }
    lastRun[category.id] = today; // a day off still counts as done, so it isn't rerolled next hour
    PropertiesService.getUserProperties().setProperty(
      "lastRun",
      JSON.stringify(lastRun),
    );
  });
}
