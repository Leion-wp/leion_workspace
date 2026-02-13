import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { resolveValue } from '../DataMapper';
import { chatCommandService } from '../../../services/chatCommandService';

export interface ChatExecResult {
    response: string;
    provider: string;
    paneId: string;
    parsed?: unknown;
}

// Auto-discovery: find the best input element regardless of provider
const INJECT_SCRIPT = (prompt: string) => `
(async function() {
    const p = ${JSON.stringify(prompt)};

    // Priority list of known selectors (tried in order, first visible wins)
    const INPUT_SELECTORS = [
        'div.ProseMirror[contenteditable="true"]',
        'div[contenteditable="true"][data-placeholder]',
        '#prompt-textarea',
        'div.ql-editor[contenteditable="true"]',
        'rich-textarea div[contenteditable="true"]',
        'div[contenteditable="true"][role="textbox"]',
        'div[contenteditable="true"]',
        'textarea:not([readonly]):not([disabled])',
    ];

    let inputEl = null;
    for (const sel of INPUT_SELECTORS) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) { inputEl = el; break; }
    }

    // Final fallback: largest visible contenteditable/textarea
    if (!inputEl) {
        const candidates = [...document.querySelectorAll('[contenteditable="true"], textarea')]
            .filter(el => el.offsetParent !== null && !el.closest('[aria-hidden="true"]'))
            .sort((a, b) => (b.offsetWidth * b.offsetHeight) - (a.offsetWidth * a.offsetHeight));
        inputEl = candidates[0] ?? null;
    }

    if (!inputEl) return 'NO_INPUT';

    // Set content based on element type
    inputEl.focus();
    if (inputEl.tagName === 'TEXTAREA') {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        if (setter) {
            setter.call(inputEl, p);
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
    } else {
        // contenteditable
        inputEl.innerHTML = '';
        document.execCommand('insertText', false, p);
        inputEl.dispatchEvent(new InputEvent('input', { bubbles: true }));
        inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    await new Promise(r => setTimeout(r, 300));

    const SUBMIT_SELECTORS = [
        'button[data-testid="send-button"]:not([disabled])',
        'button[aria-label="Send message"]:not([disabled])',
        'button[aria-label="Send prompt"]:not([disabled])',
        'button[data-value="send"]:not([disabled])',
        'button[type="submit"]:not([disabled])',
        'button.send-button:not([disabled])',
    ];

    let submitBtn = null;
    for (const sel of SUBMIT_SELECTORS) {
        const btn = document.querySelector(sel);
        if (btn && btn.offsetParent !== null) { submitBtn = btn; break; }
    }

    if (submitBtn) { submitBtn.click(); return 'SENT'; }

    // Fallback: Enter key
    inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
    return 'SENT_VIA_ENTER';
})()
`;

// Auto-discovery: find the last AI response regardless of provider
const WAIT_FOR_RESPONSE_SCRIPT = (timeoutMs: number) => `
(async function() {
    const RESPONSE_SELECTORS = [
        '[data-testid="assistant-message"] .font-claude-message',
        '.font-claude-message',
        '[data-message-author-role="assistant"] .markdown',
        'model-response .markdown',
        '.response-content .markdown',
        '[class*="assistant"][class*="message"]',
    ];

    function getLastResponse() {
        for (const sel of RESPONSE_SELECTORS) {
            const els = document.querySelectorAll(sel);
            if (els.length > 0) return els[els.length - 1];
        }
        return null;
    }

    return new Promise((resolve) => {
        let lastText = '';
        let stableCount = 0;

        const check = setInterval(() => {
            const el = getLastResponse();
            if (!el) return;
            const text = (el.innerText ?? '').trim();
            if (!text || text.length < 5) return;

            if (text === lastText) {
                stableCount++;
                if (stableCount >= 3) { // stable ~4.5s = response complete
                    clearInterval(check);
                    resolve(text);
                }
            } else {
                stableCount = 0;
                lastText = text;
            }
        }, 1500);

        setTimeout(() => { clearInterval(check); resolve(lastText || 'TIMEOUT'); }, ${timeoutMs});
    });
})()
`;

