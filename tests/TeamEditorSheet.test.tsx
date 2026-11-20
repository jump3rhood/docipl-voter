// @vitest-environment jsdom
import { test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminTeam } from '@/lib/admin';
import { MAX_LOGO_BYTES } from '@/lib/logoValidation';

const updateTeamAction = vi.fn();
const createTeamAction = vi.fn();
vi.mock('@/app/admin/(protected)/teams/actions', () => ({
  updateTeamAction: (prev: unknown, fd: FormData) => updateTeamAction(prev, fd),
  createTeamAction: (prev: unknown, fd: FormData) => createTeamAction(prev, fd),
  reorderTeamsAction: vi.fn(),
}));

import { TeamEditorSheet } from '@/app/admin/(protected)/teams/TeamEditorSheet';

const team: AdminTeam = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Code Red',
  slug: 'code-red',
  logoUrl: null,
  accentColor: '#00ff00',
  displayOrder: 1,
  isActive: true,
};

const realCreate = URL.createObjectURL;
const realRevoke = URL.revokeObjectURL;

beforeEach(() => {
  updateTeamAction.mockReset();
  createTeamAction.mockReset();
  document.body.style.overflow = '';
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:http://localhost/preview-${++n}`);
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  URL.createObjectURL = realCreate;
  URL.revokeObjectURL = realRevoke;
});

function setup(t: AdminTeam | null = team) {
  const onClose = vi.fn();
  render(<TeamEditorSheet team={t} onClose={onClose} />);
  return { onClose };
}

function fileInput() {
  return document.querySelector<HTMLInputElement>('input[type="file"][name="logo"]')!;
}

test('edit sheet pre-fills name, colour, show on ballot; slug under Advanced', () => {
  setup();
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(screen.getByRole('heading', { name: 'Edit Code Red' })).toBeInTheDocument();
  expect(screen.getByLabelText('Name')).toHaveValue('Code Red');
  expect(screen.getByLabelText('Accent colour')).toHaveValue('#00ff00');
  expect(screen.getByLabelText('No colour')).not.toBeChecked();
  expect(screen.getByLabelText('Show on ballot')).toBeChecked();
  const slug = screen.getByLabelText('Slug');
  expect(slug).toHaveValue('code-red');
  const details = slug.closest('details');
  expect(details).not.toBeNull();
  expect(details!.querySelector('summary')).toHaveTextContent('Advanced');
  expect(details!.open).toBe(false);
  expect(document.querySelector('input[type="hidden"][name="id"]')).toHaveValue(team.id);
  expect(fileInput()).toHaveAttribute('accept', 'image/png,image/jpeg,image/webp');
});

test('oversize file shows Image must be 1 MB or smaller. and disables SAVE', async () => {
  setup();
  const big = new File([new Uint8Array(MAX_LOGO_BYTES + 1)], 'big.png', { type: 'image/png' });
  await userEvent.upload(fileInput(), big);
  expect(screen.getByRole('alert')).toHaveTextContent('Image must be 1 MB or smaller.');
  expect(screen.getByRole('button', { name: 'SAVE' })).toBeDisabled();
});

test('wrong type shows Use a PNG, JPG or WEBP image.', async () => {
  setup();
  const user = userEvent.setup({ applyAccept: false });
  await user.upload(fileInput(), new File(['gif'], 'logo.gif', { type: 'image/gif' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Use a PNG, JPG or WEBP image.');
  expect(screen.getByRole('button', { name: 'SAVE' })).toBeDisabled();
});

test('picked file shows preview img with blob: src', async () => {
  const { container } = render(<TeamEditorSheet team={team} onClose={vi.fn()} />);
  await userEvent.upload(fileInput(), new File(['png'], 'logo.png', { type: 'image/png' }));
  const img = container.ownerDocument.querySelector<HTMLImageElement>('img[data-testid="logo-preview"]');
  expect(img).not.toBeNull();
  expect(img!.getAttribute('src')).toMatch(/^blob:/);
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getByRole('button', { name: 'SAVE' })).toBeEnabled();
  await userEvent.upload(fileInput(), new File(['png2'], 'logo2.png', { type: 'image/png' }));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/preview-1');
  expect(img!.ownerDocument.querySelector('img[data-testid="logo-preview"]')).toHaveAttribute('src', 'blob:http://localhost/preview-2');
});

test('Escape and Cancel call onClose', async () => {
  const { onClose } = setup();
  await userEvent.keyboard('{Escape}');
  expect(onClose).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalledTimes(2);
});

test('ok result calls onClose; error result shows alert and stays open', async () => {
  updateTeamAction.mockResolvedValueOnce({ error: 'That slug is already used.' });
  const { onClose } = setup();
  await userEvent.click(screen.getByRole('button', { name: 'SAVE' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('That slug is already used.'));
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  const fd = updateTeamAction.mock.calls[0][1] as FormData;
  expect(fd.get('id')).toBe(team.id);
  expect(fd.get('name')).toBe('Code Red');
  expect(fd.get('isActive')).toBe('on');

  updateTeamAction.mockResolvedValueOnce({ ok: true });
  await userEvent.click(screen.getByRole('button', { name: 'SAVE' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
});

test('add sheet uses createTeamAction, has no Show on ballot, derives slug from name', async () => {
  createTeamAction.mockResolvedValueOnce({ ok: true });
  const { onClose } = setup(null);
  expect(screen.getByRole('heading', { name: 'Add team' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Show on ballot')).toBeNull();
  expect(document.querySelector('input[name="id"]')).toBeNull();
  await userEvent.type(screen.getByLabelText('Name'), 'Net Ninjas 2');
  expect(screen.getByLabelText('Slug')).toHaveValue('net-ninjas-2');
  await userEvent.click(screen.getByRole('button', { name: 'SAVE' }));
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  const fd = createTeamAction.mock.calls[0][1] as FormData;
  expect(fd.get('slug')).toBe('net-ninjas-2');
  expect(fd.get('name')).toBe('Net Ninjas 2');
});

test('slug strips accents (Müller → muller)', async () => {
  setup(null);
  await userEvent.type(screen.getByLabelText('Name'), 'Müller Smashers');
  expect(screen.getByLabelText('Slug')).toHaveValue('muller-smashers');
});

test('a slug error from the server opens the Advanced section', async () => {
  updateTeamAction.mockResolvedValueOnce({ error: 'That slug is already used.' });
  setup();
  const details = screen.getByLabelText('Slug').closest('details')!;
  expect(details.open).toBe(false);
  await userEvent.click(screen.getByRole('button', { name: 'SAVE' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('That slug is already used.'));
  expect(details.open).toBe(true);
});

test('a non-slug error leaves Advanced closed', async () => {
  updateTeamAction.mockResolvedValueOnce({ error: 'Name is required.' });
  setup();
  await userEvent.click(screen.getByRole('button', { name: 'SAVE' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Name is required.'));
  expect(screen.getByLabelText('Slug').closest('details')!.open).toBe(false);
});
