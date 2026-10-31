import { test, expect } from '@playwright/test';

test('document vierge, bâti, pendule, sauvegarde automatique, rechargement et historique', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouveau', exact: true }).click();
  await page.getByRole('button', { name: '+ Bâti fixe', exact: true }).click();
  await page.getByRole('button', { name: '+ Solide', exact: true }).click();
  await page.getByRole('button', { name: 'Pivot', exact: true }).click();
  await page.getByLabel('Scène mécanique 2D interactive').click();
  await expect(page.getByText('Liaisons (1)')).toBeVisible();
  await page.getByLabel('Titre du mécanisme').fill('Pendule construit dans Chromium');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('kineo.autosave.v3') ?? '{}').meta?.title)).toBe('Pendule construit dans Chromium');
  page.on('dialog', (d) => d.accept());
  await page.reload();
  await expect(page.getByLabel('Titre du mécanisme')).toHaveValue('Pendule construit dans Chromium');
  await page.getByRole('button', { name: 'Analyse / Simulation', exact: true }).click();
  await page.getByRole('button', { name: 'Analyser et assembler' }).click();
  await expect(page.getByLabel('Résultats numériques')).toContainText('converged');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(async () => (await page.getByTestId('simulation-time').innerText())).not.toBe('t = 0.000 s');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  expect(errors).toEqual([]);
});

test('formes, placement multiple, échappement et nomenclature synchronisée', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Nouveau', exact: true }).click();
  await page.getByRole('button', { name: '+ Bâti fixe', exact: true }).click();
  await page.getByRole('button', { name: '+ Solide', exact: true }).click();

  await page.getByRole('button', { name: 'Pivot', exact: true }).click();
  await page.getByLabel('Scène mécanique 2D interactive').click();
  await page.getByLabel('Scène mécanique 2D interactive').click();
  await expect(page.getByText('Liaisons (2)')).toBeVisible();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Nomenclature', exact: true }).click();
  await expect(page.getByRole('table').first()).toContainText('S0');
  await expect(page.getByRole('table').first()).toContainText('S1');
  await expect(page.getByRole('table').nth(1)).toContainText('L1');
  await page.getByRole('table').first().locator('tbody tr').nth(1).click();
  await page.getByRole('button', { name: 'Propriétés', exact: true }).click();
  await page.getByLabel('Forme').selectOption('ellipse');
  await page.getByRole('button', { name: 'Nomenclature', exact: true }).click();
  await expect(page.getByRole('table').first()).toContainText('Ellipse');

  await page.getByRole('button', { name: 'Propriétés', exact: true }).click();
  await page.getByRole('button', { name: 'Encastrement au bâti', exact: true }).click();
  await expect(page.getByLabel('Orientation automatique (tangente)')).toBeChecked();
  const canvas = page.getByLabel('Scène mécanique 2D interactive');
  const canvasBounds = await canvas.boundingBox();
  if (!canvasBounds) throw new Error('Canvas 2D is not visible');
  await canvas.click({ position: { x: canvasBounds.width * 0.68, y: canvasBounds.height / 2 } });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Nomenclature', exact: true }).click();
  await expect(page.getByRole('table').first()).toContainText('Fixé au sol');
  await page.screenshot({ path: 'docs/evidence/v0.3.1-nomenclature.png', fullPage: true });
});

