// Role descriptions and sources for the inspector's Sources and Groups panels. Generated from
// inspector/malecns-3d.html (ROLES and the sources list), copied verbatim; do not hand-edit.
// The reference inspector is read only, so this file is the only copy the viewer uses.

export const ROLES = {
  "region": {
    "Optic lobe": "Visual system: four neuropils (lamina, medulla, lobula, lobula plate) that turn photoreceptor input into motion, colour and object features. The direction-selective T4/T5 cells sit here, and visual projection neurons carry the output to the central brain.",
    "Central brain": "Higher-order processing: mushroom bodies (associative learning), central complex (heading, navigation, action selection), antennal lobe and lateral horn (olfaction), and the subesophageal zone (taste and feeding). Central neurons send commands to the VNC through descending neurons.",
    "Ventral nerve cord": "The fly's spinal-cord equivalent. It holds the motor circuits and motor neurons for legs, wings and abdomen, receives sensory input from the body, and returns feedback to the brain through ascending neurons.",
    "Brain-VNC pathways": "Long-range neurons that link the brain to the VNC and periphery: descending neurons (brain-to-VNC commands), ascending neurons (VNC-to-brain feedback), and sensory and efferent relay groups. This grouping is defined here by superclass name, not by the source paper.",
    "ENS": "Enteric (gut) nervous system. It is a single body in this dataset, so no circuit role can be inferred.",
    "Unannotated": "Bodies with no superclass assignment (about 45k). They carry a large share of synapses, so check them before drawing conclusions about any region."
  },
  "superclass": {
    "ENS": "Enteric (gut) nervous system neurons. One body in this dataset.",
    "ascending_neuron": "Ascending neurons (AN): carry information from the VNC (limbs, wings, abdomen, sensory feedback) up to the brain. The MANC work describes them as returning information about ongoing circuit activity.",
    "cb_efferent": "Central-brain efferent neurons that send output from the brain toward the periphery or other ganglia. Few bodies; detailed role not verified.",
    "cb_endocrine": "Central-brain neurosecretory cells that release peptide hormones. Role inferred from the name.",
    "cb_intrinsic": "Central-brain interneurons: mushroom body, central complex, lateral horn and other central circuits. The largest central-brain outgoing group (about 109M synapses).",
    "cb_motor": "Central-brain neurons with motor-related output, mostly for head and mouthpart control. Role inferred, not verified.",
    "cb_sensory": "Head sensory neurons (antenna, maxillary palp, mouthparts) that project into the central brain: olfactory, gustatory and mechanosensory input.",
    "cb_sensory_tbc": "Head sensory neurons whose classification is still being checked (tbc = to be checked).",
    "descending_neuron": "Descending neurons (DN): brain-to-VNC command neurons for walking, turning, takeoff and grooming.",
    "descending_neuron_tbc": "Descending-type neurons whose classification is still being checked.",
    "efferent_ascending": "Mixed efferent and ascending group. Few bodies; role not verified.",
    "efferent_descending": "Mixed efferent and descending group. Few bodies; role not verified.",
    "ol_intrinsic": "Optic-lobe interneurons: lamina, medulla, lobula and lobula-plate circuits, including the T4/T5 motion detectors and Mi and Tm neurons. Largest optic-lobe group (about 86M outgoing synapses).",
    "ol_sensory": "Optic-lobe input neurons: photoreceptors (R1-R8) and their first targets.",
    "sensory_ascending": "Sensory neurons that enter the VNC and relay to the brain on ascending tracts.",
    "sensory_ascending_tbc": "Sensory-ascending neurons whose classification is still being checked.",
    "sensory_descending": "Sensory neurons with descending relay to the VNC. Role not verified.",
    "visual_centrifugal": "Centrifugal neurons: feedback from the central brain back into the optic lobe.",
    "visual_projection": "Visual projection neurons: carry processed optic-lobe output (motion, colour, object features) to the central brain.",
    "visual_projection_tbc": "Visual projection neurons whose classification is still being checked.",
    "vnc_efferent": "VNC efferent neurons: output from the VNC to the body or other ganglia.",
    "vnc_endocrine": "VNC neurosecretory cells.",
    "vnc_intrinsic": "VNC interneurons: local motor-circuit neurons that process descending input before it reaches motor neurons. Second-largest VNC outgoing group (about 38M synapses).",
    "vnc_motor": "Motor neurons (MN): drive leg, wing and abdominal muscles. They receive input and send almost no synapses within the connectome (about 70k outgoing).",
    "vnc_sensory": "VNC sensory neurons: proprioceptive, tactile and other input from legs, wings and abdomen.",
    "vnc_sensory_tbc": "VNC sensory neurons whose classification is still being checked.",
    "vnc_tbc": "VNC neurons whose classification is still being checked."
  },
  "class": {
    "ALIN": "Antennal-lobe interneurons: local olfactory circuit neurons. Role inferred from the name.",
    "ALLN": "Antennal-lobe local neurons: shape the odour code inside the antennal lobe.",
    "ALON": "Antennal-lobe other neurons. Role not verified.",
    "ALPN": "Antennal-lobe projection neurons: relay odour information from the antennal lobe to the mushroom body and lateral horn.",
    "CX": "Central-complex neurons: ellipsoid body, fan-shaped body, protocerebral bridge and noduli. They keep a heading representation and drive steering and navigation.",
    "DAN": "Dopaminergic neurons: deliver reward and punishment teaching signals to mushroom-body compartments. Each DAN type projects to one or two compartments.",
    "Kenyon_Cell": "Kenyon cells: about 2,000 per mushroom body, with sparse odour codes that support associative memory. The data holds about 4,064 in total (both hemispheres).",
    "MBON": "Mushroom-body output neurons: read out the learned valence signal. Literature describes 21 types across 15 compartments.",
    "SEZPN": "Subesophageal-zone projection neurons: taste and feeding-related central neurons. Role from general knowledge.",
    "chemosensory": "Chemosensory neurons: peripheral chemical sensing. Role inferred from the name.",
    "gustatory": "Gustatory receptor neurons: taste sensing on the mouthparts, legs and wings.",
    "hygrosensory": "Humidity-sensing neurons.",
    "mechanosensory": "Mechanosensory neurons: bristle, hair and chordotonal input for touch and hearing.",
    "mechanosensory_proprioceptive": "Proprioceptive neurons: report joint and limb position.",
    "mechanosensory_tactile": "Touch neurons from bristle and hair receptors.",
    "mechanosensory_tbc": "Mechanosensory neurons still under classification.",
    "ol_bilateral": "Optic-lobe neurons that span both sides. Role not verified.",
    "olfactory": "Olfactory receptor neurons on the antennae and palps: odour input to the antennal lobe.",
    "thermosensory": "Temperature-sensing neurons.",
    "unknown_sensory": "Sensory neurons without an assigned modality.",
    "visual": "Visual-system neurons: photoreceptors, lamina, medulla, lobula and lobula-plate cells (L1-L5, Tm, Mi, T4, T5, LC, LPLC)."
  },
  "type": {
    "BM_InOm": "BM bristle-associated. Bristle-associated neurons, including BM_Taste. Functions are not verified in these sources.",
    "C2": "Cm / C-type medulla. C-type and Cm medulla neurons. Functional roles are not verified in these sources.",
    "C3": "Cm / C-type medulla. C-type and Cm medulla neurons. Functional roles are not verified in these sources.",
    "Cm1": "Cm / C-type medulla. C-type and Cm medulla neurons. Functional roles are not verified in these sources.",
    "Cm2": "Cm / C-type medulla. C-type and Cm medulla neurons. Functional roles are not verified in these sources.",
    "Dm10": "Dm distal medulla. Distal medulla neurons. Dm8 pools R7 inputs for dim-UV colour and drives Tm5 colour channels.",
    "Dm15": "Dm distal medulla. Distal medulla neurons. Dm8 pools R7 inputs for dim-UV colour and drives Tm5 colour channels.",
    "Dm2": "Dm distal medulla. Distal medulla neurons. Dm8 pools R7 inputs for dim-UV colour and drives Tm5 colour channels.",
    "Dm3a": "Dm distal medulla. Distal medulla neurons. Dm8 pools R7 inputs for dim-UV colour and drives Tm5 colour channels.",
    "Dm3b": "Dm distal medulla. Distal medulla neurons. Dm8 pools R7 inputs for dim-UV colour and drives Tm5 colour channels.",
    "Dm3c": "Dm distal medulla. Distal medulla neurons. Dm8 pools R7 inputs for dim-UV colour and drives Tm5 colour channels.",
    "Dm8a": "Dm distal medulla. Distal medulla neurons. Dm8 pools R7 inputs for dim-UV colour and drives Tm5 colour channels.",
    "Dm8b": "Dm distal medulla. Distal medulla neurons. Dm8 pools R7 inputs for dim-UV colour and drives Tm5 colour channels.",
    "KCab-c": "KC Kenyon cells (mushroom body). Kenyon cells: alpha/beta (KCab), gamma (KCg) and alpha'/beta' (KCa'b') subtypes. They carry sparse odour codes for associative memory.",
    "KCab-m": "KC Kenyon cells (mushroom body). Kenyon cells: alpha/beta (KCab), gamma (KCg) and alpha'/beta' (KCa'b') subtypes. They carry sparse odour codes for associative memory.",
    "KCab-s": "KC Kenyon cells (mushroom body). Kenyon cells: alpha/beta (KCab), gamma (KCg) and alpha'/beta' (KCa'b') subtypes. They carry sparse odour codes for associative memory.",
    "KCg-m": "KC Kenyon cells (mushroom body). Kenyon cells: alpha/beta (KCab), gamma (KCg) and alpha'/beta' (KCa'b') subtypes. They carry sparse odour codes for associative memory.",
    "L1": "Lamina L1-L5. Lamina second-order neurons. L1 relays ON-edge signals and L2 OFF-edge signals to the motion pathway. L3-L5 are further lamina outputs with less established roles.",
    "L2": "Lamina L1-L5. Lamina second-order neurons. L1 relays ON-edge signals and L2 OFF-edge signals to the motion pathway. L3-L5 are further lamina outputs with less established roles.",
    "L3": "Lamina L1-L5. Lamina second-order neurons. L1 relays ON-edge signals and L2 OFF-edge signals to the motion pathway. L3-L5 are further lamina outputs with less established roles.",
    "L4": "Lamina L1-L5. Lamina second-order neurons. L1 relays ON-edge signals and L2 OFF-edge signals to the motion pathway. L3-L5 are further lamina outputs with less established roles.",
    "L5": "Lamina L1-L5. Lamina second-order neurons. L1 relays ON-edge signals and L2 OFF-edge signals to the motion pathway. L3-L5 are further lamina outputs with less established roles.",
    "LC12": "Lobula columnar LC (visual projection). Lobula columnar visual projection neurons. Each type projects to a distinct optic glomerulus. Some (e.g. looming-responsive LC6) drive avoidance or approach behaviour.",
    "LC17": "Lobula columnar LC (visual projection). Lobula columnar visual projection neurons. Each type projects to a distinct optic glomerulus. Some (e.g. looming-responsive LC6) drive avoidance or approach behaviour.",
    "Lawf1": "Neuropil-named clusters. Clusters named after the neuropil where they arborise (e.g. SMP superior medial protocerebrum, SLP superior lateral protocerebrum, AVLP/PVLP anterior/posterior ventrolateral protocerebrum). Functions are region-level and not verified per type.",
    "Lawf2": "Neuropil-named clusters. Clusters named after the neuropil where they arborise (e.g. SMP superior medial protocerebrum, SLP superior lateral protocerebrum, AVLP/PVLP anterior/posterior ventrolateral protocerebrum). Functions are region-level and not verified per type.",
    "Mi1": "Medulla Mi (intrinsic). Medulla intrinsic neurons. Mi1 is the main ON-pathway neuron feeding the direction-selective T4 cells. Other Mi types have less defined roles here.",
    "Mi10": "Medulla Mi (intrinsic). Medulla intrinsic neurons. Mi1 is the main ON-pathway neuron feeding the direction-selective T4 cells. Other Mi types have less defined roles here.",
    "Mi13": "Medulla Mi (intrinsic). Medulla intrinsic neurons. Mi1 is the main ON-pathway neuron feeding the direction-selective T4 cells. Other Mi types have less defined roles here.",
    "Mi15": "Medulla Mi (intrinsic). Medulla intrinsic neurons. Mi1 is the main ON-pathway neuron feeding the direction-selective T4 cells. Other Mi types have less defined roles here.",
    "Mi2": "Medulla Mi (intrinsic). Medulla intrinsic neurons. Mi1 is the main ON-pathway neuron feeding the direction-selective T4 cells. Other Mi types have less defined roles here.",
    "Mi4": "Medulla Mi (intrinsic). Medulla intrinsic neurons. Mi1 is the main ON-pathway neuron feeding the direction-selective T4 cells. Other Mi types have less defined roles here.",
    "Mi9": "Medulla Mi (intrinsic). Medulla intrinsic neurons. Mi1 is the main ON-pathway neuron feeding the direction-selective T4 cells. Other Mi types have less defined roles here.",
    "Other typed": "Typed neurons outside the 80 largest types. The full catalogue is in malecns.md section 14.",
    "R1-R6": "Photoreceptors R1-R8. Photoreceptors. R1-R6 carry broadband luminance and motion signals; R7 and R8 carry colour (UV and blue/green channels).",
    "R7_unclear": "Photoreceptors R1-R8. Photoreceptors. R1-R6 carry broadband luminance and motion signals; R7 and R8 carry colour (UV and blue/green channels).",
    "R7p": "Photoreceptors R1-R8. Photoreceptors. R1-R6 carry broadband luminance and motion signals; R7 and R8 carry colour (UV and blue/green channels).",
    "R7y": "Photoreceptors R1-R8. Photoreceptors. R1-R6 carry broadband luminance and motion signals; R7 and R8 carry colour (UV and blue/green channels).",
    "R8_unclear": "Photoreceptors R1-R8. Photoreceptors. R1-R6 carry broadband luminance and motion signals; R7 and R8 carry colour (UV and blue/green channels).",
    "R8y": "Photoreceptors R1-R8. Photoreceptors. R1-R6 carry broadband luminance and motion signals; R7 and R8 carry colour (UV and blue/green channels).",
    "T1": "T1-T5 (direction selective). T4 cells are the first direction-selective cells for ON motion; T5 for OFF motion. Each subtype is tuned to one of four cardinal directions.",
    "T2": "T1-T5 (direction selective). T4 cells are the first direction-selective cells for ON motion; T5 for OFF motion. Each subtype is tuned to one of four cardinal directions.",
    "T2a": "T1-T5 (direction selective). T4 cells are the first direction-selective cells for ON motion; T5 for OFF motion. Each subtype is tuned to one of four cardinal directions.",
    "T3": "T1-T5 (direction selective). T4 cells are the first direction-selective cells for ON motion; T5 for OFF motion. Each subtype is tuned to one of four cardinal directions.",
    "T4a": "T1-T5 (direction selective). T4 cells are the first direction-selective cells for ON motion; T5 for OFF motion. Each subtype is tuned to one of four cardinal directions.",
    "T4b": "T1-T5 (direction selective). T4 cells are the first direction-selective cells for ON motion; T5 for OFF motion. Each subtype is tuned to one of four cardinal directions.",
    "T4c": "T1-T5 (direction selective). T4 cells are the first direction-selective cells for ON motion; T5 for OFF motion. Each subtype is tuned to one of four cardinal directions.",
    "T4d": "T1-T5 (direction selective). T4 cells are the first direction-selective cells for ON motion; T5 for OFF motion. Each subtype is tuned to one of four cardinal directions.",
    "T5a": "T1-T5 (direction selective). T4 cells are the first direction-selective cells for ON motion; T5 for OFF motion. Each subtype is tuned to one of four cardinal directions.",
    "T5b": "T1-T5 (direction selective). T4 cells are the first direction-selective cells for ON motion; T5 for OFF motion. Each subtype is tuned to one of four cardinal directions.",
    "T5c": "T1-T5 (direction selective). T4 cells are the first direction-selective cells for ON motion; T5 for OFF motion. Each subtype is tuned to one of four cardinal directions.",
    "T5d": "T1-T5 (direction selective). T4 cells are the first direction-selective cells for ON motion; T5 for OFF motion. Each subtype is tuned to one of four cardinal directions.",
    "Tm1": "Medulla Tm (transmedulla). Transmedulla neurons relay medulla signals to the lobula. Tm1, Tm2 and Tm3 feed the motion pathway. Tm5a/b/c, Tm9 and Tm20 relay R7/R8 colour channels.",
    "Tm12": "Medulla Tm (transmedulla). Transmedulla neurons relay medulla signals to the lobula. Tm1, Tm2 and Tm3 feed the motion pathway. Tm5a/b/c, Tm9 and Tm20 relay R7/R8 colour channels.",
    "Tm16": "Medulla Tm (transmedulla). Transmedulla neurons relay medulla signals to the lobula. Tm1, Tm2 and Tm3 feed the motion pathway. Tm5a/b/c, Tm9 and Tm20 relay R7/R8 colour channels.",
    "Tm2": "Medulla Tm (transmedulla). Transmedulla neurons relay medulla signals to the lobula. Tm1, Tm2 and Tm3 feed the motion pathway. Tm5a/b/c, Tm9 and Tm20 relay R7/R8 colour channels.",
    "Tm20": "Medulla Tm (transmedulla). Transmedulla neurons relay medulla signals to the lobula. Tm1, Tm2 and Tm3 feed the motion pathway. Tm5a/b/c, Tm9 and Tm20 relay R7/R8 colour channels.",
    "Tm29": "Medulla Tm (transmedulla). Transmedulla neurons relay medulla signals to the lobula. Tm1, Tm2 and Tm3 feed the motion pathway. Tm5a/b/c, Tm9 and Tm20 relay R7/R8 colour channels.",
    "Tm3": "Medulla Tm (transmedulla). Transmedulla neurons relay medulla signals to the lobula. Tm1, Tm2 and Tm3 feed the motion pathway. Tm5a/b/c, Tm9 and Tm20 relay R7/R8 colour channels.",
    "Tm37": "Medulla Tm (transmedulla). Transmedulla neurons relay medulla signals to the lobula. Tm1, Tm2 and Tm3 feed the motion pathway. Tm5a/b/c, Tm9 and Tm20 relay R7/R8 colour channels.",
    "Tm39": "Medulla Tm (transmedulla). Transmedulla neurons relay medulla signals to the lobula. Tm1, Tm2 and Tm3 feed the motion pathway. Tm5a/b/c, Tm9 and Tm20 relay R7/R8 colour channels.",
    "Tm4": "Medulla Tm (transmedulla). Transmedulla neurons relay medulla signals to the lobula. Tm1, Tm2 and Tm3 feed the motion pathway. Tm5a/b/c, Tm9 and Tm20 relay R7/R8 colour channels.",
    "Tm5Y": "Medulla Tm (transmedulla). Transmedulla neurons relay medulla signals to the lobula. Tm1, Tm2 and Tm3 feed the motion pathway. Tm5a/b/c, Tm9 and Tm20 relay R7/R8 colour channels.",
    "Tm5a": "Medulla Tm (transmedulla). Transmedulla neurons relay medulla signals to the lobula. Tm1, Tm2 and Tm3 feed the motion pathway. Tm5a/b/c, Tm9 and Tm20 relay R7/R8 colour channels.",
    "Tm5b": "Medulla Tm (transmedulla). Transmedulla neurons relay medulla signals to the lobula. Tm1, Tm2 and Tm3 feed the motion pathway. Tm5a/b/c, Tm9 and Tm20 relay R7/R8 colour channels.",
    "Tm5c": "Medulla Tm (transmedulla). Transmedulla neurons relay medulla signals to the lobula. Tm1, Tm2 and Tm3 feed the motion pathway. Tm5a/b/c, Tm9 and Tm20 relay R7/R8 colour channels.",
    "Tm6": "Medulla Tm (transmedulla). Transmedulla neurons relay medulla signals to the lobula. Tm1, Tm2 and Tm3 feed the motion pathway. Tm5a/b/c, Tm9 and Tm20 relay R7/R8 colour channels.",
    "Tm9": "Medulla Tm (transmedulla). Transmedulla neurons relay medulla signals to the lobula. Tm1, Tm2 and Tm3 feed the motion pathway. Tm5a/b/c, Tm9 and Tm20 relay R7/R8 colour channels.",
    "TmY10": "Medulla TmY (Y-shaped transmedulla). Y-shaped transmedulla neurons relaying medulla output to the lobula. Individual roles are not verified in these sources.",
    "TmY13": "Medulla TmY (Y-shaped transmedulla). Y-shaped transmedulla neurons relaying medulla output to the lobula. Individual roles are not verified in these sources.",
    "TmY14": "Medulla TmY (Y-shaped transmedulla). Y-shaped transmedulla neurons relaying medulla output to the lobula. Individual roles are not verified in these sources.",
    "TmY17": "Medulla TmY (Y-shaped transmedulla). Y-shaped transmedulla neurons relaying medulla output to the lobula. Individual roles are not verified in these sources.",
    "TmY18": "Medulla TmY (Y-shaped transmedulla). Y-shaped transmedulla neurons relaying medulla output to the lobula. Individual roles are not verified in these sources.",
    "TmY20": "Medulla TmY (Y-shaped transmedulla). Y-shaped transmedulla neurons relaying medulla output to the lobula. Individual roles are not verified in these sources.",
    "TmY21": "Medulla TmY (Y-shaped transmedulla). Y-shaped transmedulla neurons relaying medulla output to the lobula. Individual roles are not verified in these sources.",
    "TmY3": "Medulla TmY (Y-shaped transmedulla). Y-shaped transmedulla neurons relaying medulla output to the lobula. Individual roles are not verified in these sources.",
    "TmY4": "Medulla TmY (Y-shaped transmedulla). Y-shaped transmedulla neurons relaying medulla output to the lobula. Individual roles are not verified in these sources.",
    "TmY5a": "Medulla TmY (Y-shaped transmedulla). Y-shaped transmedulla neurons relaying medulla output to the lobula. Individual roles are not verified in these sources.",
    "TmY9a": "Medulla TmY (Y-shaped transmedulla). Y-shaped transmedulla neurons relaying medulla output to the lobula. Individual roles are not verified in these sources.",
    "TmY9b": "Medulla TmY (Y-shaped transmedulla). Y-shaped transmedulla neurons relaying medulla output to the lobula. Individual roles are not verified in these sources.",
    "Unannotated": "Bodies missing from the annotation table or without a superclass.",
    "Untyped": "Bodies with no type label (about 47k). Their function is not assigned here.",
    "Y3": "Y-type visual neurons. Y-type visual neurons. Roles not verified in these sources."
  }
};

