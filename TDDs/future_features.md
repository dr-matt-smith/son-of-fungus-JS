


Version XXX features - naming start and end states
==================

- [] add text "start" and "end" to the start and end state objects
  - [] this text should be READ ONLY



Version 9 features
==================

- ☐ refactor the project as a Node Vite project
  and add Vite tests for each of the features

- ☐ also write a design document in TDDs for the requrements/plan to add playwright web tests to this project, and suggesting any architectural refacting to make this project easier to extend and test in the future

Version 7 features - allow states to be deleted
==================

- [] when a state (general state, start, end) or choice object is selected, show a red "x" that when clicked will delete it
  - [] do NOT delete any transition connectors to/from the state, leave them with one end not connected
  - [] if a transition connectors with one or both ends unconnected is selected, add a connecton "o" at each unconnected end, that can be dragged and connected to any state or choice object on the screen


