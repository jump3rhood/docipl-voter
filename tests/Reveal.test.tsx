// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MotionProvider } from '@/components/MotionProvider';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';

describe('Reveal', () => {
  it('renders children', () => {
    render(
      <MotionProvider>
        <Reveal>
          <p>hello</p>
        </Reveal>
      </MotionProvider>,
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('RevealGroup renders all items in order', () => {
    render(
      <MotionProvider>
        <RevealGroup role="list">
          {['a', 'b', 'c'].map((t) => (
            <RevealItem key={t}>{t}</RevealItem>
          ))}
        </RevealGroup>
      </MotionProvider>,
    );
    const group = screen.getByRole('list');
    expect(Array.from(group.children).map((c) => c.textContent)).toEqual(['a', 'b', 'c']);
  });
});
