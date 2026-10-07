# Changelog

# 2026-10-06

/speckit-specify World map requires recalibration:
1. Only three edible (food) object, each cast odor on the distance proportional to its size. Odor is max at the edible (food) object position. Small food unit is `red_flower_plant`; Medium food unit is `jungle-plant-010`; Large food unit is `jungle-plant-015`. Food is distributed on the map so that there are still areas without odor but fly has a chance to move through the world following the odor.
2. Odor is connected to food units and its size.
3. Remove following object from the map permanently: `jungle-plant-016`, `jungle-plant-017`, `jungle-bush-018`.
4. Declassify following object, which are marked as edible toward decor:  `yellow_flower_single`, `yellow_flowers_trio`, `yellow_flowers_cluster`.
5. Make the fly sprite 32x32 and make it look like a fruit fly.

/speckit-plan Recalibrate all variants of the world map implemented by the app.


# 2026-10-05

/speckit-specify Split the view port into the world and right side panel that shows a status of fly. The fly status consits of
* Action the fly is taken
* Visualization of the brain neurons and aggregated spike activation over past ticks. The user should be able what part of brain has been active recently
* Input signals on Left (L) and Right (R) channels (visualized as bars, one row per channel). Visualization per channel (e.g. food odor, danger, etc). The channes as supported by the LIF and Brain.
* Output signals on Left (L) and Right (R) channels (visualized as bars, one row per channel). Visualization per channel (e.g. leg motor, wing motor etc). The channes as supported by the LIF and Brain. 

The panel and channels visualization has to be extendible to the capabilities enabled in the brain and LIF.

/speckit-plan Make the feature adaptable to brain capabilities. If the declaration of brain capabilities is needed it is a time to adjust the export and brain snapshot again. Use three.js to visualize the brain point cloud and fade-in / fade-out animation to visualize neuron activities. The panel and channels visualization has to be extendible to the capabilities enabled in the brain and LIF so that development of new channel would not break everything out.

/speckit-bugfix-report A single panel shows both list of fly and status for each. Convert it into the tabs based expereince. The "world" tab shows list of fly, the "fly" tab shows the status. The fly status panel consumes alot of space when Left / Right channel indicates takes a row. Make a one row of Left and Right indicator, zero in the middle. The left signals are shown as bar from middle to left side of panel and right channel from middle to right side of panel. Use colors to distinguish values.   

--

/speckit-specify Add the odor layer to the world as  toggable layer (off by default). The layer uses transparent gradients to show odor intensity at the point in the world. 

/speckit-plan Implement the odor lavel toggle in the world tab. Use the arcade style visibility toggle. Draw the odol intesity as heatmap style over the world map. 

--

/speckit-specify Write an utility to parse malecns dataset, extract the brain as defined by ADR 003-hungry-forager-brain.md. This brain should enable the fly behave like a hungry animal. It should smell food from a distance, walk toward it, stop on it, eat for a while, and leave when it is full. Integrate the brain into LIF and simulator. Keep existing LIF, brains available under the version v0 (lif-v0.js, etc). Allow user to choose between mock, small brain v0 and the new brain v1 via config. Make sure the extractor is able to produce multiple brain formats.

/speckit-plan Write an utility to parse malecns dataset, extract the brain as defined by ADR 003-hungry-forager-brain.md Preserve compatibility of the simulator with previous versions allowing user to choose between mock, small brain v0 and the new brain v1 via config. The goal is comparision of various brain behaviours. 

/speckit-bugfix-report The side panel does not show the hunger level for the fly (report it on side panel using the bars from 0 to 100%). Fly is never pauses at the food place, fly are only moving. Taste neurons does not show any activity. The poincloud of neuron's activity does not show too much activities to compare with simple brain. It is not clear if brain functioning correctly.   

# 2026-10-04

/speckit-specify Setup the infrastructure for the app development. Create a world in the style of 90x arcade games. The world is scrollable and zoomable with mouse. The world has grass, trees, water, rocks, etc. It has a eadable elements fruits, honey and danger fires, spiders. The world is renderable in the browser and configurable via json so that in the future it can be changed. 

/speckit-plan Either discover an open assets in the internet to create a world or try to reuse them from `assets` folder (unformtunately, I do not know it format). The world is inspired by https://github.com/a16z-infra/ai-town (do not re-use any ReactJS assets). Create the world assets, its json config and all required html/css/js file in `public` folder. 

--

