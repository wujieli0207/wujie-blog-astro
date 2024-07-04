import { defineConfig } from 'astro/config'
import mdx from '@astrojs/mdx'
import sitemap from '@astrojs/sitemap'
import tailwind from '@astrojs/tailwind'
import vercel from '@astrojs/vercel/static'
import robotsTxt from 'astro-robots-txt'
import customToc from 'astro-custom-toc'
import { remarkReadingTime } from './src/utils/read-time'

// https://astro.build/config
export default defineConfig({
  site: 'https://www.wujieli.com',
  markdown: {
    remarkPlugins: [remarkReadingTime],
  },
  integrations: [
    customToc({
      template: (html) => {
        return `
<aside class="toc">
    <h2>目录</h2>
    <nav>
        ${html}
    </nav>
</aside>`.trim()
      },
    }),
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
