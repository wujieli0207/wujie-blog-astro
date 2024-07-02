declare module 'astro:content' {
	interface Render {
		'.mdx': Promise<{
			Content: import('astro').MarkdownInstance<{}>['Content'];
			headings: import('astro').MarkdownHeading[];
			remarkPluginFrontmatter: Record<string, any>;
		}>;
	}
}

declare module 'astro:content' {
	interface Render {
		'.md': Promise<{
			Content: import('astro').MarkdownInstance<{}>['Content'];
			headings: import('astro').MarkdownHeading[];
			remarkPluginFrontmatter: Record<string, any>;
		}>;
	}
}

declare module 'astro:content' {
	type Flatten<T> = T extends { [K: string]: infer U } ? U : never;

	export type CollectionKey = keyof AnyEntryMap;
	export type CollectionEntry<C extends CollectionKey> = Flatten<AnyEntryMap[C]>;

	export type ContentCollectionKey = keyof ContentEntryMap;
	export type DataCollectionKey = keyof DataEntryMap;

	type AllValuesOf<T> = T extends any ? T[keyof T] : never;
	type ValidContentEntrySlug<C extends keyof ContentEntryMap> = AllValuesOf<
		ContentEntryMap[C]
	>['slug'];

	export function getEntryBySlug<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		// Note that this has to accept a regular string too, for SSR
		entrySlug: E
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;

	export function getDataEntryById<C extends keyof DataEntryMap, E extends keyof DataEntryMap[C]>(
		collection: C,
		entryId: E
	): Promise<CollectionEntry<C>>;

