import type { HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ interactive, className = '', ...rest }: CardProps) {
  return (
    <div
      className={`card ${interactive ? 'card--interactive' : ''} ${className}`.trim()}
      {...rest}
    />
  );
}
