'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { m, type Variants } from 'motion/react';

const TRANSITION = { duration: 0.3, ease: 'easeOut' } as const;

export function Reveal({
  children,
  delay = 0,
  as = 'div',
  className,
}: {
  children: ReactNode;
  delay?: number;
  as?: 'div' | 'section' | 'li';
  className?: string;
}) {
  const Comp = m[as];
  return (
    <Comp
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...TRANSITION, delay }}
    >
      {children}
    </Comp>
  );
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: TRANSITION },
};

export function RevealGroup({
  children,
  stagger = 0.04,
  className,
  ...rest
}: {
  children: ReactNode;
  stagger?: number;
  className?: string;
} & Omit<ComponentPropsWithoutRef<'div'>, 'children' | 'className'>) {
  const variants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: stagger } },
  };
  return (
    <m.div
      {...(rest as object)}
      className={className}
      variants={variants}
      initial="hidden"
      animate="show"
    >
      {children}
    </m.div>
  );
}

export function RevealItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <m.div className={className} variants={itemVariants}>
      {children}
    </m.div>
  );
}