// NEW_CONVERSATION_SCRIPT — tries multiple selector patterns to click "new conversation"
const NEW_CONVERSATION_SCRIPT = `
(async function() {
    const SELECTORS = [
        'button[aria-label="New chat"]',
        'button[aria-label="New conversation"]',
        'a[href="/"]',
        'button[data-testid="create-new-chat-button"]',
        '[aria-label*="new chat" i]',
        '[aria-label*="new conversation" i]',
        'nav button:first-child',
    ];
    for (const sel of SELECTORS) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) { el.click(); return 'CLICKED'; }
    }
    return 'NOT_FOUND';
})()
`;

// EPHEMERAL_CHAT_SCRIPT — tries to find "Temporary chat" button
const EPHEMERAL_CHAT_SCRIPT = `
(async function() {
    const SELECTORS = [
        'button[aria-label="Temporary chat"]',
        '[data-testid="temporary-chat-button"]',
    ];
    for (const sel of SELECTORS) {
        try {
            const el = document.querySelector(sel);
            if (el && el.offsetParent !== null) { el.click(); return 'CLICKED'; }
        } catch {}
    }
    // Fallback: find any button containing "temporary" text
    const btns = [...document.querySelectorAll('button')].filter(b => b.textContent?.toLowerCase().includes('temporary'));
    if (btns[0]) { btns[0].click(); return 'CLICKED_BY_TEXT'; }
    return 'NOT_FOUND';
})()
`;

// SET_MODEL_SCRIPT — opens model picker and clicks the model with matching name
const SET_MODEL_SCRIPT = (modelName: string) => `
(async function() {
    const MODEL_PICKER_SELECTORS = [
        'button[aria-haspopup="listbox"]',
        '[data-testid="model-selector-dropdown"]',
        'button[aria-label*="model" i]',
        '.model-selector button',
        'button[aria-label*="GPT" i]',
        'button[aria-label*="Claude" i]',
        'button[aria-label*="Gemini" i]',
    ];
    let picker = null;
    for (const sel of MODEL_PICKER_SELECTORS) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) { picker = el; break; }
    }
    if (!picker) return 'PICKER_NOT_FOUND';
    picker.click();
    await new Promise(r => setTimeout(r, 500));

    const modelName = ${JSON.stringify(modelName)}.toLowerCase();
    const options = [...document.querySelectorAll('[role="option"], [role="menuitemradio"], li')];
    const match = options.find(o => o.textContent?.toLowerCase().includes(modelName));
    if (match) { match.click(); return 'MODEL_SET'; }
    return 'MODEL_NOT_FOUND';
})()
`;

// SELECT_PROJECT_SCRIPT — navigates to a project by name
const SELECT_PROJECT_SCRIPT = (projectName: string) => `
(async function() {
    const name = ${JSON.stringify(projectName)}.toLowerCase();
    // Claude.ai projects in sidebar
    const links = [...document.querySelectorAll('nav a, [role="navigation"] a, aside a')];
    const match = links.find(l => l.textContent?.toLowerCase().includes(name));
    if (match) { match.click(); return 'CLICKED'; }
    return 'NOT_FOUND';
})()
`;

// ENABLE_DEV_MODE_SCRIPT — ChatGPT specific
const ENABLE_DEV_MODE_SCRIPT = `
(async function() {
    // ChatGPT settings → developer mode
    const SELECTORS = [
        'button[aria-label="Developer mode"]',
        '[data-testid="developer-mode-toggle"]',
    ];
    for (const sel of SELECTORS) {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) { el.click(); return 'TOGGLED'; }
    }
    // Try clicking settings first
    const settingsBtn = document.querySelector('button[aria-label="Settings"], button[data-testid="profile-button"]');
    if (settingsBtn) {
        settingsBtn.click();
        await new Promise(r => setTimeout(r, 500));
        const devToggle = document.querySelector('[aria-label*="developer" i]');
        if (devToggle) { devToggle.click(); return 'TOGGLED_VIA_SETTINGS'; }
    }
    return 'NOT_FOUND';
})()
`;

