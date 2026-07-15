import { defineConfig } from "vitepress";

const zhNav = [
  { text: "快速开始", link: "/guide/quick-start" },
  { text: "运行时 API", link: "/guide/runtime-api" },
  { text: "工具包", link: "/guide/plugin-kit" },
  { text: "API 契约", link: "/guide/plugin-api-contract" },
  { text: "调试与发布", link: "/guide/debug-and-release" }
];

const enNav = [
  { text: "Quick Start", link: "/en/guide/quick-start" },
  { text: "Runtime API", link: "/en/guide/runtime-api" },
  { text: "Plugin Kit", link: "/en/guide/plugin-kit" },
  { text: "API Contract", link: "/en/guide/plugin-api-contract" },
  { text: "Debug & Release", link: "/en/guide/debug-and-release" }
];

const zhSidebar = [
  {
    text: "开始",
    items: [
      { text: "文档首页", link: "/" },
      { text: "快速开始", link: "/guide/quick-start" },
      { text: "运行时 API", link: "/guide/runtime-api" },
      { text: "Temporal", link: "/guide/runtime-api#temporal" },
      { text: "Intl", link: "/guide/runtime-api#intl" },
      { text: "工具包", link: "/guide/plugin-kit" },
      { text: "HTML 解析", link: "/guide/plugin-kit#html-解析" },
      { text: "生命周期与结构", link: "/guide/runtime-and-structure" }
    ]
  },
  {
    text: "接口协议",
    items: [{ text: "插件 API 契约", link: "/guide/plugin-api-contract" }]
  },
  {
    text: "调试与交付",
    items: [
      { text: "调试与发布", link: "/guide/debug-and-release" },
      { text: "交付检查清单", link: "/guide/checklist" }
    ]
  }
];

const enSidebar = [
  {
    text: "Getting Started",
    items: [
      { text: "Home", link: "/en/" },
      { text: "Quick Start", link: "/en/guide/quick-start" },
      { text: "Runtime API", link: "/en/guide/runtime-api" },
      { text: "Temporal", link: "/en/guide/runtime-api#temporal" },
      { text: "Intl", link: "/en/guide/runtime-api#intl" },
      { text: "Plugin Kit", link: "/en/guide/plugin-kit" },
      { text: "HTML Parsing", link: "/en/guide/plugin-kit#html-parsing" },
      { text: "Lifecycle & Structure", link: "/en/guide/runtime-and-structure" }
    ]
  },
  {
    text: "API Protocol",
    items: [{ text: "Plugin API Contract", link: "/en/guide/plugin-api-contract" }]
  },
  {
    text: "Debug & Delivery",
    items: [
      { text: "Debug & Release", link: "/en/guide/debug-and-release" },
      { text: "Delivery Checklist", link: "/en/guide/checklist" }
    ]
  }
];

export default defineConfig({
  base: "/plugin-dev-docs/",
  lastUpdated: true,
  locales: {
    root: {
      label: "中文",
      lang: "zh-CN",
      title: "Breeze 插件开发文档",
      description: "面向第三方作者的 Breeze 插件开发手册",
      themeConfig: {
        nav: zhNav,
        sidebar: zhSidebar,
        socialLinks: [{ icon: "github", link: "https://github.com/deretame/Breeze" }],
        outline: { label: "本页目录" },
        docFooter: { prev: "上一页", next: "下一页" },
        lastUpdated: { text: "最后更新于" },
        darkModeSwitchLabel: "主题",
        lightModeSwitchTitle: "切换到浅色模式",
        darkModeSwitchTitle: "切换到深色模式",
        sidebarMenuLabel: "菜单",
        returnToTopLabel: "回到顶部",
        langMenuLabel: "切换语言"
      }
    },
    en: {
      label: "English",
      lang: "en-US",
      link: "/en/",
      title: "Breeze Plugin Development Docs",
      description: "Plugin development handbook for third-party Breeze authors",
      themeConfig: {
        nav: enNav,
        sidebar: enSidebar,
        socialLinks: [{ icon: "github", link: "https://github.com/deretame/Breeze" }],
        outline: { label: "On this page" },
        docFooter: { prev: "Previous", next: "Next" },
        lastUpdated: { text: "Last updated" },
        darkModeSwitchLabel: "Theme",
        lightModeSwitchTitle: "Switch to light mode",
        darkModeSwitchTitle: "Switch to dark mode",
        sidebarMenuLabel: "Menu",
        returnToTopLabel: "Return to top",
        langMenuLabel: "Change language"
      }
    }
  }
});
