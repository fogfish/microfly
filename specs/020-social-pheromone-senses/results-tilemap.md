# Social experiment: `world/world-forager-social-tilemap.json`

Seeds: [101,102,103,104,105,106,107,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130], 3000 ticks.

## social

Find: 95.6% [92.2%, 98.3%], feeding 56.2%
Approach (floral): median 1058 ticks, 120 included / 44 excluded
Approach (fruit): median 1000 ticks, 116 included / 52 excluded
Danger escape-or-turn within window: 10.7% (41/383)
Time near (<=2 tiles): 5.7% [4.7%, 6.8%]
Contact rate (per minute): 0.349 [0.269, 0.429]
nnMedian: 8.034, contactDuration: 10.158, followingIndex: -0.014
songPerContact: 0, songPerTickAlone: 0
  by other-sex=female: nnMedian 7.903, timeNear 5.8%, contactRate 0.171, following -0.042, song/contact 0
  by other-sex=male: nnMedian 8.017, timeNear 5.7%, contactRate 0.178, following -0.036, song/contact 0

## ablated

Find: 95.0% [91.7%, 97.8%], feeding 54.1%
Approach (floral): median 1079 ticks, 125 included / 39 excluded
Approach (fruit): median 1054.500 ticks, 116 included / 52 excluded
Danger escape-or-turn within window: 13.0% (48/370)
Time near (<=2 tiles): 5.2% [4.2%, 6.4%]
Contact rate (per minute): 0.307 [0.247, 0.376]
nnMedian: 7.905, contactDuration: 13.022, followingIndex: -0.014
songPerContact: 0, songPerTickAlone: 0
  by other-sex=female: nnMedian 7.904, timeNear 5.4%, contactRate 0.169, following -0.049, song/contact 0
  by other-sex=male: nnMedian 7.880, timeNear 5.0%, contactRate 0.138, following -0.029, song/contact 0

## random-graph

Find: 97.2% [94.4%, 99.4%], feeding 66.4%
Approach (floral): median 967 ticks, 131 included / 33 excluded
Approach (fruit): median 783 ticks, 138 included / 30 excluded
Danger escape-or-turn within window: 6.2% (54/873)
Time near (<=2 tiles): 2.9% [2.4%, 3.5%]
Contact rate (per minute): 0.313 [0.240, 0.391]
nnMedian: 9.648, contactDuration: 5.724, followingIndex: 0.056
songPerContact: 0, songPerTickAlone: 0
  by other-sex=female: nnMedian 9.680, timeNear 2.9%, contactRate 0.151, following 0.043, song/contact 0
  by other-sex=male: nnMedian 9.660, timeNear 2.8%, contactRate 0.162, following 0.059, song/contact 0

## random-walk

Find: 73.3% [66.7%, 80.0%], feeding 0.0%
Approach (floral): median 1107 ticks, 71 included / 93 excluded
Approach (fruit): median 1065 ticks, 83 included / 85 excluded
Danger escape-or-turn within window: 2.2% (10/450)
Time near (<=2 tiles): 10.4% [9.0%, 11.8%]
Contact rate (per minute): 0.889 [0.776, 1.029]
nnMedian: 10.495, contactDuration: 6.875, followingIndex: 0.220
songPerContact: 0, songPerTickAlone: 0
  by other-sex=female: nnMedian 10.084, timeNear 11.2%, contactRate 0.440, following 0.218, song/contact 0
  by other-sex=male: nnMedian 10.944, timeNear 9.4%, contactRate 0.449, following 0.199, song/contact 0

## SC-004 verdict

social time-near beats random-graph: true, beats random-walk: false
social contact-rate beats random-graph: false, beats random-walk: false
ablated time-near also beats random-walk: false (if true, the effect is not shown to be pheromonal)

