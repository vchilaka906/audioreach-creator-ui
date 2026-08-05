/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {
  IJsonModel,
  IJsonRowNode,
  IJsonTabNode,
  IJsonTabSetNode,
} from 'flexlayout-react';

import {logger} from '../lib/logger';

export type JSONDataMap = {
  [key: string]: any;
};

export const GRAPH_DESIGNER_COMPONENT_NAME = 'usecase';
export const MODULE_LIST_COMPONENT_NAME = 'module-list';
export const LOG_VIEW_COMPONENT_NAME = 'log-view';
export const SUBGRAPH_LIST_COMPONENT_NAME = 'subgraph-list';
export const KEY_CONFIGURATOR_COMPONENT_NAME = 'key-configurator';
export const VALIDATION_RESULTS_COMPONENT_NAME = 'validation-results';
export const MAIN_TAB_TITLE = 'Graph Designer';
/**
 * Constant representing an invalid/undefined project ID
 */
export const INVALID_PROJECT_ID = 'project_undefined';

/**
 * Check if a project ID is valid
 * @param projectId - The project ID to validate
 * @returns true if the project ID is valid, false otherwise
 */
export function isValidProjectId(
  projectId: string | undefined,
): projectId is string {
  return !!projectId && projectId !== INVALID_PROJECT_ID;
}

export const graphDesignerLayout = {
  component: GRAPH_DESIGNER_COMPONENT_NAME,
  position: {
    area: 'center',
    weight: 100,
  },
};

/**
 * Creates the complete FlexLayout JSON configuration for a project
 * This includes the main tab (GraphDesigner) and border panels
 * @returns Complete IJsonModel ready to use with FlexLayout
 */
export function GetFlexLayoutConfig(): IJsonModel {
  // Tab nodes
  const moduleListTab: IJsonTabNode = {
    component: MODULE_LIST_COMPONENT_NAME,
    enableClose: false,
    id: 'module-list-panel',
    name: 'Module List',
    type: 'tab',
  };

  const graphDesignerTab: IJsonTabNode = {
    component: GRAPH_DESIGNER_COMPONENT_NAME,
    id: 'usecase-main',
    name: 'Graph Designer',
    type: 'tab',
  };

  const logViewTab: IJsonTabNode = {
    component: LOG_VIEW_COMPONENT_NAME,
    enableClose: false,
    id: 'log-view-panel',
    name: 'Log View',
    type: 'tab',
  };

  const subgraphListTab: IJsonTabNode = {
    component: SUBGRAPH_LIST_COMPONENT_NAME,
    enableClose: false,
    id: 'subgraph-list-panel',
    name: 'Subgraph List',
    type: 'tab',
  };

  const keyConfiguratorTab: IJsonTabNode = {
    component: KEY_CONFIGURATOR_COMPONENT_NAME,
    enableClose: false,
    id: 'key-configurator-panel',
    name: 'Key Configurator',
    type: 'tab',
  };

  const validationResultTab: IJsonTabNode = {
    component: VALIDATION_RESULTS_COMPONENT_NAME,
    enableClose: false,
    id: 'validation-results-panel',
    name: 'Validation Results',
    type: 'tab',
  };

  // Tabset nodes
  const leftTabset: IJsonTabSetNode = {
    children: [moduleListTab],
    id: 'left-panel',
    type: 'tabset',
    weight: 20,
  };

  const centerTabset: IJsonTabSetNode = {
    children: [graphDesignerTab],
    enableDivide: false,
    enableDrop: false,
    enableTabStrip: false,
    id: 'center-panel',
    type: 'tabset',
    weight: 80,
  };

  const bottomTabset: IJsonTabSetNode = {
    children: [logViewTab, validationResultTab],
    id: 'bottom-panel',
    type: 'tabset',
    weight: 20,
  };

  const rightTabset: IJsonTabSetNode = {
    children: [subgraphListTab, keyConfiguratorTab],
    id: 'right-panel',
    type: 'tabset',
    weight: 20,
  };

  const centerColumn: IJsonRowNode = {
    children: [centerTabset, bottomTabset],
    type: 'column',
    weight: 60,
  };

  const flexLayoutConfig: IJsonModel = {
    borders: [],
    layout: {
      children: [leftTabset, centerColumn, rightTabset],
      id: 'root',
      type: 'row',
    },
  };

  return flexLayoutConfig;
}

// Finds a tabset by id, searching depth-first through row/tabset children.
function findTabsetById(
  node: IJsonRowNode | IJsonTabSetNode,
  id: string,
): IJsonTabSetNode | null {
  if (node.type === 'tabset') {
    return node.id === id ? (node as IJsonTabSetNode) : null;
  }
  for (const child of node.children) {
    const found = findTabsetById(child as IJsonRowNode | IJsonTabSetNode, id);
    if (found) {
      return found;
    }
  }
  return null;
}

