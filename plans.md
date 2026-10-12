# Functionality

- add tasks to be randomly assigned per day/week/month
- categories of different types of tasks
  - have each category be editable
- set how many of a specific category is added(default is 1)
- add option to auto delete them after day is over(auto cleans up the task)
- Visualization of completion

# Needed from user(frontend needs)

- google account login
  - access to read and write to task list selected
- which categories and what tasks are in the categories
- when what categories should be triggered(Ex. daily, weekly, monthly, etc) and how many tasks are added on that trigger(default 1, but can be set to 100)

# visualization(later)

- everything original program did and a bit more
- give charts on percentage of times they finish tasks(Ex. 11% of all tasks completed are done at 11pm)
- charts on how many tasks they finish per day on average(20% of time you finish 2 tasks a day, 32% you finish 0 a day)
- chart on what days they finish most of their tasks(11% monday, 2% tuesday, .., 24% friday, etc.)

# What I do(backend)

- set up the automatic triggers
- store all the categories in storage.json and tasks the user wants
- (later) aggrete data to display is visualization tab
