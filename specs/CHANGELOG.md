# Changelog

# 2026-10-04

/speckit-specify Setup the infrastructure for the app development. Create a world in the style of 90x arcade games. The world is scrollable and zoomable with mouse. The world has grass, trees, water, rocks, etc. It has a eadable elements fruits, honey and danger fires, spiders. The world is renderable in the browser and configurable via json so that in the future it can be changed. 

/speckit-plan Either discover an open assets in the internet to create a world or try to reuse them from `assets` folder (unformtunately, I do not know it format). The world is inspired by https://github.com/a16z-infra/ai-town (do not re-use any ReactJS assets). Create the world assets, its json config and all required html/css/js file in `public` folder. 

/speckit-specify A LIF core, a seeded random graph, and a two-channel fly network to validate integrations and engine before a real network to be integrated. ADR 001-lif-toy-network-and-fly-integration.md the "toy" network and its integration to the world. As an outcome, the world runs six fly each powered by own worker running toy LIF network.

/speckit-plan Follow ADR 001-lif-toy-network-and-fly-integration.md to implement "toy" LIF network as web worker, integrated them into the world.
