// Presentation-only slicing of a cached result array. Kept as a pure function
// (no class) so the page math is unit-testable offline without a server or cache.

export type PaginatedResult<T> = {
	page: number;
	pageSize: number;
	totalResults: number;
	totalPages: number;
	hasMore: boolean;
	results: T[];
};

export function paginate<T>(results: T[], page: number, pageSize: number): PaginatedResult<T> {
	const totalResults = results.length;
	const totalPages = Math.max(1, Math.ceil(totalResults / pageSize));
	const start = (page - 1) * pageSize;

	return {
		page,
		pageSize,
		totalResults,
		totalPages,
		// A page past the end yields an empty slice rather than an error.
		hasMore: page < totalPages,
		results: results.slice(start, start + pageSize)
	};
}
