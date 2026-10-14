// Apps Script side of the settings page, add as a new file (Config.gs) in the Apps Script project
// User properties cap each value at 9 KB and the whole store at 500 KB, so settings are split up:
//   "settings"           -> { timezone, dayOffOdds, doubleOdds, categoryOrder, categoryChunks }
//   "category:<id>:<n>"  -> chunk n of one category's JSON, tasks stored compactly (see packCategory_)
const SETTINGS_KEY = "settings";
const CATEGORY_PREFIX = "category:";
const MAX_PROPERTY_BYTES = 9000;
// 500 KB store, leaves room for the scheduler's own keys (like lastRun)
const MAX_TOTAL_BYTES = 480000;
const SCHEDULES = ["daily", "weekly", "monthly"];

// called from the extension, returns { email, config } where config is null for a new user
function getConfig() {
  const props = PropertiesService.getUserProperties().getProperties();
  const email = Session.getEffectiveUser().getEmail();
  if (!props[SETTINGS_KEY]) {
    return { email: email, config: null };
  }
  const settings = JSON.parse(props[SETTINGS_KEY]);
  const chunkCounts = settings.categoryChunks || {};
  const categories = [];
  settings.categoryOrder.forEach((id) => {
    let json;
    if (chunkCounts[id]) {
      json = "";
      for (let n = 0; n < chunkCounts[id]; n++) {
        json += props[categoryKey_(id, n)];
      }
    } else {
      json = props[CATEGORY_PREFIX + id]; // saved before chunking
    }
    if (json) categories.push(unpackCategory_(JSON.parse(json)));
  });
  return {
    email: email,
    config: {
      timezone: settings.timezone,
      dayOffOdds: settings.dayOffOdds,
      doubleOdds: settings.doubleOdds,
      categories: categories,
    },
  };
}

// called from the extension with the whole config, replaces what's stored and returns getConfig()
function saveConfig(config) {
  const clean = validateConfig_(config);
  const values = {};
  const categoryChunks = {};
  clean.categories.forEach((category) => {
    const chunks = splitByBytes_(
      JSON.stringify(packCategory_(category)),
      MAX_PROPERTY_BYTES,
    );
    chunks.forEach((chunk, n) => {
      values[categoryKey_(category.id, n)] = chunk;
    });
    categoryChunks[category.id] = chunks.length;
  });
  values[SETTINGS_KEY] = JSON.stringify({
    timezone: clean.timezone,
    dayOffOdds: clean.dayOffOdds,
    doubleOdds: clean.doubleOdds,
    categoryOrder: clean.categories.map((c) => c.id),
    categoryChunks: categoryChunks,
  });
  if (byteLength_(values[SETTINGS_KEY]) > MAX_PROPERTY_BYTES) {
    throw new Error("Too many categories, remove some and try again");
  }

  const lock = LockService.getUserLock();
  lock.waitLock(10000);
  try {
    const store = PropertiesService.getUserProperties();
    const existing = store.getProperties();

    // everything that isn't settings counts toward the same 500 KB
    let total = 0;
    Object.keys(existing).forEach((key) => {
      if (key !== SETTINGS_KEY && key.indexOf(CATEGORY_PREFIX) !== 0) {
        total += byteLength_(key) + byteLength_(existing[key]);
      }
    });
    Object.keys(values).forEach((key) => {
      total += byteLength_(key) + byteLength_(values[key]);
    });
    if (total > MAX_TOTAL_BYTES) {
      throw new Error(
        `Your tasks need ${Math.ceil(total / 1000)} KB but only ` +
          `${MAX_TOTAL_BYTES / 1000} KB fits, remove some tasks and try again`,
      );
    }

    store.setProperties(values); // leaves other keys (like lastRun) alone
    Object.keys(existing).forEach((key) => {
      if (key.indexOf(CATEGORY_PREFIX) === 0 && !(key in values)) {
        store.deleteProperty(key); // deleted category or a chunk it no longer needs
      }
    });
  } finally {
    lock.releaseLock();
  }
  ensureTrigger(); // first save turns on the hourly scheduler, nothing else for the user to do
  return getConfig();
}

