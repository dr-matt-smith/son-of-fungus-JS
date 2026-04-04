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

- ✅ implement the improvements documented in the "future_improvements.md" plan


Version 17 features
==================

- ✅  separate the CSS into separate files
  - ✅ the minimap styles in one file
  - ✅ the main toolbar   styles in one file
  - ✅ the zoom toolbar   styles in one file
  - ✅ the choice node  styles in one file
  - ✅ the connectors node  styles in one file

- ✅ update index.html to read in all the separate CSS files



Version 18 features
==================

- ✅  start states CANNOT have any transition connectors going into them
  - ✅ refuse to link transition connections that would link INTO a start state


Version 19 features
==================

- ✅  create a separate "inspector" panel on the right side of the page (about 30% of page width - but allow user to drag to change the width of this divider)
  - ✅ when an object (state or choice or transition) is selected, its properties should be shown in this inspector panel on the right of the screen
  - ✅ properties include - object type / object name
- ✅ the JS of the page should store in memory a JSON array of object types and their properties
- ✅ add an "Export to JSON button" which serialises the diagram structure as JSON - for now just popup a window showing the JSON representing the state chart diagram


Version 20 features
==================

- ✅ view the fungus wiki pages at: https://github.com/snozbot/fungus/wiki
  - ✅ ignore anything about the Unity game engine, since we are recreating Fungus here as a JavaScript visual programming system
  - ✅ focus especially the pages for flowcharts, blocks, variables, telling a story, playing audio, conversation system, narrative text tags
- ✅ add an execution model for a state chart/fungus style flow chart, based on the Fungus documentation
  - ✅ this means different node (state) types
  - ✅ different events
  - ✅ a sequence of commands, shown in the right-hand inspector panel, when each node is being executed
- ✅ the fungus examples code may be useful: https://github.com/snozbot/fungus/tree/master/Assets/FungusExamples

Version 21 features
==================

- ✅ move the hand tool to bottom left, into zoom toolbar

- ✅ and add Vite and PlayWright tests for the above feature(s)

Version 22 features - edit block name in inspector panel
==================

- ✅ when a state/block is selected, allow its name to be edited in the inspector panel on the right
  - ✅ and the state/block name should change in the diagram dynamically as the user types

- ✅ and add Vite and PlayWright tests for the above feature(s)

Version 23 features - Fungus Flowchart mode
==================

- ✅ please add a settings 'cog' at the top right of the screen
  - ✅ this should have choice of diagram 'mode'
    - ✅ (default) State Chart Diagram mode
      - ✅ (the current look and feel)
    - ✅ Fungus FlowChart mode
      -(see below)

✅ Fungus FlowChart mode - detailed design
- ✅ for this mode should hide 'start' and 'end' nodes, and transitions
- ✅ blocks should be styled according the rules here: https://github.com/snozbot/fungus/wiki/blocks
  - (so Event blocks, Branching blocks, Standard block)
- ✅ just as for Fungus, add the (read only, unlabelled) transition automatically when calls are made from one block to another


- ✅ rather than a settings Cog, have tabs at the top right of the screen, to switch between Inspector panel and Settings panel  
  - ✅ this should have choice of diagram 'mode' should be by named radio button, also showing a little example diagram with a couple of objects in it - so gthey can see the mode they are changing to

- ✅ and add Vite and PlayWright tests for the above feature(s)


Version 24 features - move JSON export button & change from settings cog to tabs
==================

✅ remove  choice block from toolbar when Fungus mode

✅ when in fugus mode, default name should be "New Block 1", "New Block 2" etc. (in state mode, State 1, State 2 etc.)
  - ✅ and in the toolbar, the widget should be labelled 'Block' not 'State'

Remove past Inspector details for deleted / unselected object
- ✅ when an object is deleted, the Inspector panel should be blank, since not object is selected
  - ✅ this should be true at any other time when no object is selcted
  - ✅ when a group of objects is selected, the Inspector panel should be blank
  - ✅ so the Inspector only shows settings when an object is selected

move JSON button
- ✅ move the export to JSON button out of the inspector, so it is at the top right of the canvas

- ✅ and add Vite and PlayWright tests for the above feature(s)