/speckit-specify A LIF core, a seeded random graph, and a two-channel fly network to validate integrations and engine before a real network to be integrated. ADR 001-lif-toy-network-and-fly-integration.md the "toy" network and its integration to the world. As an outcome, the world runs six fly each powered by own worker running toy LIF network.

/speckit-plan Follow ADR 001-lif-toy-network-and-fly-integration.md to implement "toy" LIF network as web worker, integrated them into the world.

--

/speckit-specify Write an utility to parse malecns dataset, extract smallest feasible brain topology as defined by 002-smallest-functional-brain into the data format and integrated it with simulator. Existing toy fly mock has to still be fully functional and be exchangable via config. 

/speckit-plan Write the extraction utility in python. Make a decision about the serialization format for the graph, keep in-mind that full brain might be injected. Use the domain langauge established at malecns.md to configure the utility but make configurability minimal covering only ADR needs 002-smallest-functional-brain. Validate the utility with real brain extraction and integrating into lif.js. Keep existing mock implementation alive and configurable. The goal is comparision of both methods of brain modelling (random vs nature). 

--

/speckit-specify Create a visual inspection of brain snapshot as point cloud with edges, similar to inspector of the dataset malecns-3d.html (keep malecns-3d.html unchange, implement a parallel version at `public/brains` so that it is loadable through webserver as simulation). If the brain snapshot does not conatin 3d dimensional data as available at main dataset extend it, it would be required for further visualization inside the world.

/speckit-plan Update the data extractor to carry 3d data point. It is nessesary for the brain inspectof and further visualization features. Implement a brain inspector similar to `inspector/malecns-3d.html` inside `public/brains` so that user can switch throught different brains available in the simulator. Keep similar level filering and annotations as `inspector/malecns-3d.html` has.

--

/speckit-specify The world is large for six inhabitants and lack pixel perfect details to be expected for moder RPG style games. The new details assets for the world constructions has been released into `public/assets/atlas`. This change is also driving an ability to represent a real maps in the future. Adopt the new tileset and create a diverse map environment: with water and rocks on the shore; grass with plantsm flowers and bushes; standalone trees and mid size group of trees. 

/speckit-plan Adopt high resolution assets for the world creation `public/assets/atlas`. Use `OBJECTS.md` to understand the assets and its usage. The assets does not give you equal size tiles, therefore the world architecture and notation has to be redefined where drawn scene is one layer but "tile" to control the fly is another layer. Adopt the new tileset and create a diverse map environment: with water and rocks on the shore; grass with plantsm flowers and bushes; standalone trees and mid size group of trees. Do not make any animated water, keep drawing a static map (only fly are animated). 

About your decision:
* "The new tileset has no grass-to-water edge tiles, so shorelines are built from rock and pebble art." There should be water to sand and sand to grass, use it. If you cannot find suitable combination keep you decision.
* "Fruits, honey, fires, spiders and the flies keep their current behaviour and art. Only their placement and scale change." The new dataset provides enough object to represet eadable objects (e.g. fruits, flowers, honey) use it. It has also a few representing danger (skull_spear_banner, campfire_logs, oil_lantern_post) use it.   

/speckit-bugfix-report Choosen tiles to express the world partually correct, it makes a world drawing corrupled. 
* `beach-terrain-001` do not use it. there are no reliable sand to grass transition. Remove sand completly.
* Usage of  `beach-rock-001`, `beach-rock-002`,  `beach-rock-003` for shore visualization is wrong this sprites are object to be overlay over terrain and water. Use `beach-plant-001`, `beach-plant-003` as transition from water to grass, it might require rotations. Use from `beach-plant-013` to `beach-plant-017` as decoration objects on terrain object nearby water.
* Do not use `rocks2-terrain-004`, `rocks2-terrain-005`, `rocks2-terrain-006`, `rocks2-terrain-007`, they are one color solid tiles. Instead use `rocks2-terrain-009`, `outcrop_medium_grass`, `beach-terrain-011`. Its usage might require multi layering
* Add more explicit flowers `jungle-bush-018`, `jungle-plant-016`, `trees-plant-005`, `jungle-plant-010`, `jungle-plant-015`. Remove `jungle-prop-001` honey
* Make the fly sligtly bigger to be aligned with 22 x 22 pixes.  

/speckit-bugfix-report The world still fails to render the water ponds and lakes. Use the patterns as defined by /Users/kolesnik/devel/go/src/github.com/fogfish/zrpg-art/examples (check WATER-SPEC.md) to render one medium size lake and few small ponds in the world. Do not use a water animation.

/speckit-bugfix-report Spread the flowers and danger objects around the world. Remove `jungle-prop-002` as danger object. 

