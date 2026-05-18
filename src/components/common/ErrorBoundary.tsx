import React from 'react';
import i18n from '../../i18n';

interface Props {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    resetKey?: string;
}

interface State {
    hasError: boolean;
}

class ErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(): State {
        return { hasError: true };
    }

    componentDidUpdate(prevProps: Props) {
        if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
            this.setState({ hasError: false });
        }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        if (import.meta.env.DEV) {
            console.error('[ErrorBoundary]', error.message, errorInfo.componentStack);
        }
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback ?? (
                <div className="min-h-[40vh] flex flex-col items-center justify-center text-center px-6">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                        <span className="text-red-400 text-xl">!</span>
                    </div>
                    <h2 className="text-lg font-semibold text-theme-text mb-2">
                        {i18n.t('error.title')}
                    </h2>
                    <p className="text-theme-text-muted text-sm mb-6 max-w-md">
                        {i18n.t('error.description')}
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={() => this.setState({ hasError: false })}
                            className="px-6 py-2 rounded-full bg-theme-surface hover:bg-theme-surface-hover text-theme-text text-sm font-medium transition-colors border border-theme-border"
                        >
                            {i18n.t('error.retry')}
                        </button>
                        <a
                            href="/"
                            className="px-6 py-2 rounded-full bg-brand-accent/20 hover:bg-brand-accent/30 text-brand-accent text-sm font-medium transition-colors border border-brand-accent/30"
                        >
                            {i18n.t('error.backHome')}
                        </a>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
