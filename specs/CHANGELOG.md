# Changelog

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
