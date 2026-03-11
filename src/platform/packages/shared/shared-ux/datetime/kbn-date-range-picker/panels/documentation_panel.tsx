/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import React from 'react';

import { css } from '@emotion/react';
import { EuiFlexGroup, EuiMarkdownFormat, useEuiTheme, useEuiFontSize } from '@elastic/eui';

import {
  PanelContainer,
  PanelHeader,
  PanelBody,
  PanelBodySection,
  SubPanelHeading,
} from '../date_range_picker_panel_ui';

interface SectionProps {
  heading?: string;
  markdown: string;
}

const Section = ({ heading, markdown }: SectionProps) => {
  const { euiTheme } = useEuiTheme();
  const font = useEuiFontSize('xs');
  const headingStyles = css`
    font-size: ${font.fontSize};
    line-height: ${font.lineHeight};
    font-weight: ${euiTheme.font.weight.semiBold};
  `;

  return (
    <EuiFlexGroup gutterSize="s" direction="column">
      {heading && <h3 css={headingStyles}>{heading}</h3>}
      <EuiMarkdownFormat color="text" textSize="xs">
        {markdown}
      </EuiMarkdownFormat>
    </EuiFlexGroup>
  );
};

const Content = () => (
  <EuiFlexGroup gutterSize="m" direction="column">
    <Section markdown={`Type \`to\` to split start and end`} />
    <Section heading="Absolute time formats" markdown={`foo bar`} />
    <Section heading="Relative time" markdown={`foo bar`} />
    <Section heading="Custom combinations" markdown={`foo bar`} />
    <a href="#">Detailed documentation</a>
  </EuiFlexGroup>
);

/**
 * A panel for end-user documention about the component.
 */
export function DocumentationPanel() {
  return (
    <PanelContainer>
      <PanelHeader>
        <SubPanelHeading>Shorthand syntax</SubPanelHeading>
      </PanelHeader>
      <PanelBody spacingSide="both">
        <PanelBodySection>
          <Content />
        </PanelBodySection>
      </PanelBody>
    </PanelContainer>
  );
}
DocumentationPanel.PANEL_ID = 'documentation-panel';
