export type { WorkflowTemplate } from './types';
import type { WorkflowTemplate } from './types';
import { codeReviewTemplate } from './code-review';
import { runAndFixTemplate } from './run-and-fix';
import { webResearchTemplate } from './web-research';
import { multiAiCompareTemplate } from './multi-ai-compare';
import { fileTransformTemplate } from './file-transform';
import { dailyStandupTemplate } from './daily-standup';
import { errorDebugTemplate } from './error-debug';
import { extractTransformLoadTemplate } from './extract-transform-load';
import { deployChecklistTemplate } from './deploy-checklist';
import { researchAndStoreTemplate } from './research-and-store';

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
    codeReviewTemplate,
    runAndFixTemplate,
    webResearchTemplate,
    multiAiCompareTemplate,
    fileTransformTemplate,
    dailyStandupTemplate,
    errorDebugTemplate,
    extractTransformLoadTemplate,
    deployChecklistTemplate,
    researchAndStoreTemplate,
];
