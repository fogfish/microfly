// Seeded random topology with Dale's law (ADR 001, Stage 1). Pure: no DOM.
// Each neuron is excitatory (+1) or inhibitory (-1); all its outgoing edges share that sign.

export function randomGraph({ neuronCount, outDegree, inhibitoryFraction, rand }) {
  if (outDegree >= neuronCount) throw new Error('outDegree must be less than neuronCount');

  const sign = Array.from({ length: neuronCount }, () => (rand() < inhibitoryFraction ? -1 : 1));
  const edges = [];
  for (let pre = 0; pre < neuronCount; pre++) {
    const targets = new Set();
    while (targets.size < outDegree) {
      const post = Math.floor(rand() * neuronCount);
      if (post !== pre) targets.add(post);
    }
    for (const post of targets) edges.push({ pre, post, weight: sign[pre] });
  }
  return { neuronCount, edges };
}

// Fixed wiring rule (feature 002): the sensory neuron is excitatory and has an excitatory edge
// to each motor neuron. Random wiring still decides everything else. Pure: returns a new graph.
export function addMotorDrive(graph, { sensory, motors }) {
  const edges = graph.edges.map((e) => (e.pre === sensory ? { ...e, weight: 1 } : e));
  for (const post of motors) {
    if (!edges.some((e) => e.pre === sensory && e.post === post)) {
      edges.push({ pre: sensory, post, weight: 1 });
    }
  }
  return { neuronCount: graph.neuronCount, edges };
}
