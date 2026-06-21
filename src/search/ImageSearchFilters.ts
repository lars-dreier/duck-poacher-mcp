/**
 * The optional image-search filters passed through to DuckDuckGo. Mirrors the
 * filter fields of the image_search input schema.
 */
export type ImageSearchFilters = {
	time?: 'Day' | 'Week' | 'Month' | undefined;
	size?: 'Small' | 'Medium' | 'Large' | 'Wallpaper' | undefined;
	color?: 'color' | 'Monochrome' | undefined;
	type?: 'photo' | 'clipart' | 'gif' | 'transparent' | 'line' | undefined;
	layout?: 'Square' | 'Tall' | 'Wide' | undefined;
	license?: 'Any' | 'Public' | undefined;
	safeSearch?: boolean | undefined;
};
