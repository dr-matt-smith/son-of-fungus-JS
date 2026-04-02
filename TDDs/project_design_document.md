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



  - ✅ for all elements containing text, add a 'reset' button at the top left (inside the border), that resets the object shape and size to the default (i.e. when first dragged onto the canvas)
  
Version 4 features
==================

add features:
- ✅ add a 'Fit all' button to the left of the Zoom In button, that zoomes appropriately to fit all diagram elements on the screen
- ✅ the portion of the overall canvas being viewd should be arragned so diarram elements are near the top/bottom/left/right - so the diagram is zoom maximally to allow all elements to be seen
- ✅ ensure the mini-map is updated correctly to reflect this Fit All function when it has been clicked

Version 5 features 
==================

- ✅ connector (transition) mode, so user can click and drag to connect one state to another
- ✅ when a state is 'active' a little arrow tool appears just above its top-right corner, which allows the user to drag a connection from the active state to another
- ✅ this connection should have an arrow 2/3rds along its length showing its from the active state to its target
- ✅ when a state with one or more transition arrows is moved, all its connected arrows should move with it (as it drags - "elastic banding")

- ✅ multiple transition connectors between 2 objects
  - ✅ do NOT have double direction arrow transition connectors - each transition is a separate arrow
  - ✅ so, for example, if a transition connector is created from A to B, and there is already a connector from B to A, please show this as 2 separate transition connectors
  - ✅ if a transition connector is dragged from A to B, and there is already a connector from A to B, create a new transition connector from A to B (add curves to new transition connectors if neeed, to prevent them touching)

- ✅ each transition connectors should be selectable, and if selected should have a "x" icon appear next to it, to allow it to be deleted
  - ✅ NOTE - this "x" should be shown near the destination end of the transition connectors line
  - ✅ when the transition connector is de-selected, this "x" widget should be hidden again
- ✅ each transition connector should have text assopcated with it, default "transition"
  - ✅ when selected, the text can be double-clicked and edited, just like the text for state objects


Version 6 features
==================

- ✅ (auto text sized to fit) each time a text-containing element (state and choice) is resized, please change the font size so all text (including multi-line) can be seen (and is as large as will fit)


- ✅ (select and drag group of objects) allow user to drag a rectangle area of the canvas (if starting drag point is not on an object)
  - ✅ if this rectangle contains a single object, select that object
  - ✅ if this rectangle contains mulrtiple objects, select them all,so they can all be moved together
  - ✅ a click on the canvas will de-select this group of objects



Version 7 features
==================

- ✅ minimap - minimize/show - add a widget to the minimap "_" that makes it shrink to a box "minimap"
- ✅ when shrunk, clicking box "minimap" returns it to its normal size again

Version 8 features - zoom toolbar
==================
- ✅ create a zoom toolbar at the bottom LEFT of the screen
  - move the reset / zoom in/out and current %age tools to this toolbar

- ✅ add a zoom slider to the zoom toolbar

Version 9 features - naming start and end states
==================

- ✅ add text "start" and "end" to the start and end state objects
  - ✅ this text should be READ ONLY


Version 10 features - allow states to be deleted
==================

- ✅ when a state (general state, start, end) or choice object is selected, show a red "x" that when clicked will delete it
  - ✅ do NOT delete any transition connectors to/from the state, leave them with one end not connected
  - ✅ if a transition connectors with one or both ends unconnected is selected, add a connection "o" at each unconnected end, that can be dragged and connected to any state or choice object on the screen

Version 11 features
==================

- ✅ refactor the project as a Node Vite project

Version 12 features
==================

- ✅ write Vite tests for each of the features



Version 13 features
==================

- ✅  write a design document in TDDs for the requrements/plan to add playwright web tests to this project, 


Version 14 features
==================

- ✅ suggest any architectural refactoring to make this project easier to extend and test in the future in a new document "TDDS/future_improvements.md"


Version 15 features
==================

- ✅  the end state CANNOT have any transition connectors coming from it
  - ✅ so remove the start transition widget from this object 



Version 16 features
==================

- [] implement the improvements documented in the "future_improvements.md" plan