Version 25 features
==================

✅ swap the order in the settings tab - make fungus first here, and also make fungus mode the default

✅ at the top LEFT of the screen, show the curently active MODE "Fungus Mode"/"State Chart Mode" , and a note "(change in Settings tab)"

✅ when in Fungus mode, rather than just a Play button:
- ✅ have a Play All button
- ✅ have a "Play Step by Step" button
  - ✅ which will play one step, and then pause, and offer buttons to STOP and Continue when in Step mode and not all blocks have finished
  - ✅ so a bit like a simple debugger

- ✅ and add Vite and PlayWright tests for the above feature(s)

Version 26 features
==================

- ✅ allow the export JSON text to be SELECTED, in fact add a little copy to clickboard icon at the top right of this popup please

- ✅ in fugus mode, remove the block resize widgets, and increase the default font size for text in these blocks

- ✅ and add Vite and PlayWright tests for the above feature(s)


Version 27 features
==================

- ✅ add a "Run Log" button, next to the Export JSON button
  - ✅ this should be a timestamped log of the seqauence of the execution of the flowchart
  - ✅ it should be reset each time Play All is clicked
  - ✅ just like JSON it should be selectable, and a button to copy it to the clickboard

drop down of audio files
- ✅ for the Audio URL of a Play Sound command, please add a drop-down menu, listing the URLs for all the sounds in the /audio folder (and any sub-folders of audio)
  - [] show the path, e.f. /audio/die.mp3 and /audio/food_sounds/yum.mp3
- ✅ please test that the sound actually plays, for each sound in the /public/audio folder

- ✅ and add Vite and PlayWright tests for the above feature(s)


Version 28 features - run log style
==================


- ✅ improve the style of the run logs, using the following style please:
  - ✅ note <id>: <block name>:
  - ✅ note when a block is entered add astrisks, e.g. "*Enter block*:"

``` old style
[10:43:31.905] Execution started — entry block: "New Block 1" (id:1)
[10:43:31.905] Enter block: "New Block 1" (id:1)
[10:43:31.906] Wait: 2s
[10:43:33.907] Play sound: /audio/food_sounds/yum.mp3
[10:43:33.909] Call: "New Block 2" (mode: stop)
[10:43:33.909] Enter block: "New Block 2" (id:2)
[10:43:33.910] Say: Block 2: goodbye from Block 2
[10:43:34.514] Execution complete
```

``` new style
[10:43:31.905] Execution started — entry block: "New Block 1" (id:1)
[10:43:31.905] *Enter block*: "New Block 1" (id:1)
[10:43:31.906] 1: New Block 1: Wait: 2s
[10:43:33.907] 1: New Block 1: Play sound: /audio/food_sounds/yum.mp3
[10:43:33.909] 1: New Block 1: Call: "New Block 2" (mode: stop)
[10:43:33.909] *Enter block*: "New Block 2" (id:2)
[10:43:33.910] 2: New Block 2: Say: Block 2: goodbye from Block 2
[10:43:34.514] Execution complete
```

- ✅ and add Vite and PlayWright tests for the above feature(s)




Version 29 features - fungus block default style & event annotation
==================


- ✅ in fungus mode, when a block is first dragged onto the canvas, it should be styled as a 'standard block' - since it isn't triggered by an event, and calls not other blocks

- ✅ when a fungus style block has an event trigger selected, please annotate this on the diagram in the style shown in this screenshot "<eventName>":

![block event annotation](/screenshots/fungus_block_event_annotation.png)


- ✅ and add Vite and PlayWright tests for the above feature(s)




Version 30 features - fungus wait until finished before continue audio option
==================

- ✅ in fungus mode, for the play sound command, add an option about whether to wait for the sound to finish playing:
  - ✅ "Wait for sound to finish playing"

  
- ✅ and add Vite and PlayWright tests for the above feature(s)




Version 31 features - improve some fungus block features
==================


- ✅ in fungus mode, when a new block is dragged onto the stage, once the mouse is released, the new block should be selected and its properties displayed in the Inspector

- ✅ in fungus mode, in its properties in the Inspector, move the editable block 'Name' form input to the top of the Inspector, and add a new 'Description' text area immediately below the 'Name' input

