

Version X features - new commands "IF <condition>" and "END-IF"
==================

- [] add a new Fungus command "IF <condition>"
  - [] the user chooses the variable to be set from the variables defined in the Variables tab
  - [] the user can choose a comparison operator (equals / not equals / < / <= / > / >=)
  - [] the user can enter a variable or literal value to 
  - [] all commands until "End-If" below an "If" are indented
    - [] and only executed if the IF's condition was true
- [] add a new Fungus command "End-If"
  - [] this ends the indendation of other commands
  - [] and ends the sequence of commands to be only executed when the IF condition was true

- [] add a new Fungus command "END-IF"
  - [] when an IF is added, an "END-IF" is automatically added after it
  - [] also between the IF and END-IF a placeholder command (indented) is added (with an + Add command dropdown)

- [] and add Vite and PlayWright tests for the above feature(s)



Version X features - new commands "ELSE-IF <condition>" and "ELSE"
==================

- [] add a new Fungus command "ELSE-IF <condition>"
  - [] this adds functionality to exectue if the previous IF's and ELSE-IFs conditions were not true, and the condition for this ELSE-IF is true
  - [] ELSE-IF should be indented at the same level as "IF"
    - commands following ELSE-IF should be indented, until another ELSE-IF, or ELSE, or END-IF

- [] add a new Fungus command "ELSE"
  - [] this adds functionality to exectue if the previous IF's and ELSE-IFs conditions were not true, 
  - [] ELSE should be indented at the same level as "IF"
    - commands following ELSE should be indented, until END-IF

- [] and add Vite and PlayWright tests for the above feature(s)


