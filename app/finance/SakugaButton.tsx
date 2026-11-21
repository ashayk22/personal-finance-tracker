'use client';

import React, { type ButtonHTMLAttributes, type ReactNode } from 'react';

type SakugaButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  className?: string;
  variant?: 'primary' | 'secondary';
  children: ReactNode;
};

/** React-friendly wrapper around the Sakuga VFX custom element. */
export function SakugaButton({
  children,
  className = '',
  variant,
  type = 'button',
  ...props
}: SakugaButtonProps) {
  return React.createElement(
    'sakuga-button',
    {
      ...props,
      className,
      type,
      variant: (variant ?? (className.split(/\s+/).includes('ft-secondary') ? 'secondary' : 'primary')) === 'secondary' ? 'secondary' : undefined,
    },
    children,
  );
}
