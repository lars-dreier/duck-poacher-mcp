/**
 * One page of a result set together with the metadata describing where it sits.
 */
export default class Page<T> {
	public readonly page: number;
	public readonly pageSize: number;
	public readonly totalResults: number;
	public readonly totalPages: number;
	public readonly hasMore: boolean;
	public readonly results: T[];

	public constructor(allResults: T[], page: number, pageSize: number) {
		const totalResults: number = allResults.length;
		const totalPages: number = Math.max(1, Math.ceil(totalResults / pageSize));
		const start: number = (page - 1) * pageSize;

		this.page = page;
		this.pageSize = pageSize;
		this.totalResults = totalResults;
		this.totalPages = totalPages;
		// A page past the end yields an empty slice rather than an error.
		this.hasMore = page < totalPages;
		this.results = allResults.slice(start, start + pageSize);
	}
}