export const SOURCES = [
  {
    "title": "Male CNS paper coverage (sci.news)",
    "url": "https://www.sci.news/biology/complete-fruit-fly-connectome-15053.html"
  },
  {
    "title": "FlyEM publications (Janelia)",
    "url": "https://www.janelia.org/project-team/flyem/publications"
  },
  {
    "title": "Optic lobe connectome (Janelia)",
    "url": "https://www.janelia.org/project-team/flyem/optic-lobe"
  },
  {
    "title": "ON motion detection connectome (eLife)",
    "url": "https://elifesciences.org/articles/24394"
  },
  {
    "title": "Central complex anatomy (VFB)",
    "url": "https://flybrain-ndb.virtualflybrain.org/docs/anatomy-diagrams/anatomy-of-the-central-complex/"
  },
  {
    "title": "Central complex heading review (PMC)",
    "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC6320682"
  },
  {
    "title": "Mushroom body architecture (Aso et al., eLife/PMC)",
    "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4273437/"
  },
  {
    "title": "MANC VNC circuits (eLife)",
    "url": "https://elifesciences.org/articles/96084"
  },
  {
    "title": "Antennal-lobe wiring diagram (PMC)",
    "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4930330/"
  },
  {
    "title": "Medulla colour and motion pathways (PMC)",
    "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC4245076"
  },
  {
    "title": "Lobula visual projection neurons (PMC)",
    "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5293491/"
  },
  {
    "title": "Mushroom body architecture (PMC)",
    "url": "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4273437/"
  },
  {
    "title": "PAM and PPL1 dopaminergic neurons (eLife)",
    "url": "https://elifesciences.org/reviewed-preprints/91387"
  },
  {
    "title": "Central complex review (Frontiers)",
    "url": "https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2022.849142/pdf"
  }
];
