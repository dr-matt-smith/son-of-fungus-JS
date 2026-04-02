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
  - ✅ when text being edited, allow SHIFT+ENTER for multi-line text
- ✅ the basic 'state' can have its text changed
  - ✅ when it is clicked, if it's not being dragging then it becomes 'active', and highligherd, and a double click allows its text to be edited
  - ✅ when text being edited, allow SHIFT+ENTER for multi-line text
  - ✅ also its width and height can be edited, bt moving drag-handlers (N/S/E/W and on each corner)

  - ✅ for all elements containing text (state and choice) change the font size so all text (including multi-line) can be seen
    - ✅ (update each time the element resized)
    - ✅ when text is added, font size will need to get smaller
    - ✅ when text is removed, font size will need to get bigger

  - ✅ for all elements containing text, add a 'reset' button at the top left (inside the border), that resets the object shape and size to the default (i.e. when first dragged onto the canvas)
  
Version 4 features
==================

add features:
- ✅ add a 'Fit all' button to the left of the Zoom In button, that zoomes appropriately to fit all diagram elements on the screen
- ✅ the portion of the overall canvas being viewd should be arragned so diarram elements are near the top/bottom/left/right - so the diagram is zoom maximially to allow all elements to be seen
- ✅ ensure the mini-map is updated correctly to reflect this Fit All function when it has been clicked

Version 5 features
==================

[] allow user to drag a rectangle area of the canvas (if starting drag point is not on an object)
  - [] if this rectangle contains a single object, select that object
  - [] if this rectangle contains mulrtiple objects, select them all,so they can all be moved together
  - [] a click on the canvas will de-select this group of objects

Version 6 features 
==================

- ☐ connector (transition) mode, so user can click and drag to connect one state to another
- ☐ when a state is 'active' a little arrow tool appears just above its top-right corner, which allows the user to drag a connection from the active state to another
- ☐ this connection should have an arrow 2/3rds along its length showing its from the active state to its targer
- ☐ when a state with one or more transition arrows is moved, all its connected arrows shoudl move with it

Version 7 features
==================

- ☐ refactor the project as as Node Vite project
  and add Vite tests for each of the features

- ☐ also write a design document in TDDs for the requrements/plan to add playwright web tests to this project, and suggesting any architectural refacting to make this project easier to extend and test in the future
