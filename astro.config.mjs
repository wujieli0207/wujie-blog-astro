import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwind from '@astrojs/tailwind'
import vercel from '@astrojs/vercel/static'
import robotsTxt from 'astro-robots-txt'
import { remarkReadingTime } from './src/utils/read-time'

// https://astro.build/config
export default defineConfig({
  site: 'https://www.wujieli.com',
  markdown: {
    remarkPlugins: [remarkReadingTime],
  },
  integrations: [
    mdx(),
    sitemap(),
    tailwind({
      applyBaseStyles: false,
    }),
    robotsTxt(),
  ],
  adapter: vercel({
    webAnalytics: {
      enabled: true,
    },
  }),
})
