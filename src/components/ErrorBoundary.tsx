import { Component, type ReactNode } from 'react';

interface Props {
    children: ReactNode;
    fallbackMessage?: string;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    state: State = { hasError: false, error: null };

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo): void {
        console.error('[ErrorBoundary]', error, info.componentStack);
    }

    private handleReset = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    padding: '16px',
                    background: '#1c1212',
                    border: '1px solid #f85149',
                    borderRadius: '8px',
                    color: '#f0f6fc',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}>
                    <div style={{ fontWeight: 600, marginBottom: '8px', color: '#f85149' }}>
                        {this.props.fallbackMessage ?? 'Something went wrong'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#8b949e', marginBottom: '12px' }}>
                        {this.state.error?.message}
                    </div>
                    <button
                        onClick={this.handleReset}
                        style={{
                            padding: '4px 12px',
                            background: '#21262d',
                            color: '#f0f6fc',
                            border: '1px solid #30363d',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px',
                        }}
                    >
                        Retry
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
