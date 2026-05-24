/*
 * Copyright (c) Qualcomm Technologies, Inc. and/or its subsidiaries.
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {type FC} from 'react';

import {PanelBottom, PanelLeft, PanelRight} from 'lucide-react'; // Icons shown on the toggle buttons in the toolbar

import {InlineIconButton} from '@qualcomm-ui/react/inline-icon-button';
import {Tooltip} from '@qualcomm-ui/react/tooltip';

import {usePanelCollapseStore} from '../store/use-panel-collapse-store';
import {useProjectLayoutStore} from '../store/use-project-layout-store';

// Config for the 3 panel toggle buttons shown in the top toolbar
// Each button shows/hides one of the 3 panels in the UI
const PANEL_BUTTONS = [
  {icon: PanelLeft,   label: 'Toggle Left Panel',   panel: 'left'},   // Shows/hides the left sidebar
  {icon: PanelBottom, label: 'Toggle Bottom Panel', panel: 'bottom'}, // Shows/hides the bottom panel
  {icon: PanelRight,  label: 'Toggle Right Panel',  panel: 'right'},  // Shows/hides the right sidebar
] as const;

export const PanelIconBar: FC = () => {
  const {togglePanel} = usePanelCollapseStore(); // Action that flips a panel's visible/hidden state in the store
  const activeProjectGroup = useProjectLayoutStore((state) =>
    state.getActiveProjectGroup(), // Get the currently open project — needed to scope panel state per project
  );

  // Only render the toggle buttons when a project is open
  if (!activeProjectGroup) {
    return null;
  }

  return (
    <div className="flex gap-1">
      {PANEL_BUTTONS.map(({icon, label, panel}) => (
        <Tooltip
          key={panel}
          trigger={
            <InlineIconButton
              aria-label={label}
              icon={icon}
              onClick={() => togglePanel(panel, activeProjectGroup.mainTab.id)} // Toggle this panel for the active project
            />
          }
        >
          {label}
        </Tooltip>
      ))}
    </div>
  );
};
