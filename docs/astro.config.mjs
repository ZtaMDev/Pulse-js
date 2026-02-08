// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
	site: 'https://pulse-js.vercel.app',
	output: 'static',
	adapter: vercel(),
	integrations: [
		starlight({
			title: 'Pulse-JS',
			favicon: '/favicon.svg',

            customCss: [
                './src/styles/custom.css',
            ],
			components: {
				Footer: './src/components/CustomFooter.astro',
				SiteTitle: './src/components/CustomSiteTitle.astro',
				SocialIcons: './src/components/CustomSocialIcons.astro',
			},
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
						{ label: 'Pulse', slug: 'core/pulse' },
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
						{ label: 'Astro', slug: 'integrations/astro' },
						{ label: 'TanStack', slug: 'integrations/tanstack' },
                    ],
                },
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
				{
					label: 'Changelog',
					autogenerate: { directory: 'changelog' },
				},
			],
		}),
	],
});
