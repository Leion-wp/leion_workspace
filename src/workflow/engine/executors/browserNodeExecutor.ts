import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { resolveValue } from '../DataMapper';
import { browserCommandService } from '../../../services/browserCommandService';

export async function executeBrowserNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const {
        browserPaneId,
        browserUrl,
        browserExtractSelector,
        browserOperation: rawOperation,
        browserFillValue,
        browserWaitCondition = 'element',
        browserWaitTimeout = 10000,
        browserJsCode,
        browserExtractMode = 'text',
        browserExtractAttribute,
        browserScrollDirection = 'bottom',
    } = node.data;

    if (!browserPaneId?.trim()) {
        throw new Error(`Browser node "${node.id}" has no target pane configured`);
    }

    // Determine effective operation: explicit > inferred from fields > legacy behavior
    let operation = rawOperation;
    if (!operation) {
        if (browserUrl && !browserExtractSelector) operation = 'navigate';
        else if (browserExtractSelector) operation = 'extract';
        else operation = 'navigate';
    }

    if (dependencies.dryRun) {
        context.logs.push(`[DRY-RUN] Browser [${browserPaneId}]: ${operation}`);
        return { dryRun: true, operation };
    }

    const result: Record<string, unknown> = { operation };
    const paneId = browserPaneId;

    switch (operation) {
        case 'navigate': {
            if (!browserUrl) {
                throw new Error(`Browser node "${node.id}": navigate requires a URL`);
            }
            const resolvedUrl = String(resolveValue(browserUrl, context));
            context.logs.push(`Browser [${paneId}]: navigating to ${resolvedUrl}`);
            await browserCommandService.executeInPane(
                paneId,
                `window.location.href = ${JSON.stringify(resolvedUrl)}; 'navigated';`
            );
            result.navigated = resolvedUrl;
            // Wait for page load
            await new Promise((r) => setTimeout(r, 2000));
            break;
        }

        case 'extract': {
            const resolvedSelector = String(resolveValue(browserExtractSelector ?? 'text', context));
            context.logs.push(`Browser [${paneId}]: extracting "${resolvedSelector}" mode=${browserExtractMode}`);

            let script: string;
            if (resolvedSelector === 'text') {
                script = `document.body.innerText`;
            } else if (resolvedSelector === 'html') {
                script = `document.body.innerHTML`;
            } else if (resolvedSelector === 'title') {
                script = `document.title`;
            } else if (resolvedSelector === 'url') {
                script = `window.location.href`;
            } else if (browserExtractMode === 'html') {
                script = `(document.querySelector(${JSON.stringify(resolvedSelector)})?.innerHTML ?? null)`;
            } else if (browserExtractMode === 'attribute' && browserExtractAttribute) {
                script = `(document.querySelector(${JSON.stringify(resolvedSelector)})?.getAttribute(${JSON.stringify(browserExtractAttribute)}) ?? null)`;
            } else if (browserExtractMode === 'list') {
                script = `[...document.querySelectorAll(${JSON.stringify(resolvedSelector)})].map(el => el.innerText?.trim()).filter(Boolean)`;
            } else {
                // default: text
                script = `(document.querySelector(${JSON.stringify(resolvedSelector)})?.innerText ?? null)`;
            }

            const extracted = await browserCommandService.executeInPane(paneId, script);
            result.extracted = extracted;
            result.selector = resolvedSelector;
            break;
        }

        case 'click': {
            const selector = String(resolveValue(browserExtractSelector ?? '', context));
            if (!selector) {
                throw new Error(`Browser node "${node.id}": click requires a selector`);
            }
            context.logs.push(`Browser [${paneId}]: clicking "${selector}"`);
            const clickResult = await browserCommandService.executeInPane(
                paneId,
                `document.querySelector(${JSON.stringify(selector)})?.click(); 'CLICKED'`
            );
            result.clicked = selector;
            result.clickResult = clickResult;
            break;
        }

        case 'fill': {
            const selector = String(resolveValue(browserExtractSelector ?? '', context));
            const value = String(resolveValue(browserFillValue ?? '', context));
            if (!selector) {
                throw new Error(`Browser node "${node.id}": fill requires a selector`);
            }
            context.logs.push(`Browser [${paneId}]: filling "${selector}" with value`);
            const fillScript = `(function() {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return 'NOT_FOUND';
    el.focus();
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
                      || Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (nativeSetter) nativeSetter.call(el, ${JSON.stringify(value)});
    else el.value = ${JSON.stringify(value)};
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return 'FILLED';
})()`;
            const fillResult = await browserCommandService.executeInPane(paneId, fillScript);
            result.filled = selector;
            result.fillResult = fillResult;
            break;
        }

        case 'wait-for': {
            const selector = String(resolveValue(browserExtractSelector ?? '', context));
            const timeoutMs = browserWaitTimeout;
            context.logs.push(`Browser [${paneId}]: waiting for condition="${browserWaitCondition}" selector="${selector}" timeout=${timeoutMs}ms`);

            let waitScript: string;
            if (browserWaitCondition === 'url-contains') {
                waitScript = `(async function() {
    return new Promise((resolve) => {
        const start = Date.now();
        const check = setInterval(() => {
            if (Date.now() - start > ${timeoutMs}) { clearInterval(check); resolve('TIMEOUT'); return; }
            if (window.location.href.includes(${JSON.stringify(selector)})) { clearInterval(check); resolve('OK'); }
        }, 500);
    });
})()`;
            } else if (browserWaitCondition === 'text-contains') {
                waitScript = `(async function() {
    return new Promise((resolve) => {
        const start = Date.now();
        const check = setInterval(() => {
            if (Date.now() - start > ${timeoutMs}) { clearInterval(check); resolve('TIMEOUT'); return; }
            if (document.body.innerText.includes(${JSON.stringify(selector)})) { clearInterval(check); resolve('OK'); }
        }, 500);
    });
})()`;
            } else {
                // element (default)
                waitScript = `(async function() {
    return new Promise((resolve) => {
        const start = Date.now();
        const check = setInterval(() => {
            if (Date.now() - start > ${timeoutMs}) { clearInterval(check); resolve('TIMEOUT'); return; }
            const el = document.querySelector(${JSON.stringify(selector)});
            if (el && el.offsetParent !== null) { clearInterval(check); resolve('OK'); }
        }, 500);
    });
})()`;
            }

            const waitResult = await browserCommandService.executeInPane(paneId, waitScript);
            result.waitResult = waitResult;
            result.condition = browserWaitCondition;
            break;
        }

        case 'execute-js': {
            if (!browserJsCode?.trim()) {
                throw new Error(`Browser node "${node.id}": execute-js requires jsCode`);
            }
            const resolvedCode = String(resolveValue(browserJsCode, context));
            context.logs.push(`Browser [${paneId}]: executing JS (${resolvedCode.length} chars)`);
            const jsResult = await browserCommandService.executeInPane(paneId, resolvedCode);
            result.jsResult = jsResult;
            break;
        }

        case 'screenshot': {
            context.logs.push(`Browser [${paneId}]: capturing screenshot`);
            // Use html2canvas-style approach or capture via platform API if available
            const screenshotScript = `(async function() {
    try {
        // Try html2canvas if available
        if (typeof html2canvas !== 'undefined') {
            const canvas = await html2canvas(document.body);
            return canvas.toDataURL('image/png');
        }
        return 'SCREENSHOT_NOT_SUPPORTED';
    } catch(e) {
        return 'ERROR:' + e.message;
    }
})()`;
            const screenshotResult = await browserCommandService.executeInPane(paneId, screenshotScript);
            result.screenshot = screenshotResult;
            break;
        }

        case 'scroll': {
            const selector = browserExtractSelector ? String(resolveValue(browserExtractSelector, context)) : null;
            context.logs.push(`Browser [${paneId}]: scrolling direction=${browserScrollDirection}`);

            let scrollScript: string;
            if (browserScrollDirection === 'top') {
                scrollScript = `window.scrollTo(0, 0); 'SCROLLED_TOP'`;
            } else if (selector && browserScrollDirection === 'element') {
                scrollScript = `(function() {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); return 'SCROLLED_TO_ELEMENT'; }
    return 'ELEMENT_NOT_FOUND';
})()`;
            } else {
                scrollScript = `window.scrollTo(0, document.body.scrollHeight); 'SCROLLED_BOTTOM'`;
            }

            const scrollResult = await browserCommandService.executeInPane(paneId, scrollScript);
            result.scrollResult = scrollResult;
            break;
        }

        case 'hover': {
            const selector = String(resolveValue(browserExtractSelector ?? '', context));
            if (!selector) {
                throw new Error(`Browser node "${node.id}": hover requires a selector`);
            }
            context.logs.push(`Browser [${paneId}]: hovering over "${selector}"`);
            const hoverScript = `(function() {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return 'NOT_FOUND';
    el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
    return 'HOVERED';
})()`;
            const hoverResult = await browserCommandService.executeInPane(paneId, hoverScript);
            result.hoverResult = hoverResult;
            break;
        }

        case 'extract-table': {
            const selector = String(resolveValue(browserExtractSelector ?? 'table', context));
            context.logs.push(`Browser [${paneId}]: extracting table "${selector}"`);
            const tableScript = `(function() {
    const table = document.querySelector(${JSON.stringify(selector)});
    if (!table) return null;
    const rows = [...table.querySelectorAll('tr')];
    const headers = [...(rows[0]?.querySelectorAll('th, td') ?? [])].map(el => el.innerText?.trim());
    const data = rows.slice(1).map(row => {
        const cells = [...row.querySelectorAll('td, th')].map(el => el.innerText?.trim());
        if (headers.length > 0) {
            const obj = {};
            headers.forEach((h, i) => { obj[h || i] = cells[i] ?? null; });
            return obj;
        }
        return cells;
    });
    return { headers, rows: data };
})()`;
            const tableResult = await browserCommandService.executeInPane(paneId, tableScript);
            result.table = tableResult;
            break;
        }

        default: {
            // Legacy fallback: run old navigate+extract behavior
            if (browserUrl) {
                const resolvedUrl = String(resolveValue(browserUrl, context));
                context.logs.push(`Browser [${paneId}]: navigating to ${resolvedUrl}`);
                await browserCommandService.executeInPane(
                    paneId,
                    `window.location.href = ${JSON.stringify(resolvedUrl)}; 'navigated';`
                );
                result.navigated = resolvedUrl;
                await new Promise((r) => setTimeout(r, 2000));
            }
            if (browserExtractSelector) {
                const resolvedSelector = String(resolveValue(browserExtractSelector, context));
                const script = resolvedSelector === 'text'
                    ? `document.body.innerText`
                    : resolvedSelector === 'html'
                    ? `document.body.innerHTML`
                    : resolvedSelector === 'title'
                    ? `document.title`
                    : resolvedSelector === 'url'
                    ? `window.location.href`
                    : `(document.querySelector(${JSON.stringify(resolvedSelector)})?.innerText ?? null)`;
                const extracted = await browserCommandService.executeInPane(paneId, script);
                result.extracted = extracted;
                result.selector = resolvedSelector;
            }
        }
    }

    return result;
}
