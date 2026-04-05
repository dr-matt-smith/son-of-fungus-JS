

Version X features - save variables between flowchart runs
==================

- [] for each variable in the Variables tab
  - [] add an option for it to be SAVED

- [] and add Vite and PlayWright tests for the above feature(s)

Version X features - move variables to sepearate  tab on let of screen
==================

- [] rename the "Play All" run button to "Play"
- [] rename the "Step" run button to "Play (debug mode)"



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
    - [] if any variables are referenced in the current block command being executed, these variables should be highlighed in the Variables tab
  - [] add a status bar across the top of the screen
    - [] this should display the current action, in the same wording as will be entered into the Run Log
  - [] if a block is executing a command, that block should be highlighed
  - [] show the inspector
  - [] 

- [] and add Vite and PlayWright tests for the above feature(s)


Version X features - characters, portraits
==================

- [] extend variables to be of types: Boolean / Integer / Float / String / Enum
  - [] when Enum is selected, the user chooses from one of the Enum sets declared in the Enums tab

- add a new tab "Enums"
  - [] this allows the user to declare named sets of enumerations (which can be then chosen as a type for a variable, and also the new menu command)
  - [] each enum has a value that has to be in UPPER_SNAKE_CASE
    - [] each enum can also have a "String alternative" value entered (which can be any string value)
    - [] these string values are the default to be displayed for Enum Menu choices

- [] refine Menu commands
  - [] rename the existing Menu command to "String Menu"
  - [] add a new Command type for blocks "Enum Menu"
    - [] the choices for Enum Menu items will be the String alternative for an enum (if defined), otherwise the UPPER CASE enum value itself

- [] and add Vite and PlayWright tests for the above feature(s)