import React from 'react';

interface ProgressBarProps {
    value: number; // 0-100
    color?: string; // tailwind color class e.g. 'bg-violet-500'
    size?: 'sm' | 'md' | 'lg';
    showLabel?: boolean;
    label?: string;
    animated?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
    value,
    color = 'bg-violet-500',
    size = 'md',
    showLabel = false,
    label,
    animated = true,
}) => {
    const clamped = Math.min(100, Math.max(0, value));
    const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' };

    return (
        <div className="w-full">
            {(showLabel || label) && (
                <div className="flex justify-between mb-1">
                    {label && <span className="text-sm text-gray-300">{label}</span>}
                    {showLabel && (
                        <span className="text-sm font-semibold text-white">{clamped.toFixed(0)}%</span>
                    )}
                </div>
            )}
            <div className={`w-full bg-white/10 rounded-full ${heights[size]} overflow-hidden`}>
                <div
                    className={`${heights[size]} rounded-full ${color} ${animated ? 'transition-all duration-700 ease-out' : ''}`}
                    style={{ width: `${clamped}%` }}
                />
            </div>
        </div>
    );
};

interface BadgeProps {
    children: React.ReactNode;
    variant?: 'violet' | 'green' | 'yellow' | 'red' | 'blue' | 'gray';
    size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'violet', size = 'sm' }) => {
    const variants = {
        violet: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
        green: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        yellow: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        red: 'bg-red-500/20 text-red-300 border-red-500/30',
        blue: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        gray: 'bg-white/10 text-gray-300 border-white/20',
    };
    const sizes = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-3 py-1' };

    return (
        <span
            className={`inline-flex items-center rounded-full border font-medium ${variants[variant]} ${sizes[size]}`}
        >
            {children}
        </span>
    );
};

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    label?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', label }) => {
    const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' };
    return (
        <div className="flex flex-col items-center gap-3">
            <div
                className={`${sizes[size]} border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin`}
            />
            {label && <p className="text-gray-400 text-sm animate-pulse">{label}</p>}
        </div>
    );
};

interface CardProps {
    children: React.ReactNode;
    className?: string;
    hoverable?: boolean;
    onClick?: () => void;
    id?: string;
}

export const Card: React.FC<CardProps> = ({ children, className = '', hoverable, onClick, id }) => (
    <div
        id={id}
        onClick={onClick}
        className={`
      bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm
      ${hoverable ? 'cursor-pointer hover:bg-white/10 hover:border-violet-500/50 hover:shadow-lg hover:shadow-violet-500/10 transition-all duration-200' : ''}
      ${className}
    `}
    >
        {children}
    </div>
);

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    loading?: boolean;
    icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
    children,
    variant = 'primary',
    size = 'md',
    loading,
    icon,
    className = '',
    disabled,
    ...rest
}) => {
    const variants = {
        primary:
            'bg-violet-600 hover:bg-violet-500 text-white border-transparent shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40',
        secondary:
            'bg-white/10 hover:bg-white/15 text-white border-white/20 hover:border-white/30',
        ghost: 'bg-transparent hover:bg-white/5 text-gray-300 hover:text-white border-transparent',
        danger: 'bg-red-600/80 hover:bg-red-500 text-white border-transparent shadow-lg shadow-red-500/20',
    };
    const sizes = {
        sm: 'text-sm px-4 py-2 rounded-lg gap-1.5',
        md: 'text-sm px-5 py-2.5 rounded-xl gap-2',
        lg: 'text-base px-7 py-3.5 rounded-xl gap-2.5',
    };

    return (
        <button
            disabled={disabled || loading}
            className={`
        inline-flex items-center justify-center font-semibold border transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
            {...rest}
        >
            {loading ? (
                <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin" />
            ) : (
                icon
            )}
            {children}
        </button>
    );
};

interface DifficultyBadgeProps {
    difficulty: 'easy' | 'medium' | 'hard';
}

export const DifficultyBadge: React.FC<DifficultyBadgeProps> = ({ difficulty }) => {
    const map = {
        easy: 'green' as const,
        medium: 'yellow' as const,
        hard: 'red' as const,
    };
    return <Badge variant={map[difficulty]}>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</Badge>;
};

interface QuestionTypeLabelProps {
    type: string;
}

export const QuestionTypeLabel: React.FC<QuestionTypeLabelProps> = ({ type }) => {
    const labels: Record<string, string> = {
        mcq: 'MCQ',
        short_answer: 'Short Answer',
        debugging: 'Debugging',
        scenario: 'Scenario',
        coding: 'Coding',
        project: 'Project',
    };
    return (
        <Badge variant="blue" size="sm">
            {labels[type] ?? type}
        </Badge>
    );
};
