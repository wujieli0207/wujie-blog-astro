---
title: '即刻导出'
description: 一个 chrome 插件，核心功能是导出即刻动态和收藏为本地文件
publishDate: '2024-05-08'
isFeatured: true
seo:
  image:
    src: '/project/jike-export.png'
    alt: 即刻导出
---

![Project preview](/project/jike-export.png)

## 功能简介

[即刻导出](https://jike-export.wujieli.com/)是一个 chrome 插件，核心功能是导出即刻动态和收藏为本地文件

- 导出自己和即友的动态列表，同时支持导出个人收藏
- 支持导出为 Markdown、纯文本、excel、csv 格式的文件
- 导出图片、动态链接、引用动态等完整信息
- 无缝导入 Obsidian、Heptabase 等笔记工具

## 技术方案

技术栈

- [wxt chrome 插件开发框架](https://wxt.dev/)
- [react](https://react.dev/)
- [ant design](https://ant-design.antgroup.com/index-cn)

使用的一些服务

- [Chrome 插件发布](https://chrome.google.com/webstore/developer/dashboard)
- [lemonsqueezy 支付](https://www.lemonsqueezy.com/)

## 想法的产生和实现

在今年 4 月份的时候，我看到一款到将 flomo 笔记为 markdown 文件的 chrome 插件：[flomo2md](https://flomo2md.dabing.one/)，项目代码是开源的，研究了一下源码发现并不复杂，恰好我刚刚入坑即刻，又是重新开始使用 Obsidian 管理笔记（Obisidian 核心就是 markdown 本地文件），所以灵感转了一个月，最后开发两周，大概在 5 月 8 号上线了“即刻导出”

代码的核心都是参考着 flomo2md 项目的实现方式：滚动获取所有动态 -> 将内容转换为特定格式 -> 导出内容，实现逻辑很清晰

其实实际代码开发的时间其实非常少，大量的时间投入在了

1. 宣传内容：包括在即刻的[宣传文案](https://web.okjike.com/originalPost/663b6d209185c305d112a50f), landing page 的内容
2. 平台的申请：主要是 lemonsqueezy 支付平台的申请和 chrome 插件发布的申请，尤其是插件发布申请，每次审核都需要两三天，如果有调整又要重新提交审核
3. 客服回复：包括即友的留言、通过微信加上好友的回复和交流

## 现在的结果怎样

目前在功能稳定的情况下已经停止一段时间的更新了，下面是这个项目对自己的一些收获

1. 产生了一些收入，虽然微不足道，但却是独立开发副业的第一份收入，是一个很好的开始
   ![](https://notesimgs.oss-cn-shanghai.aliyuncs.com/img/202406302142652.png)
2. 在即刻见到了很多大佬，也收到了一些大佬的点赞和关注，给自己小小涨了 100 粉丝。即刻应该是国内最像 Twitter 的社区了，内容也都非常的前沿
3. 重新理解商业，以前自己总是认为技术很重要，但现在觉得“产生价值”才是最重要的，技术只是手段，而发现问题并解决问题才是最终的目的

## 后续的计划

现在功能稳定的情况下，不打算在进行后续的更新了，即刻内容的导出毕竟是一个小众的项目

另一方面也是计划寻找新的项目，之前看到过一个观点：产品经理最重要的是决定不做什么，所以知道自己的产品边界在哪里，及时停下来，也许是更好的选择
