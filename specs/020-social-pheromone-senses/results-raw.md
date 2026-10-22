# Social experiment: `world/world-forager-social.json`

Seeds: [101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130], 3000 ticks.

## social

Find: 96.1% [93.3%, 98.9%], feeding 48.9%
Approach (fruit): median 1011.500 ticks, 130 included / 37 excluded
Approach (floral): median 888 ticks, 138 included / 27 excluded
Danger escape-or-turn within window: 12.5% (34/272)
Time near (<=2 tiles): 3.6% [2.7%, 4.3%]
Contact rate (per minute): 0.200 [0.138, 0.264]
nnMedian: 9.406, contactDuration: 10.441, followingIndex: -0.048
songPerContact: 0, songPerTickAlone: 0
  by other-sex=female: nnMedian 9.260, timeNear 3.7%, contactRate 0.102, following -0.041, song/contact 0
  by other-sex=male: nnMedian 9.474, timeNear 3.2%, contactRate 0.098, following -0.080, song/contact 0

## ablated

Find: 96.7% [93.9%, 98.9%], feeding 49.2%
Approach (fruit): median 1164 ticks, 135 included / 32 excluded
Approach (floral): median 909 ticks, 138 included / 27 excluded
Danger escape-or-turn within window: 13.4% (37/277)
Time near (<=2 tiles): 4.0% [3.1%, 5.0%]
Contact rate (per minute): 0.218 [0.167, 0.276]
nnMedian: 9.504, contactDuration: 12.391, followingIndex: -0.067
songPerContact: 0, songPerTickAlone: 0
  by other-sex=female: nnMedian 9.878, timeNear 4.3%, contactRate 0.127, following -0.112, song/contact 0
  by other-sex=male: nnMedian 9.391, timeNear 3.7%, contactRate 0.091, following -0.082, song/contact 0

## random-graph

Find: 91.7% [87.2%, 95.6%], feeding 65.7%
Approach (fruit): median 997.500 ticks, 116 included / 51 excluded
Approach (floral): median 1011 ticks, 121 included / 44 excluded
Danger escape-or-turn within window: 7.7% (51/665)
Time near (<=2 tiles): 2.7% [1.9%, 3.7%]
Contact rate (per minute): 0.100 [0.073, 0.129]
nnMedian: 11.181, contactDuration: 6.146, followingIndex: -0.036
songPerContact: 0, songPerTickAlone: 0
  by other-sex=female: nnMedian 10.924, timeNear 2.7%, contactRate 0.053, following -0.075, song/contact 0
  by other-sex=male: nnMedian 11.474, timeNear 2.8%, contactRate 0.047, following -0.013, song/contact 0

## random-walk

Find: 70.6% [63.9%, 77.2%], feeding 0.0%
Approach (fruit): median 726 ticks, 78 included / 89 excluded
Approach (floral): median 887 ticks, 84 included / 81 excluded
Danger escape-or-turn within window: 4.7% (22/466)
Time near (<=2 tiles): 4.3% [2.9%, 5.8%]
Contact rate (per minute): 0.142 [0.096, 0.191]
nnMedian: 14.046, contactDuration: 7.823, followingIndex: 0.067
songPerContact: 0, songPerTickAlone: 0
  by other-sex=female: nnMedian 13.477, timeNear 4.7%, contactRate 0.076, following 0.058, song/contact 0
  by other-sex=male: nnMedian 14.203, timeNear 4.1%, contactRate 0.067, following 0.054, song/contact 0

## SC-004 verdict

social time-near beats random-graph: false, beats random-walk: false
social contact-rate beats random-graph: true, beats random-walk: false
ablated time-near also beats random-walk: false (if true, the effect is not shown to be pheromonal)

