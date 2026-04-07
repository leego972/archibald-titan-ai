/**
 * dataApi.ts — REMOVED
 * The Manus Forge Data API integration has been removed.
 * This stub exists only to prevent import errors during the transition.
 * Any call to callDataApi will throw immediately.
 */

export type DataApiCallOptions = {
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
  pathParams?: Record<string, unknown>;
  formData?: Record<string, unknown>;
};

export async function callDataApi(
  _apiId: string,
  _options: DataApiCallOptions = {}
): Promise<unknown> {
  throw new Error(
    "callDataApi is no longer available. The Manus Forge Data API has been removed. " +
    "Use a direct third-party API integration instead."
  );
}
