export type Image = {
  src: string
  alt?: string
  caption?: string
}

export type Link = {
  text: string
  href: string
}

export type Hero = {
  title?: string
  text?: string
  image?: Image
  actions?: Link[]
}

export type Subscribe = {
  title?: string
  text?: string
  formUrl: string
}

export type SiteConfig = {
  logo?: Image
  title: string
  subtitle?: string
  description: string
  image?: Image
  headerNavLinks?: Link[]
  footerNavLinks?: Link[]
  socialLinks?: Link[]
  hero?: Hero
  subscribe?: Subscribe
  postsPerPage?: number
  projectsPerPage?: number
  googleAnalyticsId?: string
}

const siteConfig: SiteConfig = {
  title: '旅行者计划',
  subtitle: '人们会被自己热爱的事物改变，而没有人因为给予而贫穷',
  description: '人们会被自己热爱的事物改变，而没有人因为给予而贫穷',
  image: {
    src: '/og.png',
    alt: '人们会被自己热爱的事物改变，而没有人因为给予而贫穷',
  },
  headerNavLinks: [
    {
      text: '首页',
      href: '/',
    },
    {
      text: '项目',
      href: '/projects',
    },
    {
      text: '博客',
      href: '/blog',
    },
    {
      text: '标签',
      href: '/tags',
    },
    {
      text: '关于',
      href: '/about',
    },
  ],
  footerNavLinks: [
    // {
    //   text: 'Contact',
    //   href: '/contact',
    // },
  ],
  socialLinks: [
    {
      text: 'Github',
      href: 'https://github.com/wujieli0207',
    },
    {
      text: 'X/Twitter',
      href: 'https://x.com/li_wujie',
    },
    {
      text: '独立开发沉思录',
      href: 'https://www.hackthinking.com/',
    },
    {
      text: '即刻导出',
      href: 'https://jike-export.wujieli.com/',
    },
  ],
  hero: {
    title: '你好，同路人',
    text: '欢迎来到我的博客，在这里我会记录我关于技术、产品、设计、商业、个人生活的思考',
    image: {
      src: '/hero.jpg',
      alt: 'My blog is my digit garden',
    },
    actions: [
      // {
      //   text: 'Get in Touch',
      //   href: '/contact',
      // },
    ],
  },
  // subscribe: {
  //   title: 'Subscribe to Dante Newsletter',
  //   text: 'One update per week. All the latest posts directly in your inbox.',
  //   formUrl: '#',
  // },
  postsPerPage: 8,
  projectsPerPage: 8,
  googleAnalyticsId: 'G-PS72Y26W77',
}

export default siteConfig
