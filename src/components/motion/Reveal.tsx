import {
  Children,
  cloneElement,
  isValidElement,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';

// Pure-CSS reveal (see `.reveal` in globals.css): server HTML stays visible until
// the animation runs, and reduced-motion users get static content.

const cx = (...c: (string | undefined)[]) => c.filter(Boolean).join(' ');
const delayStyle = (delay: number): CSSProperties | undefined =>
  delay > 0 ? { animationDelay: `${delay}s` } : undefined;

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
  const Comp = as;
  return (
    <Comp className={cx('reveal', className)} style={delayStyle(delay)}>
      {children}
    </Comp>
  );
}

type RevealItemProps = {
  children: ReactNode;
  className?: string;
  /** Position within a RevealGroup; injected by the group. */
  index?: number;
  /** Seconds between items; injected by the group. */
  stagger?: number;
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
  let index = 0;
  return (
    <div {...rest} className={className}>
      {Children.map(children, (child) =>
        isValidElement(child) && child.type === RevealItem
          ? cloneElement(child as ReactElement<RevealItemProps>, { index: index++, stagger })
          : child,
      )}
    </div>
  );
}

export function RevealItem({ children, className, index = 0, stagger = 0.04 }: RevealItemProps) {
  return (
    <div className={cx('reveal', className)} style={delayStyle(index * stagger)}>
      {children}
    </div>
  );
}