export async function executeChatNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<ChatExecResult> {
    const {
        chatPaneId,
        chatPrompt = '',
        chatProvider = 'chat',
        chatOutputSchema,
        chatAction = 'send-message',
        chatModel,
        chatProject,
        chatNewConversationFirst,
        chatResponseTimeout,
    } = node.data;

    if (!chatPaneId?.trim()) {
        throw new Error(`Chat node "${node.id}" has no target chat pane selected`);
    }

    if (dependencies.dryRun) {
        context.logs.push(`[DRY-RUN] Chat [${chatPaneId}]: ${chatAction} ${chatPrompt.slice(0, 50)}`);
        return { response: '[DRY-RUN]', provider: chatProvider, paneId: chatPaneId };
    }

    if (!chatCommandService.isRegistered(chatPaneId)) {
        throw new Error(
            `Chat node "${node.id}": pane "${chatPaneId}" is not registered. ` +
            `Make sure the Chat pane is open in the same space as the workflow and the AI page is loaded.`
        );
    }

    const responseTimeoutMs = chatResponseTimeout ? chatResponseTimeout * 1000 : 120000;

    // If chatNewConversationFirst is set, start a new conversation before anything else
    if (chatNewConversationFirst && chatAction === 'send-message') {
        context.logs.push(`Chat [${chatPaneId}]: starting new conversation first`);
        await chatCommandService.execute(chatPaneId, NEW_CONVERSATION_SCRIPT);
        await new Promise((r) => setTimeout(r, 1000));
    }

    // Branch on chatAction
    switch (chatAction) {
        case 'new-conversation': {
            context.logs.push(`Chat [${chatPaneId}]: creating new conversation`);
            const result = await chatCommandService.execute(chatPaneId, NEW_CONVERSATION_SCRIPT);
            return { response: String(result), provider: chatProvider, paneId: chatPaneId };
        }

        case 'ephemeral-chat': {
            context.logs.push(`Chat [${chatPaneId}]: starting ephemeral/temporary chat`);
            const result = await chatCommandService.execute(chatPaneId, EPHEMERAL_CHAT_SCRIPT);
            return { response: String(result), provider: chatProvider, paneId: chatPaneId };
        }

        case 'set-model': {
            if (!chatModel?.trim()) {
                throw new Error(`Chat node "${node.id}": chatModel is required for set-model action`);
            }
            context.logs.push(`Chat [${chatPaneId}]: setting model to "${chatModel}"`);
            const result = await chatCommandService.execute(chatPaneId, SET_MODEL_SCRIPT(chatModel));
            return { response: String(result), provider: chatProvider, paneId: chatPaneId };
        }

        case 'select-project': {
            if (!chatProject?.trim()) {
                throw new Error(`Chat node "${node.id}": chatProject is required for select-project action`);
            }
            context.logs.push(`Chat [${chatPaneId}]: selecting project "${chatProject}"`);
            const result = await chatCommandService.execute(chatPaneId, SELECT_PROJECT_SCRIPT(chatProject));
            return { response: String(result), provider: chatProvider, paneId: chatPaneId };
        }

        case 'enable-developer-mode': {
            context.logs.push(`Chat [${chatPaneId}]: enabling developer mode`);
            const result = await chatCommandService.execute(chatPaneId, ENABLE_DEV_MODE_SCRIPT);
            return { response: String(result), provider: chatProvider, paneId: chatPaneId };
        }

        case 'get-last-response': {
            context.logs.push(`Chat [${chatPaneId}]: getting last response`);
            const response = String(await chatCommandService.execute(chatPaneId, WAIT_FOR_RESPONSE_SCRIPT(responseTimeoutMs)));
            return { response, provider: chatProvider, paneId: chatPaneId };
        }

        case 'send-message':
        default: {
            const resolvedPrompt = String(resolveValue(chatPrompt, context));
            context.logs.push(`Chat [${chatPaneId}]: injecting prompt (${resolvedPrompt.length} chars)`);

            const injectResult = await chatCommandService.execute(chatPaneId, INJECT_SCRIPT(resolvedPrompt));

            if (injectResult === 'NO_INPUT') {
                throw new Error(
                    `Chat node "${node.id}": no input field found. Make sure the AI interface is loaded in the pane.`
                );
            }

            context.logs.push(`Chat [${chatPaneId}]: sent (${injectResult}), waiting for response...`);

            const response = String(await chatCommandService.execute(chatPaneId, WAIT_FOR_RESPONSE_SCRIPT(responseTimeoutMs)));

            let parsed: unknown = undefined;
            if (chatOutputSchema && response !== 'TIMEOUT') {
                try {
                    const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/) ?? response.match(/(\{[\s\S]*\})/);
                    if (jsonMatch) parsed = JSON.parse(jsonMatch[1]);
                } catch { /* keep raw */ }
            }

            context.logs.push(`Chat [${chatPaneId}]: received ${response.length} chars`);
            return { response, provider: chatProvider, paneId: chatPaneId, parsed };
        }
    }
}