	export function getCollection<C extends keyof AnyEntryMap, E extends CollectionEntry<C>>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => entry is E
	): Promise<E[]>;
	export function getCollection<C extends keyof AnyEntryMap>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => unknown
	): Promise<CollectionEntry<C>[]>;

	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(entry: {
		collection: C;
		slug: E;
	}): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(entry: {
		collection: C;
		id: E;
	}): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		slug: E
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(
		collection: C,
		id: E
	): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;

	/** Resolve an array of entry references from the same collection */
	export function getEntries<C extends keyof ContentEntryMap>(
		entries: {
			collection: C;
			slug: ValidContentEntrySlug<C>;
		}[]
	): Promise<CollectionEntry<C>[]>;
	export function getEntries<C extends keyof DataEntryMap>(
		entries: {
			collection: C;
			id: keyof DataEntryMap[C];
		}[]
	): Promise<CollectionEntry<C>[]>;

	export function reference<C extends keyof AnyEntryMap>(
		collection: C
	): import('astro/zod').ZodEffects<
		import('astro/zod').ZodString,
		C extends keyof ContentEntryMap
			? {
					collection: C;
					slug: ValidContentEntrySlug<C>;
				}
			: {
					collection: C;
					id: keyof DataEntryMap[C];
				}
	>;
	// Allow generic `string` to avoid excessive type errors in the config
	// if `dev` is not running to update as you edit.
	// Invalid collection names will be caught at build time.
	export function reference<C extends string>(
		collection: C
	): import('astro/zod').ZodEffects<import('astro/zod').ZodString, never>;

	type ReturnTypeOrOriginal<T> = T extends (...args: any[]) => infer R ? R : T;
	type InferEntrySchema<C extends keyof AnyEntryMap> = import('astro/zod').infer<
		ReturnTypeOrOriginal<Required<ContentConfig['collections'][C]>['schema']>
	>;

	type ContentEntryMap = {
		"blog": {
"front/css/pc-responsive-layout-solution.md": {
	id: "front/css/pc-responsive-layout-solution.md";
  slug: "front/css/pc-responsive-layout-solution";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/develop/cookie-synchronization-extension.md": {
	id: "front/develop/cookie-synchronization-extension.md";
  slug: "front/develop/cookie-synchronization-extension";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/develop/personal-website-for-free-https.md": {
	id: "front/develop/personal-website-for-free-https.md";
  slug: "front/develop/personal-website-for-free-https";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/engineering/clean-code-lint-standard.md": {
	id: "front/engineering/clean-code-lint-standard.md";
  slug: "front/engineering/clean-code-lint-standard";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/engineering/git-collaborative-workflow.md": {
	id: "front/engineering/git-collaborative-workflow.md";
  slug: "front/engineering/git-collaborative-workflow";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/engineering/redux/redux-principle1-overview.md": {
	id: "front/engineering/redux/redux-principle1-overview.md";
  slug: "front/engineering/redux/redux-principle1-overview";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/engineering/redux/redux-principle2-toolbox.md": {
	id: "front/engineering/redux/redux-principle2-toolbox.md";
  slug: "front/engineering/redux/redux-principle2-toolbox";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/engineering/redux/redux-principle3-middleware.md": {
	id: "front/engineering/redux/redux-principle3-middleware.md";
  slug: "front/engineering/redux/redux-principle3-middleware";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/javascript/array-method-summary.md": {
	id: "front/javascript/array-method-summary.md";
  slug: "front/javascript/array-method-summary";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/javascript/front-end-strategy-pattern-practice.md": {
	id: "front/javascript/front-end-strategy-pattern-practice.md";
  slug: "front/javascript/front-end-strategy-pattern-practice";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/javascript/inheritance-implementation.md": {
	id: "front/javascript/inheritance-implementation.md";
  slug: "front/javascript/inheritance-implementation";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/javascript/what-is-an-array-like.md": {
	id: "front/javascript/what-is-an-array-like.md";
  slug: "front/javascript/what-is-an-array-like";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/performance/front-performance-debounce-throttle.md": {
	id: "front/performance/front-performance-debounce-throttle.md";
  slug: "front/performance/front-performance-debounce-throttle";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/performance/front-performance-lazy-loading-images.md": {
	id: "front/performance/front-performance-lazy-loading-images.md";
  slug: "front/performance/front-performance-lazy-loading-images";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/performance/select-virtual-scrolling-optimize.md": {
	id: "front/performance/select-virtual-scrolling-optimize.md";
  slug: "front/performance/select-virtual-scrolling-optimize";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/react/react-principle-core-package-structure.md": {
	id: "front/react/react-principle-core-package-structure.md";
  slug: "front/react/react-principle-core-package-structure";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/react/react-principle-createElement.md": {
	id: "front/react/react-principle-createElement.md";
  slug: "front/react/react-principle-createelement";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/vite/develop-upgrade-vite-step.md": {
	id: "front/vite/develop-upgrade-vite-step.md";
  slug: "front/vite/develop-upgrade-vite-step";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/vite/vite-principle1-start-vite-project.md": {
	id: "front/vite/vite-principle1-start-vite-project.md";
  slug: "front/vite/vite-principle1-start-vite-project";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/vite/vite-principle2-resolve-config.md": {
	id: "front/vite/vite-principle2-resolve-config.md";
  slug: "front/vite/vite-principle2-resolve-config";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/vite/vite-principle3-vite-optimizeDeps.md": {
	id: "front/vite/vite-principle3-vite-optimizeDeps.md";
  slug: "front/vite/vite-principle3-vite-optimizedeps";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/vite/vite-principle4-dev-plugin.md": {
	id: "front/vite/vite-principle4-dev-plugin.md";
  slug: "front/vite/vite-principle4-dev-plugin";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/vite/vite-principle5-hmr.md": {
	id: "front/vite/vite-principle5-hmr.md";
  slug: "front/vite/vite-principle5-hmr";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/vue/pinia-principle.md": {
	id: "front/vue/pinia-principle.md";
  slug: "front/vue/pinia-principle";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/vue/vue-performance-optimization.md": {
	id: "front/vue/vue-performance-optimization.md";
  slug: "front/vue/vue-performance-optimization";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/vue/vue-principle-component-mount-process.md": {
	id: "front/vue/vue-principle-component-mount-process.md";
  slug: "front/vue/vue-principle-component-mount-process";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/vue/vue-principle-component-update-process.md": {
	id: "front/vue/vue-principle-component-update-process.md";
  slug: "front/vue/vue-principle-component-update-process";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/vue/vue-principle-reactive.md": {
	id: "front/vue/vue-principle-reactive.md";
  slug: "front/vue/vue-principle-reactive";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/vue/vue-principle-template-ref.md": {
	id: "front/vue/vue-principle-template-ref.md";
  slug: "front/vue/vue-principle-template-ref";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/vue/vue-promise-error-catch.md": {
	id: "front/vue/vue-promise-error-catch.md";
  slug: "front/vue/vue-promise-error-catch";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/vue/vue-router-principle1-create-router.md": {
	id: "front/vue/vue-router-principle1-create-router.md";
  slug: "front/vue/vue-router-principle1-create-router";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/vue/vue-router-principle2-parse-url.md": {
	id: "front/vue/vue-router-principle2-parse-url.md";
  slug: "front/vue/vue-router-principle2-parse-url";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"front/vue/vue-url-parameter-encryption.md": {
	id: "front/vue/vue-url-parameter-encryption.md";
  slug: "front/vue/vue-url-parameter-encryption";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"personal/2021-annual-summary.md": {
	id: "personal/2021-annual-summary.md";
  slug: "personal/2021-annual-summary";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"personal/2022-annual-summary.md": {
	id: "personal/2022-annual-summary.md";
  slug: "personal/2022-annual-summary";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"personal/2022-half-yearly-summary.md": {
	id: "personal/2022-half-yearly-summary.md";
  slug: "personal/2022-half-yearly-summary";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"personal/2024-half-yearly-summary.md": {
	id: "personal/2024-half-yearly-summary.md";
  slug: "personal/2024-half-yearly-summary";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"personal/life-principle-honest.mdx": {
	id: "personal/life-principle-honest.mdx";
  slug: "personal/life-principle-honest";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"personal/life-principle-long-term.mdx": {
	id: "personal/life-principle-long-term.mdx";
  slug: "personal/life-principle-long-term";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"personal/life-principle-minimalism.mdx": {
	id: "personal/life-principle-minimalism.mdx";
  slug: "personal/life-principle-minimalism";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".mdx"] };
"personal/reboot-does-it-really-work.md": {
	id: "personal/reboot-does-it-really-work.md";
  slug: "personal/reboot-does-it-really-work";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
"reading/the-wages-of-humanity.md": {
	id: "reading/the-wages-of-humanity.md";
  slug: "reading/the-wages-of-humanity";
  body: string;
  collection: "blog";
  data: InferEntrySchema<"blog">
} & { render(): Render[".md"] };
};
"pages": {
"about.md": {
	id: "about.md";
  slug: "about";
  body: string;
  collection: "pages";
  data: InferEntrySchema<"pages">
} & { render(): Render[".md"] };
};
"projects": {
"hack-thinking.md": {
	id: "hack-thinking.md";
  slug: "hack-thinking";
  body: string;
  collection: "projects";
  data: InferEntrySchema<"projects">
} & { render(): Render[".md"] };
"jike-export.md": {
	id: "jike-export.md";
  slug: "jike-export";
  body: string;
  collection: "projects";
  data: InferEntrySchema<"projects">
} & { render(): Render[".md"] };
};

	};

	type DataEntryMap = {
		
	};

	type AnyEntryMap = ContentEntryMap & DataEntryMap;

	export type ContentConfig = typeof import("../src/content/config.js");
}
