// The portal's side of the opportunity tool registry: which screen
// renders each tool key. The API owns the list of tools and
// everything about them; this only maps a key to a component. A tool
// the API lists but this file doesn't know shows as "Coming soon" on
// the Tools tab.
//
// Adding a tool: one entry here, one screen under ./<key>/.

import ServiceScoping from './scoping/ServiceScoping.jsx';

export const OPPORTUNITY_TOOLS = {
  scoping: { component: ServiceScoping },
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