function categoryKey_(id, n) {
  return `${CATEGORY_PREFIX}${id}:${n}`;
}

function byteLength_(text) {
  return Utilities.newBlob(text).getBytes().length;
}

// splits text into pieces of at most maxBytes in UTF-8 without cutting a character in half
function splitByBytes_(text, maxBytes) {
  const chunks = [];
  let current = "";
  let bytes = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0);
    const size = code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
    if (bytes + size > maxBytes) {
      chunks.push(current);
      current = "";
      bytes = 0;
    }
    current += ch;
    bytes += size;
  }
  chunks.push(current);
  return chunks;
}

// stores tasks as a plain list of titles plus the indexes of the big ones,
// ["Dishes","Deep clean"] + big:[1] instead of [{title,big},...] fits about twice as many tasks
function packCategory_(category) {
  const packed = Object.assign({}, category);
  packed.tasks = category.tasks.map((t) => t.title);
  packed.big = [];
  category.tasks.forEach((t, i) => {
    if (t.big) packed.big.push(i);
  });
  return packed;
}

// turns the stored form back into the { title, big } tasks the extension uses
function unpackCategory_(packed) {
  const category = Object.assign({}, packed);
  const big = packed.big || [];
  category.tasks = packed.tasks.map((t, i) =>
    // categories saved before packing still have { title, big } objects
    typeof t === "string" ? { title: t, big: big.indexOf(i) !== -1 } : t,
  );
  delete category.big;
  return category;
}

// never trust what the client sends, rebuild the config from checked values
function validateConfig_(config) {
  if (!config || typeof config !== "object") throw new Error("Missing config");
  const timezone = String(config.timezone || "").trim();
  if (!/^[A-Za-z0-9_+\-]+(\/[A-Za-z0-9_+\-]+)*$/.test(timezone)) {
    throw new Error("Invalid time zone");
  }
  if (!Array.isArray(config.categories)) throw new Error("Missing categories");

  const ids = {};
  const categories = config.categories.map((c, i) => {
    const label = `Category ${i + 1}`;
    const id = String(c.id || "");
    if (!/^[A-Za-z0-9-]{1,40}$/.test(id) || ids[id]) {
      throw new Error(`${label} has an invalid id`);
    }
    ids[id] = true;
    const name = String(c.name || "").trim();
    if (!name || name.length > 60) throw new Error(`${label} needs a name (max 60)`);
    if (SCHEDULES.indexOf(c.schedule) === -1) {
      throw new Error(`${name} has an invalid schedule`);
    }
    if (!Array.isArray(c.tasks)) throw new Error(`${name} is missing tasks`);
    const tasks = c.tasks
      .map((t) => ({
        title: String((t && t.title) || "").trim().slice(0, 200),
        big: Boolean(t && t.big),
      }))
      .filter((t) => t.title);
    if (tasks.length === 0) throw new Error(`${name} needs at least one task`);
    return {
      id: id,
      name: name,
      schedule: c.schedule,
      count: intInRange_(c.count, 1, 100, `${name} tasks per period`),
      weekStart: intInRange_(c.weekStart, 0, 6, `${name} week start`),
      weekEnd: intInRange_(c.weekEnd, 0, 6, `${name} week end`),
      autoDelete: Boolean(c.autoDelete),
      tasks: tasks,
    };
  });

  return {
    timezone: timezone,
    dayOffOdds: intInRange_(config.dayOffOdds, 0, 100000, "Day off chance"),
    doubleOdds: intInRange_(config.doubleOdds, 0, 100000, "Double tasks chance"),
    categories: categories,
  };
}

function intInRange_(value, min, max, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new Error(`${label} must be a whole number from ${min} to ${max}`);
  }
  return n;
}
