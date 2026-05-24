/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {Model} from 'flexlayout-react';

import {
  DEFAULT_PANEL_STATE,
  type PanelState,
  usePanelCollapseStore,
} from '~shared/store/use-panel-collapse-store';

// The 3 panel positions that can be toggled in the UI toolbar
const PANELS = ['left', 'right', 'bottom'] as const;

// Node types in FlexLayout that can have drag enabled/disabled
const STRUCTURAL = new Set(['row', 'column', 'tabset']);

// Finds where the center column sits among the root row's children
// Used to locate left panels (everything before center) and right panels (everything after center)
const findCenterIndex = (root: any): number =>
  root.type === 'row' && root.children
    ? root.children.findIndex(
        (childNode: any) => childNode.id === 'center-panel' || childNode.type === 'column',
      )
    : -1;

// Finds the column node that wraps both the center panel and the bottom panel
// Used to locate the bottom panel (last child of this column)
const findCenterColumn = (node: any): any => {
  if (node.type === 'column' && node.children?.some((childNode: any) => childNode.id === 'center-panel'))
    return node;
  for (const childNode of node.children ?? []) {
    const result = findCenterColumn(childNode);
    if (result) return result;
  }
  return null;
};

// Returns the FlexLayout JSON nodes that represent the given panel position in the UI
// left  → all tabsets to the left of the center graph area
// right → all tabsets to the right of the center graph area
// bottom → the bottom tabset below the center graph area
const findPositionNodes = (layoutJson: any, position: string): any[] => {
  const root = layoutJson.layout;
  if (position === 'bottom') {
    const centerColumn = findCenterColumn(root); //find center column
    return centerColumn?.children?.length > 1 ? centerColumn.children.slice(1) : []; // All children after the graph area = bottom panels (handles multiple panels stacked below center)
  }
  const centerIndex = findCenterIndex(root);
  if (centerIndex === -1) return [];
  return position === 'left'
    ? root.children.slice(0, centerIndex)   // Everything before center = left panels
    : root.children.slice(centerIndex + 1); // Everything after center = right panels
};

// Collapses or expands a panel node in the FlexLayout JSON
// collapse = true  → sets weight to 0 (panel disappears from UI) and disables drag
// collapse = false → sets weight to 20 (panel reappears in UI) and re-enables drag
const collapseNode = (node: any, collapse: boolean): void => {
  if (!node) return;
  node.weight = collapse ? 0 : 20; // weight 0 = hidden, weight 20 = visible with default size
  (node.children ?? [])
    .filter((childNode: any) => STRUCTURAL.has(childNode.type))
    .forEach((childNode: any) => collapseNode(childNode, collapse)); // Recursively apply to nested panels
};

// Reads the current panel visibility for the active project from the store
// Returns DEFAULT_PANEL_STATE (all visible) if no project is active yet
const getVisibility = (state: {
  activeProjectId: string | null;
  panelStates: Map<string, PanelState>;
}): PanelState =>
  (state.activeProjectId && state.panelStates.get(state.activeProjectId)) ||
  DEFAULT_PANEL_STATE;

/**
 * Wires the layout store to the FlexLayout model.
 * When the user clicks a panel toggle button → store updates → this subscriber fires
 * → finds the affected panel nodes → collapses or expands them → rebuilds the model
 * → React re-renders the UI with the panel shown or hidden.
 *
 * Returns an unsubscribe function to be called on component unmount.
 */
export const createPanelCollapseLogic = (
  model: Model,
  setModel: (newModel: Model) => void,
): (() => void) =>
  usePanelCollapseStore.subscribe((state, prevState) => {
    if (!model) return;

    const currentVisibility = getVisibility(state);   // Panel visibility after the toggle
    const previousVisibility = getVisibility(prevState); // Panel visibility before the toggle

    const layoutJson = model.toJson(); // Snapshot the current FlexLayout structure as plain JSON
    let changed = false;

    for (const panelPosition of PANELS) {
      if (currentVisibility[panelPosition] !== previousVisibility[panelPosition]) { // Only process panels whose visibility actually changed
        findPositionNodes(layoutJson, panelPosition).forEach((panelNode) =>
          collapseNode(panelNode, !currentVisibility[panelPosition]), // Collapse if now hidden, expand if now visible
        );
        changed = true;
      }
    }

    // Rebuild the FlexLayout model from the modified JSON — this triggers the UI to re-render
    if (changed) setModel(Model.fromJson(layoutJson));
  });
