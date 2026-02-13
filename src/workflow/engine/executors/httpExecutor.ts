import type { Node } from 'reactflow';
import type { WorkflowNodeData, ExecutionContext, ExecutorDependencies } from '../../types';
import { resolveValue } from '../DataMapper';

export async function executeHttpNode(
    node: Node<WorkflowNodeData>,
    context: ExecutionContext,
    dependencies: ExecutorDependencies,
): Promise<unknown> {
    const rawUrl = node.data.httpUrl ?? '';
    if (!rawUrl.trim()) {
        throw new Error(`HTTP node "${node.id}" has no URL configured`);
    }

    const url = String(resolveValue(rawUrl, context));
    const method = node.data.httpMethod ?? 'GET';

    // Parse headers from JSON string (optional)
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (node.data.httpHeaders?.trim()) {
        const rawHeaders = resolveValue(node.data.httpHeaders, context);
        try {
            const parsed = typeof rawHeaders === 'string' ? JSON.parse(rawHeaders) : rawHeaders;
            if (parsed && typeof parsed === 'object') {
                headers = { ...headers, ...(parsed as Record<string, string>) };
            }
        } catch {
            // Ignore malformed headers
        }
    }

    // Apply authentication headers based on httpAuthType
    const authType = node.data.httpAuthType ?? 'none';
    if (authType !== 'none' && node.data.httpAuthValue?.trim()) {
        const authValue = String(resolveValue(node.data.httpAuthValue, context));
        if (authType === 'bearer') {
            headers['Authorization'] = `Bearer ${authValue}`;
        } else if (authType === 'basic') {
            // httpAuthValue should be "username:password"
            headers['Authorization'] = `Basic ${btoa(authValue)}`;
        } else if (authType === 'api-key') {
            const headerName = node.data.httpAuthHeader?.trim() || 'X-API-Key';
            headers[headerName] = authValue;
        }
    }

    // In dry-run mode: skip the actual fetch
    if (dependencies.dryRun) {
        context.logs.push(`[DRY-RUN] HTTP ${method} ${url}`);
        return { dryRun: true, method, url };
    }

    const init: RequestInit = { method, headers };

    // Redirect following (not directly supported in fetch API, but redirect: 'follow' is default)
    if (node.data.httpFollowRedirects === false) {
        init.redirect = 'manual';
    }

    if (method !== 'GET' && method !== 'DELETE' && node.data.httpBody?.trim()) {
        const rawBody = resolveValue(node.data.httpBody, context);
        init.body = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
    }

    context.logs.push(`HTTP ${method} ${url}`);

    const response = await fetch(url, init);
    const contentType = response.headers.get('content-type') ?? '';

    const responseType = node.data.httpResponseType ?? 'auto';
    let body: unknown;

    if (responseType === 'json') {
        body = await response.json();
    } else if (responseType === 'text') {
        body = await response.text();
    } else {
        // auto: detect from Content-Type
        if (contentType.includes('application/json')) {
            body = await response.json();
        } else {
            body = await response.text();
        }
    }

    if (!response.ok) {
        throw new Error(`HTTP ${method} ${url} → ${response.status} ${response.statusText}`);
    }

    return {
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body,
    };
}
