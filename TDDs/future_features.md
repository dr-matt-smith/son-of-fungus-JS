
Version X features - move variables and events and enums to separate tab on let of screen
==================

- [] move the Variables and Events and Enums tab to be a separate column on the LEFT hand side of the screen
  - so the Inspector is alone on the right-hand side of the screen

- [] Arrange Variables and Enums and Events as 3 rows of this left-hand column
- [] have an arrow widget, allowing this whole column to be minimised / revealed
- [] allow this column to have its width resized (just like the inspector)
  - [] default to 25% of the screen

- [] allow the dividers between Variables and Enums and Events to be moved
  - [] default them to 1/3rd of the height each
  - [] also add buttons for the row headings for each allowing them to be minimised and expanded

- [] and add Vite and PlayWright tests for the above feature(s)


Version X features - load from JSON
==================

- [] add a button LOAD JSON
  - [] this accepts the text from a JSON export and will re-create the flowchart
  - [] add a popup asking the user if they are sure, since it will mean losing any existing work

- [] and add Vite and PlayWright tests for the above feature(s)





Version X features - simple debugger
==================

- [] rename the "Play All" run button to "Play"
- [] rename the "Step" run button to "Play (debug mode)"

- [] when "Play (debug mode)" is clicked
  - [] show the Inspector as ususal
    - [] highlight the current command being executed in the Inspector,
      - [] and show its details in the bottom half of the inspector
  - [] show the Variables tab
    - [] so the user can see that value of variables as well as the commands being executed for the current block in the Inspector
    - [] if any variables are referenced in the current block command being executed, these variables should be highlighted in the Variables tab
  - [] add a status bar across the top of the screen
    - [] this should display the current action, in the same wording as will be entered into the Run Log
  - [] if a block is executing a command, that block should be highlighed
  - [] show the inspector
  - []

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
