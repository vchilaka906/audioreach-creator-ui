/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

// Tracks whether each of the 3 UI panels (left sidebar, right sidebar, bottom panel) is shown or hidden
export interface PanelState {
  bottom: boolean; // Bottom panel (e.g. Log View) — true = shown in UI
  left: boolean; // Left panel (e.g. Module List) — true = shown in UI
  right: boolean; // Right panel (e.g. Properties) — true = shown in UI
}

export interface LayoutStore {
  activeProjectId: string | null; // Tracks which project tab the user is currently viewing
  panelStates: Map<string, PanelState>; // Remembers each project's panel show/hide state separately
  setActiveProject: (projectId: string) => void; // Called when user clicks a project tab — tells the store which project is active
  togglePanel: (panel: keyof PanelState, projectId: string) => void; // Called when user clicks the Left/Right/Bottom toggle buttons in the toolbar
}
