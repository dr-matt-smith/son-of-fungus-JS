I want to create a prototype of a simple state chart style tool, for a visual programming langauge
It should:
- be a diagram editor, that takes up 100% of the available web page
- use Vanilla JavaScript (not use any Node library, and not TypeScript)
- folder structure
  - index.html
  - /images
  - /css
  - /js
  - /js/data/<JSON files>


Version 1 features
==================
- ✅ have a toolbar across the top of the screen with the following tools
  - ✅ zoom in
  - ✅ zoom out
  - ✅ new 'state' (simple rectangle for now - can be dragged into diagram)
  - 
- ✅ add a minimap feature, located at the bottom-right of the page, allowing scrolling if the diagram cannot all fit on screen at the current zoom level
  - ✅ clearly show a rectangle in the minimap, outlining what is visible in the main page
  - ✅ this rectangle can be draged around the minimap, and the main page will scroll appropriattely 

Version 2 features
==================

- ✅ allow mouse scroll wheel to zoom in and out
- ✅ allow mouse middle button DOWN to allow dragging of canvas, also have a hand tool in the tool bar, also show the hand mouse cursor when dragging


Version 3 features
==================

add to the toolbar:
- ✅ new start state (can be dragged into diagram)
- ✅ new end state (can be dragged into diagram)
- ✅ new choice (diamond) node (can be dragged into diagram)
- ✅ the basic 'state' can have its text changed
  - ✅ when it is clicked, if it's not being dragging then it becomes 'active', and highlgihed, and a double clikc allows its text to be edited
  - ✅ also its width and height can be editoed, bt moving drag-handlers (N/S/E/W and on each corner)

Version 4 features
==================

add features:
- [] add a 'Fit all' button to the left of the Zoom In button, that zoomes appropriately to fit all diagram elements on the screen
- the portion of the overall canvas being viewd should be arragned so diarram elements are near the top/bottom/left/right - so the diagram is zoom maximially to allow all elements to be seen
- ensure the mini-map is updated correctly to reflect this Fit All function when it has been clicked

Version 5 features 
==================

- ☐ connector (transition) mode, so user can click and drag to connect one state to another
- ☐ when a state is 'active' a little arrow tool appears just above its top-right corner, which allows the user to drag a connection from the active state to another
- ☐ this connection should have an arrow 2/3rds along its length showing its from the active state to its targer
- ☐ when a state with one or more transition arrows is moved, all its connected arrows shoudl move with it

Version 6 features
==================

- ☐ refactor the project as as Node Vite project
  and add Vite tests for each of the features

- ☐ also write a design document in TDDs for the requrements/plan to add playwright web tests to this project, and suggesting any architectural refacting to make this project easier to extend and test in the future
