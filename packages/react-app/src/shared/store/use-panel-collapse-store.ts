/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {create} from 'zustand';

import {type LayoutStore, type PanelState} from '~shared/types/panel-collapse.types';


export {type PanelState} from '~shared/types/panel-collapse.types';

// All panels visible by default when a project is first opened
export const DEFAULT_PANEL_STATE: PanelState = {bottom: true, left: true, right: true};

export const usePanelCollapseStore = create<LayoutStore>((set, get) => ({
  activeProjectId: null, // No project tab selected yet on app start
  panelStates: new Map(), // No panel states saved yet

  // Remembers which project the user switched to, so panel collapse/expand reacts to the right project
  setActiveProject: (projectId) => set({activeProjectId: projectId}),

  togglePanel: (panel, projectId) => {
    const panelStates = new Map(get().panelStates); // Make a copy so Zustand detects the state change and re-renders
    const currentPanelState = panelStates.get(projectId) ?? DEFAULT_PANEL_STATE; // Load this project's current panel visibility (or defaults if first time)
    panelStates.set(projectId, {...currentPanelState, [panel]: !currentPanelState[panel]}); // Flip the clicked panel: visible→hidden or hidden→visible
    set({panelStates});
  },
}));
