// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
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

  it('server HTML is visible: CSS reveal class, no inline opacity', () => {
    const html = renderToString(
      <Reveal delay={0.08}>
        <p>hi</p>
      </Reveal>,
    );
    expect(html).toContain('class="reveal"');
    expect(html).toContain('animation-delay:0.08s');
    expect(html).not.toMatch(/opacity/);
  });

  it('RevealGroup staggers item delays by index', () => {
    render(
      <RevealGroup role="list" className="grid">
        {['a', 'b', 'c'].map((t) => (
          <RevealItem key={t} className="grid">
            {t}
          </RevealItem>
        ))}
      </RevealGroup>,
    );
    const items = Array.from(screen.getByRole('list').children) as HTMLElement[];
    expect(items.map((el) => el.style.animationDelay)).toEqual(['', '0.04s', '0.08s']);
    expect(items.every((el) => el.classList.contains('reveal') && el.classList.contains('grid'))).toBe(true);
  });
});
