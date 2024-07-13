const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    fontFamily: {
      sans: ['PingFang SC', 'Microsoft YaHei', ...defaultTheme.fontFamily.sans],
      serif: ['LXGW WenKai', ...defaultTheme.fontFamily.serif],
    },
    extend: {
      textColor: {
        main: 'rgb(var(--color-text-main) / <alpha-value>)',
      },
      backgroundColor: {
        main: 'rgb(var(--color-bg-main) / <alpha-value>)',
        muted: 'rgb(var(--color-bg-muted) / <alpha-value>)',
      },
      borderColor: {
        main: 'rgb(var(--color-border-main) / <alpha-value>)',
      },
      typography: (theme) => ({
        dante: {
          css: {
            '--tw-prose-body': theme('textColor.main / 100%'),
            '--tw-prose-headings': theme('textColor.main / 100%'),
            '--tw-prose-lead': theme('textColor.main / 100%'),
            '--tw-prose-links': theme('textColor.main / 100%'),
            '--tw-prose-bold': theme('textColor.main / 100%'),
            '--tw-prose-counters': theme('textColor.main / 100%'),
            '--tw-prose-bullets': theme('textColor.main / 100%'),
            '--tw-prose-hr': theme('borderColor.main / 100%'),
            '--tw-prose-quotes': theme('textColor.main / 100%'),
            '--tw-prose-quote-borders': theme('borderColor.main / 100%'),
            '--tw-prose-captions': theme('textColor.main / 100%'),
            '--tw-prose-code': theme('textColor.main / 100%'),
            '--tw-prose-pre-code': theme('colors.zinc.100'),
            '--tw-prose-pre-bg': theme('colors.zinc.800'),
            '--tw-prose-th-borders': theme('borderColor.main / 100%'),
            '--tw-prose-td-borders': theme('borderColor.main / 100%'),
          },
        },
        DEFAULT: {
          css: {
            a: {
              fontWeight: 'normal',
              textDecoration: 'none',
              textDecorationThickness: '1px',
              textUnderlineOffset: '2px',
              color: '#1675D9',
              '&:hover': {
                textDecorationStyle: 'solid',
                textDecoration: 'underline',
              },
            },
            'h1,h2,h3,h4,h5,h6': {
              fontFamily: theme('fontFamily.serif'),
              fontWeight: 500,
            },
            blockquote: {
              borderLeft: '2px solid #5678C7',
              fontSize: '0.8em',
              fontStyle: 'normal',
              paddingLeft: 2,
            },
          },
        },
      }),
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
