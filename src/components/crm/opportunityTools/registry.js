// The portal's side of the opportunity tool registry: which screen
// renders each tool key, and any props it needs. The API owns the
// list of tools and everything about them; this only maps a key to a
// component. A tool the API lists but this file doesn't know shows as
// "Coming soon" on the Tools tab.
//
// Adding a tool: one entry here, and a screen under ./<kind>/ (or an
// existing screen with a different `props.toolKey`, as the
// Deliverables tools do).

import ServiceScoping from './scoping/ServiceScoping.jsx';
import DeliverablesTool from './deliverables/DeliverablesTool.jsx';

const deliverables = (toolKey) => ({ component: DeliverablesTool, props: { toolKey } });

export const OPPORTUNITY_TOOLS = {
  scoping: { component: ServiceScoping },
  'deliverables-ea-teach':         deliverables('deliverables-ea-teach'),
  'deliverables-apm-teach':        deliverables('deliverables-apm-teach'),
  'deliverables-innovation-teach': deliverables('deliverables-innovation-teach'),
};

export const TOOL_STATUS_LABEL = {
  NotStarted: 'Not started',
  InProgress: 'In progress',
  Complete: 'Complete',
};

export const TOOL_STATUS_CLASS = {
  NotStarted: 'tool-status tool-status--not-started',
  InProgress: 'tool-status tool-status--in-progress',
  Complete: 'tool-status tool-status--complete',
};
