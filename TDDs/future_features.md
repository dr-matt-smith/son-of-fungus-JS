




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



Version X features - command Set Variable
==================

- [] add a new Fungus command "Set Variable (value)"
  - [] the user chooses the variable to be set from the variables defined in the Variables tab
  - [] the user can enter a new value for the variable (of the appropriate data type)

- [] add a new Fungus command "Set Variable (copy another)"
  - [] the user chooses the variable to be set from the variables defined in the Variables tab
  - [] the user then chooses the variable whose value is to be copied into the variable to be set

- [] and add Vite and PlayWright tests for the above feature(s)



Version X features - XXXX
==================

- [] add a new tab "Variables"

- [] and add Vite and PlayWright tests for the above feature(s)



