# Functionality

- add tasks to be randomly assigned per day/week/month
  - picked without duplicates (Fisher–Yates shuffle)
  - if count is higher than the amount of tasks in the category, every task is added once then the extras are random picks
- categories of different types of tasks
  - have each category be editable
  - edits apply from the next period, already added tasks stay
- set how many of a specific category is added(default is 1)
- add option to auto delete them after day is over(auto cleans up the task)
  - toggleable per category
  - only deletes unfinished tasks, completed tasks stay
  - if off, unfinished tasks carry over
- bigTasks: if a big task is picked it's the only task added that day
- day off / double tasks: rare chance set by user as "1 in N days" (Ex. 365)
  - check is `Math.random() < 1 / N` (replaces offset, odds don't change when tasks are added)
  - only applies to daily categories, weekly/monthly still get added
- all tasks go into the extension's own "Dailies IRL" task list
- Visualization of completion

# Schedules

- daily: due the same day
- weekly: start and end day configurable per category (Ex. Mon-Fri), due on the end day
  - no new period starts on days outside the range
- monthly: starts on the 1st, due on the last day of the month
- every task gets a marker in its notes `dailies:<periodKey>:<categoryId>`
  - used to avoid duplicates, for cleanup, and to know a task's category for charts

# Needed from user(frontend needs)

- google account login (chrome.identity)
  - access to read and write to the Dailies IRL task list
- which categories and what tasks are in the categories
- when what categories should be triggered(Ex. daily, weekly, monthly, etc) and how many tasks are added on that trigger(default 1, but can be set to 100)
- weekly start/end days per weekly category
- day off odds (1 in N days)
- timezone (Ex. America/Chicago), checked against `Intl.supportedValuesOf('timeZone')`

# visualization(later)

- everything original program did and a bit more
- give charts on percentage of times they finish tasks(Ex. 11% of all tasks completed are done at 11pm)
- charts on how many tasks they finish per day on average(20% of time you finish 2 tasks a day, 32% you finish 0 a day)
  - needs every day in the range filled in, with 0 for days with no completions
- chart on what days they finish most of their tasks(11% monday, 2% tuesday, .., 24% friday, etc.)
- charts only use completed tasks
- Chart.js has to be bundled in the extension (MV3 doesn't allow remote code)

# Architecture (hybrid)

- extension is only the UI (popup, options page for categories, charts tab)
- Apps Script does all the scheduling, runs on Google's servers so it works with Chrome closed
  - extensions have no server side triggers, chrome.alarms only runs while Chrome is open
- extension calls Apps Script through the Apps Script API (`scripts.run`) with JSON in and JSON out
  - this is allowed in MV3, the script runs on Google's servers not in the extension
  - server only sends back data, never HTML/JS
- config stored in Apps Script user properties (storage.json can't be written to at runtime)
- completed task history backed up to a Google Sheet so charts still work if the user deletes tasks

# What I do(backend)

- set up the automatic triggers
  - one hourly trigger per user (max 20 triggers per user)
  - each run only adds tasks if that period hasn't been done yet (safe to run twice)
  - LockService so overlapping runs can't double add
- store all the categories and tasks the user wants in user properties
- auto delete unfinished tasks from past periods
- due dates built from the user's timezone, not toISOString (that can shift to the previous day)
- (later) aggrete data to display is visualization tab
  - sync new completions to the history Sheet every run

# Build order

1. test calling Apps Script from the extension (ping + installTriggerTest) <- current step
2. extension skeleton (manifest, popup, options page) (done)
3. getConfig/saveConfig + category editor (done, needs testing once OAuth works)
4. runScheduler for daily categories
5. installTrigger after sign in
6. weekly and monthly periods
7. auto delete
8. history Sheet
9. getStats + charts tab
10. move over what's left from RandomizeDailies.js and retire it

# todo

Create two pages:

- Privacy policy: it has to say how you access, use, store and share Google user data. For this app that means:
  - You create a "Dailies IRL" list and tasks in the user's Google Tasks.
  - Settings are stored in the user's own Google account, in Apps Script user properties.
  - Nothing is sent to you or any third party, and nothing is sold.
  - How to remove everything.

  Also include Google's "Limited Use" statement (the wording comes from Google's API Services User Data Policy).

3. Verify the domain in Search Console with your project owner account, then add it under Authorized domains.
4. Fill in Data access with a short justification for each sensitive scope:
   - tasks: "creates the Dailies IRL list and adds the user's randomly picked tasks with due dates"
   - script.scriptapp: "creates one hourly trigger, owned by the user, that adds tasks on schedule while the browser is closed"
5. Record a demo video, uploaded unlisted to YouTube, showing:
   - the full flow, including the complete consent screen in English with the exact scopes
   - the same app name and logo as on the branding page
   - each scope being used: saving settings, which creates the trigger, then tasks appearing in Google Tasks
6. Submit for verification. Brand verification usually takes 24–72 hours. Sensitive-scope review can take longer, and they may email you follow-up questions.

The Chrome Web Store needs its own setup

This is separate from Google's verification:

- a one-time $5 developer registration
- the Privacy practices tab:
  - single purpose
  - why you need identity and script.googleapis.com
  - "No" to remote code (MV3 allows calling the Apps Script API, as we covered)
  - the data-use certifications
- the same privacy policy URL