// Every tabset in the default layout, flattened.
function collectTabsets(
  node: IJsonRowNode | IJsonTabSetNode,
  into: IJsonTabSetNode[],
): void {
  if (node.type === 'tabset') {
    into.push(node as IJsonTabSetNode);
    return;
  }
  for (const child of node.children) {
    collectTabsets(child as IJsonRowNode | IJsonTabSetNode, into);
  }
}

// Every tab id in the saved layout, across all tabsets.
function collectTabIds(tabsets: IJsonTabSetNode[]): Set<string> {
  const ids = new Set<string>();
  for (const tabset of tabsets) {
    for (const tab of tabset.children) {
      if (tab.id) {
        ids.add(tab.id);
      }
    }
  }
  return ids;
}

// Runtime-only tabs the app inserts itself, not part of GetFlexLayoutConfig().
const DYNAMIC_LAYOUT_COMPONENTS = new Set(['panel-placeholder']);

// Adds missing default tabs to a saved layout and drops any tab the app itself never creates.
export function migrateFlexLayoutConfig(savedLayout: IJsonModel): IJsonModel {
  const defaultTabsets: IJsonTabSetNode[] = [];
  collectTabsets(GetFlexLayoutConfig().layout, defaultTabsets);
  const knownComponents = new Set(DYNAMIC_LAYOUT_COMPONENTS);
  for (const tabset of defaultTabsets) {
    for (const tab of tabset.children) {
      if (tab.component) {
        knownComponents.add(tab.component);
      }
    }
  }

  const savedTabsets: IJsonTabSetNode[] = [];
  collectTabsets(savedLayout.layout, savedTabsets);
  // Skip a tab that already exists in the saved layout, even in a different tabset.
  const savedTabIds = collectTabIds(savedTabsets);

  let migrated: IJsonModel | null = null;

  for (const defaultTabset of defaultTabsets) {
    if (!defaultTabset.id) {
      continue;
    }
    const savedTabset = findTabsetById(savedLayout.layout, defaultTabset.id);
    if (!savedTabset) {
      logger.warn(
        `migrateFlexLayoutConfig: no matching tabset for id "${defaultTabset.id}" in saved layout`,
      );
      continue;
    }

    // Default tabs missing from the saved layout entirely.
    const missingTabs = defaultTabset.children.filter(
      (defaultTab) => !savedTabIds.has(defaultTab.id ?? ''),
    );
    // Tabs whose component the app could never have written itself.
    const staleTabs = savedTabset.children.filter(
      (savedTab) =>
        !savedTab.component || !knownComponents.has(savedTab.component),
    );
    if (missingTabs.length === 0 && staleTabs.length === 0) {
      continue;
    }

    // Clone once, on first change, and add/remove tabs on the clone.
    migrated ??= JSON.parse(JSON.stringify(savedLayout)) as IJsonModel;
    const targetTabset = findTabsetById(migrated.layout, defaultTabset.id)!;
    targetTabset.children.push(...missingTabs);
    targetTabset.children = targetTabset.children.filter(
      (tab) => !staleTabs.some((staleTab) => staleTab.id === tab.id),
    );
  }

  return migrated ?? savedLayout;
}

/* returns either a primitive value (like true, 42, "bottom") or
 * an object (like the usecase object) or even undefined if the path doesn't
 * exist. To reflect that this function can return any value found at the path,
 * not just an object we use any
 */
export function getConfigData(
  jsonData: JSONDataMap,
  path: string,
  rootKey?: string,
): any {
  const data = rootKey ? jsonData[rootKey] : jsonData;
  return path
    .split('.')
    .reduce(
      (accumulator, currentValue) => accumulator && accumulator[currentValue],
      data,
    );
}

/*
This function will overwrite primitives.
Example:
const jsonData = { arcconfig: { project1: 'data' } };
setConfigData(jsonData, 'project1.modified', true);
Output:{ arcconfig: { project1: { modified: true } } };
*/
export function setConfigData(
  jsonData: JSONDataMap,
  path: string,
  newValue: any,
  rootKey?: string,
): void {
  let presentData = rootKey ? jsonData[rootKey] : jsonData;
  const pathArray = path.split('.');
  pathArray.forEach((currentElement, index) => {
    if (index === pathArray.length - 1) {
      // Set the value at the final path element
      presentData[currentElement] = newValue;
    } else {
      // If the next element doesn't exist or is not an object, overwrite with an
      // empty object
      if (
        typeof presentData[currentElement] !== 'object' ||
        presentData[currentElement] === null
      ) {
        presentData[currentElement] = {};
      }
      presentData = presentData[currentElement];
    }
  });
}
