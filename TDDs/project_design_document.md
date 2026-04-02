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
- have a toolbar across the top of the screen with the following tools
  - zoom in
  - zoom out
  - new 'state' (simple rectangle for now - can be dragged into diagram)
  - 
- add a minimap feature, located at the bottom-right of the page, allowing scrolling if the diagram cannot all fit on screen at the current zoom level
  - clearly show a rectangle in the minimap, outlining what is visible in the main page
  - this rectangle can be draged around the minimap, and the main page will scroll appropriattely 

Version 2 features
==================

- allow mouse scroll wheel to zoom in and out
- allow mouse middle button DOWN to allow dragging of canvas, also have a hand tool in the tool bar, also show the hand mouse cursor when dragging


Version 3 features
==================

add to the toolbar:
  - new start state (can be dragged into diagram)
  - new end state (can be dragged into diagram)
- new choice (diamond) node (can be dragged into diagram)

Version 4 features 
==================

  - connector (transition) mode, so user can click and drag to connect one state to another




