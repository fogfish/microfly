// The section list in registry order (panel-sections.md, Initial sections). Adding a section means
// adding a module here; the others do not change.
import { actionSection } from './action.js';
import { neuronMapSection } from './neuron-map.js';
import { inputsSection } from './inputs.js';
import { outputsSection } from './outputs.js';

export const SECTIONS = [actionSection, neuronMapSection, inputsSection, outputsSection];