- ✅ in fungus mode, in its properties in the Inspector, hide the following:
  - ✅ Size
  - ✅ Position
  - ✅ Connections

- ✅ in fungus mode, when a block is selected on teh stage, add a Right mouse button menu offering options:
  - ✅ Delete
  - ✅ Duplicate
- ✅ also, remove the red delete "x" widget for blocks in Fungus mode

- ✅ and add Vite and PlayWright tests for the above feature(s)




Version 32 features - improve some fungus inspector features
==================


- ✅ in fungus mode, for a block's properties in the Inspector:
  - ✅ replace the table listing type/state = ID/1, and just write id = 1 as readonly to the right of the row saying "NAME"
    - e.g. "NAME                      id: 1"

- ✅ and add Vite and PlayWright tests for the above feature(s)





Version 33 features - improve some fungus inspector features
==================


- ✅ in fungus mode, for a block's properties in the Inspector:
  - ✅ replace label "EVENT TRIGGER" with "Execute on Event"
  - ✅ move the dropdown event list to the right of this label

- ✅ in fungus mode, if a description has been written, then display this description below the block on the diagram (and update it in real-time as the description is edited)
  - do this in a similar style to this screenshot ![description appears below block on stage](/screenshots/fungus_block_description_on_stage.png)

- ✅ and add Vite and PlayWright tests for the above feature(s)




Version 34 features - move minimap away from inspector area
==================


- ✅ please move the minimap to the bottom right of the stage
  - ✅ so it does not / cannot be in the Inspector region in the right-hand side of the screen

- ✅ and add Vite and PlayWright tests for the above feature(s)




Version 35 features - add some diagram feaures and make messages more rigorous
==================


- ✅ for all modes, in the diagrams show the ID of a block/state in small text at the top right inside the shapes border
  - ✅ e.g. "id: 1"

- ✅ in fugus mode, add a new tab "Messages"
  - ✅ allow the user to add/edit/delete a list of event messages

- ✅ for fungus block command "Send Message"
  - ✅ make the message now come from a drop-down list of messages defined in the Messages tab

- ✅ for fungus block EXECUTE ON EVENT  "Message Received"
  - ✅ make the message to send be from a drop-down list of messages defined in the Messages tab

- ✅ for fungus block which has EXECUTE ON EVENT  "Message Received" defined
  - ✅ in the diagram, below its title <Message Received>, add a line stating the name of the message


- ✅ and add Vite and PlayWright tests for the above feature(s)




Version 36 features - add command list summary, and details editor in Inspector
==================

- ✅ in Fungus mode, improve the Inspector
  - ✅ have a list of Commands for the block
  - ✅ allow one of this list to be selected (highlight with Green background)
  - ✅ create a command editor section at the bottom of the Inspector panel, where properties for the currently selected command can be edited
  - ✅ use this screenshot as a design guide: ![fungus command summary and editor mock up screenshot](/screenshots/fungus_command_summary_and_editor.png)

- ✅ and add Vite and PlayWright tests for the above feature(s)

Version 37 features - add command list summary refinement
==================

- ✅ in Fungus mode, improve the Inspector for the list of Commands for the block
  - ✅ make the list more like rows in a table
  - ✅ have the command verb on the left
  - ✅ and a summary of the command properties in the middle/right
  - ✅ use this screenshot as a design guide: ![fungus command row detail](/screenshots/fungus_command_rows.png)

- ✅ add move up/ move down arrows in the command summary row, before the name of the command
  - ✅ and remove these arrows from the details of the selected command

- ✅ and add Vite and PlayWright tests for the above feature(s)

Version 38 features - settings button / events tab
==================

- ✅ change the tab "Messages" to "Events"

- ✅ remove the "Settings" tab, and instead have a "Settings" button (with a Cog icon) at the top right of the screen
  - ✅ when pressed the Inspector/Events tabs are hidden, and a Settings tab takes over this right-hand side of the screen
  - ✅ have a "Close Settings" button
  - ✅ when the settings is being shown, it should show the Fungus/State Chart modes that are currently in the Settings Tab

- ✅ and add Vite and PlayWright tests for the above feature(s)




