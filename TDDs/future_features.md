

Version X features - settings button / events tab
==================


- [] change the tab "Messages" to "Events"

- [] remove the "Settings" tab, and instead have a "Settings" button (with a Cog icon) at the top right of the screen
  - [] when pressed the Inspector/Events tabs are hidden, and a Settings tab takes over this right-hand side of the screen
  - [] have a "Close Settings" button
  - [] when the settings is being shown, it should show the Fungus/State Chart modes that are currently in the Settings Tab

- [] and add Vite and PlayWright tests for the above feature(s)


Version X features - variables
==================


- [] add a new tab "Variables"
  - [] introduce global variables (for both fungus and state chart modes)
  - [] this should allow the user to add/remove/edit global variables
  - [] variables can be of types: Boolean / Integer / Float / String
    - [] when Enum is selected, the user chooses from one of the Enum sets declared in the Enums tab


- [] and add Vite and PlayWright tests for the above feature(s)





Version X features - enums
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





