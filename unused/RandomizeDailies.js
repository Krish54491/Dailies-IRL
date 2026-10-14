const sheetID = "1FfGPJjmok47NQnWCxbt-atAuFvfhbvKHz6rxP7WQZeY"; // change to your sheetID
// Hardcoded from url because the other ways of obtaining google sheetid is through creating or it being active
const taskListName = "Dailies and Chores"; // change to the name of your google task list
const offset = 0;
// positive to decrease chance at day off or double tasks, negative to increase make sure it's not a negative number bigger than totalLength or else it has no effect
const bigTasks = []; // this list is for tasks that are big(time consuming) enough that you don't have time for other tasks that day
// categories
// change what's in the arrays to change what tasks you get
const allPossibleTasks = [
  // each array is different category
  [
    // tasks are in those categories
  ],
];
function addRandomTask() {
  const taskLists = Tasks.Tasklists.list().items;
  let tasksAdded = [];
  // Replace with your actual task list ID
  let taskListId = "";
  taskLists.forEach((taskLists) => {
    if (taskLists.title === taskListName) {
      taskListId = taskLists.id;
    }
  });

  // Get the current date and time
  const now = new Date();

  // Set the due date to be 1 day from now (example: you can adjust this as needed)
  const dueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // 11:59 in CST the -5 is added to change from orginal UTC
  // Convert the due date to RFC3339 format
  const dueDateISO = dueDate.toISOString();
  let totalLength = 0;
  for (let i = 0; i < allPossibleTasks.length; i++) {
    let n = allPossibleTasks[i].length;
    tasksAdded.push(allPossibleTasks[i][Math.floor(Math.random() * n)]);
    totalLength += n;
  }
  totalLength = totalLength + offset <= 0 ? totalLength : totalLength + offset;
  //while(tasksAdded.includes(workoutTask)){
  //  workoutTask = workouts[Math.floor(Math.random() * workouts.length)];
  //}
  if (Math.random() * totalLength === 0) {
    // adjust totalLength to increase or decrease chance of day off
    return;
  }
  for (let i = 0; i < bigTasks.length; i++) {
    if (tasksAdded.includes(bigTasks[i])) {
      Tasks.Tasks.insert(
        {
          title: bigTasks[i],
          due: dueDateISO,
        },
        taskListId,
      );
      return;
    }
  }

  if (Math.random() * totalLength + 1 === 1) {
    for (let i = 0; i < allPossibleTasks.length; i++) {
      let n = allPossibleTasks[i].length;
      let tempTask = allPossibleTasks[i][Math.floor(Math.random() * n)];
      while (tasksAdded.includes(tempTask)) {
        tempTask = allPossibleTasks[i][Math.floor(Math.random() * n)];
      }
      tasksAdded.push(tempTask);
    }
  }
  for (let i = 0; i < tasksAdded.length; i++) {
    let task = tasksAdded[i];
    Tasks.Tasks.insert(
      {
        title: task,
        due: dueDateISO,
      },
      taskListId,
    );
  }
  createListOfTasks();
}

// Set up a trigger to run the function daily only need to run once, even if you later edit the other functions
// you never need to run it again
function createTimeDrivenTrigger() {
  ScriptApp.newTrigger("addRandomTask")
    .timeBased()
    .everyDays(1)
    .atHour(0) // Set the hour of the day you want to run the script (0-23)
    .create();
  ScriptApp.newTrigger("addTasksToSheet")
    .timeBased()
    .everyDays(1)
    .atHour(0) // Set the hour of the day you want to run the script (0-23)
    .nearMinute(20)
    .create();
  ScriptApp.newTrigger("createListOfTasks").timeBased().everyHours(2).create();
}
function listTaskLists() {
  // Fetch the list of task lists from Google Tasks API
  const taskLists = Tasks.Tasklists.list().items;

  if (taskLists.length === 0) {
    Logger.log("No task lists found.");
  } else {
    Logger.log("Task Lists:");
    taskLists.forEach((taskList) => {
      Logger.log("Name: " + taskList.title + ", ID: " + taskList.id);
    });
  }
}
function createListOfTasks() {
  // convert to make it for visualizer
  const taskLists = Tasks.Tasklists.list().items;
  let taskListId = "";
  taskLists.forEach((taskLists) => {
    if (taskLists.title === taskListName) {
      taskListId = taskLists.id;
    }
  });
  let allTasks = [];
  let pageToken = null;

  do {
    let allData = Tasks.Tasks.list(taskListId, {
      showCompleted: false,
      showDeleted: false,
      showAssigned: true,
      showHidden: false,
      pageToken: pageToken,
    });
    pageToken = allData.nextPageToken;
    allData.items.forEach((item) => {
      allTasks.push([item.title]);
    });
  } while (pageToken);
  range = "Current!A:A"; // if I ever have more than 1000 tasks to do I'm either dead or throwing
  Sheets.Spreadsheets.Values.clear({}, sheetID, range); // clears only first row, did batch clear before, but there was no need
  if (allTasks.length < 1) {
    // no need to update it's already blank
    return;
  }
  Sheets.Spreadsheets.Values.update(
    {
      values: allTasks,
      majorDimension: "ROWS",
    },
    sheetID,
    range,
    {
      valueInputOption: "RAW",
      includeValuesInResponse: false,
      responseValueRenderOption: "FORMATTED_VALUE",
    },
  );
}

// new code
// function createTimeDrivenTrigger(period, task) { // takes in string of period(daily, weekly, monthly, e)
//     ScriptApp.newTrigger(
// }

// called from the extension through scripts.run to test the connection
function ping(msg) {
  // return only plain JSON values, Date objects don't serialize so use ISO strings
  return {
    msg: msg,
    user: Session.getEffectiveUser().getEmail(),
    at: new Date().toISOString(),
  };
}

// checks that a scripts.run call can create a trigger for the calling user
function installTriggerTest() {
  ScriptApp.newTrigger("ping").timeBased().everyHours(1).create();
  return ScriptApp.getProjectTriggers().length;
}
