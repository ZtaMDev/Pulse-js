// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	site: 'https://ztamdev.github.io/pulse-js',
	base: '/pulse-js',
	integrations: [
		starlight({
			title: 'Pulse-JS',
			favicon: '/favicon.svg',
			logo: {
				src: './src/assets/pulse.svg',
			},
            customCss: [
                './src/styles/custom.css',
            ],
			social: [
				{ label: 'GitHub', icon: 'github', href: 'https://github.com/ZtaMDev/pulse-js' },
			],
			sidebar: [
				{
					label: 'Start Here',
					items: [
						{ label: 'Getting Started', slug: 'guides/getting-started' },
						{ label: 'DevTools', slug: 'guides/devtools' },
					],
				},
				{
					label: 'Core Concepts',
					items: [
						{ label: 'Sources', slug: 'core/sources' },
						{ label: 'Guards', slug: 'core/guards' },
						{ label: 'Computed Values', slug: 'core/computed' },
					],
				},
                {
                    label: 'Advanced Features',
                    items: [
                        { label: 'Async & Race Conditions', slug: 'advanced/async-race' },
                        { label: 'Logic Composition', slug: 'advanced/composition' },
                        { label: 'Server-Side Rendering', slug: 'advanced/ssr' },
                    ],
                },
                {
                    label: 'Integrations',
                    items: [
                        { label: 'React', slug: 'integrations/react' },
                        { label: 'Vue', slug: 'integrations/vue' },
                        { label: 'Svelte', slug: 'integrations/svelte' },
                    ],
                },
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
			],
		}),
	],
});