test('bielle-manivelle calculée, trajectoire, SVG/PNG et JSON réouvrable', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Analyse / Simulation', exact: true }).click();
  await page.getByRole('button', { name: 'Analyser et assembler' }).click();
  const results = page.getByLabel('Résultats numériques');
  await expect(results).toContainText('converged');
  await expect(results.locator('div').filter({ has: page.locator('dt', { hasText: /^Mobilité locale$/ }) })).toContainText('1');
  await page.getByLabel('Point suivi · solide').selectOption('eq_3');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(async () => Number((await page.getByTestId('simulation-time').innerText()).match(/[\d.]+/)?.[0] ?? 0)).toBeGreaterThan(.3);
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect.poll(async () => Number((await page.getByText(/Trajectoire cyan/).innerText()).match(/:\s*(\d+) points/)?.[1] ?? 0)).toBeGreaterThan(0);
  await page.screenshot({ path: 'docs/evidence/v0.3.1-simulation.png', fullPage: true });
  for (const button of ['Exporter SVG', 'PNG 1600 px', 'Enregistrer JSON']) {
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: button, exact: true }).click();
    const artifact = await download; expect(await artifact.failure()).toBeNull();
    if (button === 'Enregistrer JSON') {
      const path = await artifact.path(); expect(path).not.toBeNull();
      await page.locator('input[type=file]').setInputFiles(path!);
      await expect(page.getByText(/Ouvert :/)).toBeVisible();
    }
  }
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await expect(page.getByRole('application', { name: 'Graphe de connectivité mécanique' })).toBeVisible();
  await page.getByRole('button', { name: 'Split', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Vue mécanique 2D' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('sauvegarde corrompue récupérée sans écrasement silencieux', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('kineo.autosave.v3', 'corrompu'));
  await page.reload();
  await expect(page.getByText(/Sauvegarde locale incompatible ou corrompue/)).toBeVisible();
  await page.getByLabel('Titre du mécanisme').fill('Ne pas écraser');
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => localStorage.getItem('kineo.autosave.v3'))).toBe('corrompu');
  page.on('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Nouveau', exact: true }).click();
  await expect.poll(() => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('kineo.autosave.v3') ?? '{}').meta?.title; } catch { return ''; } })).toBe('Nouveau mécanisme');
  expect(await page.evaluate(() => Object.keys(localStorage).some((key) => key.includes('.recovery.')))).toBe(true);
});

test('import incompatible refusé, modifications protégées et annuler rétablir préservés', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Titre du mécanisme').fill('Travail à conserver');
  await page.locator('input[type=file]').setInputFiles({ name: 'incompatible.json', mimeType: 'application/json', buffer: Buffer.from('{"meta":{"schemaVersion":"4.0"}}') });
  await expect(page.getByText(/Import impossible/)).toBeVisible();
  await expect(page.getByLabel('Titre du mécanisme')).toHaveValue('Travail à conserver');
  page.on('dialog', (d) => d.dismiss());
  await page.getByRole('button', { name: 'Nouveau', exact: true }).click();
  await expect(page.getByLabel('Titre du mécanisme')).toHaveValue('Travail à conserver');
  const count = await page.locator('aside ul').first().locator('li').count();
  await page.getByRole('button', { name: '+ Solide', exact: true }).click();
  await expect(page.locator('aside ul').first().locator('li')).toHaveCount(count + 1);
  await page.getByTitle('Annuler (Ctrl+Z)').click();
  await expect(page.locator('aside ul').first().locator('li')).toHaveCount(count);
  await page.getByTitle('Rétablir (Ctrl+Y)').click();
  await expect(page.locator('aside ul').first().locator('li')).toHaveCount(count + 1);
});

test('paramètres géométriques modifiables et espace de travail à 1024 × 768', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Analyse / Simulation', exact: true }).click();
  await page.getByText('Générer une bielle-manivelle paramétrée', { exact: true }).click();
  await page.getByLabel('Rayon r', { exact: true }).fill('30');
  await page.getByLabel('Longueur L', { exact: true }).fill('80');
  await page.getByLabel('Axe guide (deg)', { exact: true }).fill('30');
  await page.getByRole('button', { name: 'Créer le mécanisme', exact: true }).click();
  await page.getByRole('button', { name: 'Analyser et assembler', exact: true }).click();
  await expect(page.getByLabel('Résultats numériques')).toContainText('converged');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'docs/evidence/v0.3.1-1024.png', fullPage: true });
});
