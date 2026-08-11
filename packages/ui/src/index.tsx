import type { ButtonHTMLAttributes, HTMLAttributes, PropsWithChildren } from 'react';

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`button ${className}`} {...props} />;
}

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`} {...props} />;
}

export function StatusBadge({ children }: PropsWithChildren) {
  return <span className="status-badge">{children}</span>;
}
