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
import {
  EuiFlexGroup,
  EuiLink,
  EuiText,
  EuiMarkdownFormat,
  useEuiTheme,
  useEuiFontSize,
} from '@elastic/eui';

import {
  PanelContainer,
  PanelHeader,
  PanelBody,
  PanelBodySection,
  SubPanelHeading,
} from '../date_range_picker_panel_ui';
import { documentationPanelTexts } from '../translations';

const DETAILED_DOCS_URL = 'https://www.elastic.co/';

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
      <EuiMarkdownFormat
        color="text"
        textSize="xs"
        css={css`
          .euiCode {
            color: ${euiTheme.colors.textSubdued};
          }
        `}
      >
        {markdown}
      </EuiMarkdownFormat>
    </EuiFlexGroup>
  );
};

const Content = () => (
  <EuiFlexGroup gutterSize="m" direction="column" css={css({ maxInlineSize: '36ch' })}>
    <Section markdown={documentationPanelTexts.intro} />
    <Section
      heading={documentationPanelTexts.absoluteHeading}
      markdown={documentationPanelTexts.absoluteBody}
    />
    <Section
      heading={documentationPanelTexts.relativeHeading}
      markdown={documentationPanelTexts.relativeBody}
    />
    <Section
      heading={documentationPanelTexts.combinationsHeading}
      markdown={documentationPanelTexts.combinationsBody}
    />
    <EuiText size="xs">
      <EuiLink href={DETAILED_DOCS_URL} target="_blank" external>
        {documentationPanelTexts.detailedDocumentationLink}
      </EuiLink>
    </EuiText>
  </EuiFlexGroup>
);

/**
 * A panel for end-user documention about the component.
 */
export function DocumentationPanel() {
  return (
    <PanelContainer>
      <PanelHeader>
        <SubPanelHeading>{documentationPanelTexts.heading}</SubPanelHeading>
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
