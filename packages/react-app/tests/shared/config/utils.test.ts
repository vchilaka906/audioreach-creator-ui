/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import type {IJsonModel, IJsonTabNode, IJsonTabSetNode} from 'flexlayout-react';

import {migrateFlexLayoutConfig} from '~shared/config/utils';

function tab(id: string, component: string): IJsonTabNode {
  return {component, id, name: id, type: 'tab'};
}

function tabset(id: string, children: IJsonTabNode[]): IJsonTabSetNode {
  return {children, id, type: 'tabset', weight: 20};
}

function layout(tabsets: IJsonTabSetNode[]): IJsonModel {
  return {
    borders: [],
    layout: {children: tabsets, id: 'root', type: 'row'},
  };
}

describe('migrateFlexLayoutConfig', () => {
  // No-op when the saved layout already has every default tab.
  it('returns the same object reference when the saved layout already matches the default', () => {
    const savedLayout = layout([
      tabset('left-panel', [tab('module-list-panel', 'module-list')]),
      tabset('bottom-panel', [
        tab('log-view-panel', 'log-view'),
        tab('validation-results-panel', 'validation-results'),
      ]),
      tabset('right-panel', [
        tab('subgraph-list-panel', 'subgraph-list'),
        tab('key-configurator-panel', 'key-configurator'),
      ]),
    ]);

    const result = migrateFlexLayoutConfig(savedLayout);

    expect(result).toBe(savedLayout);
  });

  // A panel added to GetFlexLayoutConfig() shows up in an old saved layout.
  it('adds a default tab missing from the saved layout', () => {
    const savedLayout = layout([
      tabset('left-panel', [tab('module-list-panel', 'module-list')]),
      tabset('bottom-panel', [
        tab('validation-results-panel', 'validation-results'),
      ]),
      tabset('right-panel', [
        tab('subgraph-list-panel', 'subgraph-list'),
        tab('key-configurator-panel', 'key-configurator'),
      ]),
    ]);

    const result = migrateFlexLayoutConfig(savedLayout);
    const bottomPanel = result.layout.children.find(
      (c) => 'id' in c && c.id === 'bottom-panel',
    ) as IJsonTabSetNode;

    expect(bottomPanel.children.map((t) => t.id)).toContain('log-view-panel');
  });

  // A hand-edited tab with an unrecognized component gets stripped out.
  it('removes a tab whose component the app cannot write itself', () => {
    const savedLayout = layout([
      tabset('left-panel', [tab('module-list-panel', 'module-list')]),
      tabset('bottom-panel', [
        tab('log-view-panel', 'log-view'),
        tab('validation-results-panel', 'validation-results'),
        tab('fake-tab-panel', 'hand-edited-fake'),
      ]),
      tabset('right-panel', [
        tab('subgraph-list-panel', 'subgraph-list'),
        tab('key-configurator-panel', 'key-configurator'),
      ]),
    ]);

    const result = migrateFlexLayoutConfig(savedLayout);
    const bottomPanel = result.layout.children.find(
      (c) => 'id' in c && c.id === 'bottom-panel',
    ) as IJsonTabSetNode;

    expect(bottomPanel.children.map((t) => t.id)).toEqual([
      'log-view-panel',
      'validation-results-panel',
    ]);
  });

  // A tab missing a component entirely is treated as hand-edited and stripped.
  it('removes a tab with no component at all', () => {
    const savedLayout = layout([
      tabset('left-panel', [tab('module-list-panel', 'module-list')]),
      tabset('bottom-panel', [
        tab('log-view-panel', 'log-view'),
        tab('validation-results-panel', 'validation-results'),
        {id: 'no-component-panel', name: 'No Component', type: 'tab'},
      ]),
      tabset('right-panel', [
        tab('subgraph-list-panel', 'subgraph-list'),
        tab('key-configurator-panel', 'key-configurator'),
      ]),
    ]);

    const result = migrateFlexLayoutConfig(savedLayout);
    const bottomPanel = result.layout.children.find(
      (c) => 'id' in c && c.id === 'bottom-panel',
    ) as IJsonTabSetNode;

    expect(bottomPanel.children.map((t) => t.id)).toEqual([
      'log-view-panel',
      'validation-results-panel',
    ]);
  });

  // Regression: a tab dragged to a different tabset must not get duplicated.
  it('does not duplicate a tab that was moved to a different tabset (regression)', () => {
    const savedLayout = layout([
      tabset('left-panel', [tab('module-list-panel', 'module-list')]),
      tabset('bottom-panel', [tab('log-view-panel', 'log-view')]),
      tabset('right-panel', [
        tab('subgraph-list-panel', 'subgraph-list'),
        tab('key-configurator-panel', 'key-configurator'),
        tab('validation-results-panel', 'validation-results'),
      ]),
    ]);

    const result = migrateFlexLayoutConfig(savedLayout);

    const allTabIds = result.layout.children.flatMap((c) =>
      'children' in c ? c.children.map((t) => t.id) : [],
    );
    expect(
      allTabIds.filter((id) => id === 'validation-results-panel'),
    ).toHaveLength(1);

    const rightPanel = result.layout.children.find(
      (c) => 'id' in c && c.id === 'right-panel',
    ) as IJsonTabSetNode;
    expect(rightPanel.children.map((t) => t.id)).toContain(
      'validation-results-panel',
    );
  });

  // A dynamically-added placeholder tab is left alone, not treated as stale.
  it('keeps a dynamically-inserted panel-placeholder tab', () => {
    const savedLayout = layout([
      tabset('left-panel', [tab('module-list-panel', 'module-list')]),
      tabset('bottom-panel', [
        tab('log-view-panel', 'log-view'),
        tab('validation-results-panel', 'validation-results'),
      ]),
      tabset('right-panel', [
        tab('right-placeholder-tab', 'panel-placeholder'),
      ]),
    ]);

    const result = migrateFlexLayoutConfig(savedLayout);
    const rightPanel = result.layout.children.find(
      (c) => 'id' in c && c.id === 'right-panel',
    ) as IJsonTabSetNode;

    expect(rightPanel.children.map((t) => t.id)).toContain(
      'right-placeholder-tab',
    );
  });

  // A saved layout missing an entire tabset is skipped, not thrown on.
  it('logs a warning and skips a default tabset missing entirely from the saved layout', () => {
    const savedLayout = layout([
      tabset('left-panel', [tab('module-list-panel', 'module-list')]),
    ]);

    expect(() => migrateFlexLayoutConfig(savedLayout)).not.toThrow();
  });
});
