
Version X features - simple debugger
==================

- [] rename the "Play All" run button to "Play"
- [] rename the "Step" run button to "Play (debug mode)"



- [] when "Play (debug mode)" is clicked
  -[] prepare a special, detailed, Run Log
  - [] this includes highlighting any Variable edits entered by the user during the debug run

- [] when "Play (debug mode)" is clicked
  - [] hide the Preferences if they are being shown
  - [] highlight the currently active Block (if a block is executing)
  - [] in the Inspector 
    - [] highlight the current command being executed in the Inspector,
      - [] and show its details in the bottom half of the inspector
  - [] show the Variables tab (and hide Enums and Events)
    - [] so the user can see that value of variables as well as the commands being executed for the current block in the Inspector
    - [] if any variables are referenced in the current block command being executed, these variables should be highlighted in the Variables tab
  - [] add a status bar across the top of the screen
    - [] this should display the current action, in the same wording as will be entered into the Run Log
  - [] if a block has a CALL command, highlight the transitioin arrow between that block and the one being called

- [] for an executing IF and ELSE-IF
  - [] highlight the conditional expressions, and also display if they are TRUE or FALSE
  - [] for a multi-part condition (using AND and OR) 
    - [] break down each step of the expression being evaluating as a step in the debugger

- [] allow the user to EDIT the value of a variable in debug mode

- [] when a call is made to a block
  - [] offer STEP OVER and STEP INTO options
    - so user can either jump through execution of the complete block
    - or step through each command in the block in sequence

- [] and add Vite and PlayWright tests for the above feature(s)



Version X features - enhance save JSON
==================

- [] add to the JSON export feature a popup
  - [] asking the user if they want the current values of variables to be saved

- [] and add Vite and PlayWright tests for the above feature(s)


Version X features 
==================

- [] AAAAA

- [] and add Vite and PlayWright tests for the above feature(s)
