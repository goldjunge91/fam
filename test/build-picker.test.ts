import fs from 'node:fs';
import path from 'node:path';
import {
    buildCommandArgs,
    findVariant,
    menuOptions,
    submitCommandArgs,
    uploadQuestion,
} from '../scripts/build-picker-logic';

const repositoryRoot = path.resolve(__dirname, '..');

describe('scripts/build-picker.ts', () => {
	describe('menuOptions', () => {
		it('liefert für jeden Menü-Eintrag einen auflösbaren Profilwert', () => {
			// Regression für "Unbekanntes Profil.": Der Wert, den der Nutzer im
			// clack-Menü wählt, muss exakt dem Lookup-Schlüssel entsprechen.
			for (const option of menuOptions()) {
				expect(findVariant(option.value)).toBeDefined();
			}
		});

		it('deckt alle iOS-Build-Profile aus eas.json ab (ohne base)', () => {
			const easConfig = JSON.parse(
				fs.readFileSync(path.join(repositoryRoot, 'eas.json'), 'utf8'),
			) as { build: Record<string, unknown> };
			const expectedProfiles = Object.keys(easConfig.build).filter(
				(profile) => profile !== 'base',
			);

			const menuValues = menuOptions().map((option) => option.value);
			for (const profile of expectedProfiles) {
				expect(menuValues).toContain(profile);
			}
		});

		it('beschriftet lokale Varianten mit (lokal) und Cloud-Varianten mit (Cloud)', () => {
			for (const option of menuOptions()) {
				const variant = findVariant(option.value);
				expect(variant).toBeDefined();
				expect(option.label).toContain(variant?.local ? '(lokal)' : '(Cloud)');
			}
		});
	});

	describe('buildCommandArgs', () => {
		it('baut lokale Varianten mit dem local-Modus und einem fam.ipa-Ausgabepfad', () => {
			const variant = findVariant('preview-testflight-local');
			expect(variant).toBeDefined();
			const { command, args } = buildCommandArgs(variant as NonNullable<typeof variant>);

			expect(command).toBe('bash');
			expect(args[0]).toBe('scripts/eas-ios-build.sh');
			expect(args[1]).toBe('local');
			expect(args[2]).toBe('preview-testflight-local');
			expect(args).toContain('--output');
			expect(args[args.indexOf('--output') + 1]).toMatch(/fam\.ipa$/);
		});

		it('baut Cloud-Varianten ohne --output', () => {
			const variant = findVariant('production');
			expect(variant).toBeDefined();
			const { command, args } = buildCommandArgs(variant as NonNullable<typeof variant>);

			expect(args[1]).toBe('cloud');
			expect(args).not.toContain('--output');
		});
	});

	describe('submitCommandArgs', () => {
		it('liefert für lokale Store-Builds ein --path-Submit mit dem Basis-Profil', () => {
			const variant = findVariant('preview-testflight-local');
			expect(variant).toBeDefined();
			const submit = submitCommandArgs(
				variant as NonNullable<typeof variant>,
				'build/local/eas/preview-testflight-local/fam.ipa',
			);

			expect(submit).not.toBeNull();
			expect(submit?.args).toContain('preview-testflight');
			expect(submit?.args).toContain('--path');
			expect(submit?.args).not.toContain('--latest');
		});

		it('liefert für Cloud-Store-Builds ein --latest-Submit', () => {
			const variant = findVariant('production');
			expect(variant).toBeDefined();
			const submit = submitCommandArgs(variant as NonNullable<typeof variant>, null);

			expect(submit).not.toBeNull();
			expect(submit?.args).toContain('production');
			expect(submit?.args).toContain('--latest');
			expect(submit?.args).not.toContain('--path');
		});

		it('liefert für Nicht-Store-Profile kein Submit', () => {
			const variant = findVariant('development');
			expect(variant).toBeDefined();
			expect(submitCommandArgs(variant as NonNullable<typeof variant>, null)).toBeNull();
		});
	});

	describe('uploadQuestion', () => {
		it('fragt bei Production nach App Store Connect', () => {
			const variant = findVariant('production');
			expect(uploadQuestion(variant as NonNullable<typeof variant>)).toContain(
				'App Store Connect',
			);
		});

		it('fragt bei TestFlight-Profilen nach TestFlight', () => {
			const variant = findVariant('preview-testflight-local');
			expect(uploadQuestion(variant as NonNullable<typeof variant>)).toContain('TestFlight');
		});

		it('liefert für Nicht-Store-Profile keine Frage', () => {
			const variant = findVariant('preview');
			expect(uploadQuestion(variant as NonNullable<typeof variant>)).toBeNull();
		});
	});
});
