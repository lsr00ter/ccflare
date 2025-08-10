import { logError, RateLimitError } from "@ccflare/core";
import { Logger } from "@ccflare/logger";
import type { Provider } from "@ccflare/providers";
import type { Account } from "@ccflare/types";
import type { ProxyContext } from "./proxy-types";

const log = new Logger("ResponseProcessor");

// Status codes that should NOT trigger failover (successful responses)
const SUCCESS_STATUS_CODES = new Set([
	200, // OK - successful response
]);

// Note: All other status codes (4xx, 5xx) will trigger failover to try the next account
// This aggressive approach ensures maximum availability by attempting different accounts
// for any unsuccessful response

/**
 * Handles rate limit response for an account
 * @param account - The rate-limited account
 * @param rateLimitInfo - Parsed rate limit information
 * @param ctx - The proxy context
 */
export function handleRateLimitResponse(
	account: Account,
	rateLimitInfo: ReturnType<Provider["parseRateLimit"]>,
	ctx: ProxyContext,
): void {
	if (!rateLimitInfo.resetTime) return;

	log.warn(
		`Account ${account.name} rate-limited until ${new Date(
			rateLimitInfo.resetTime,
		).toISOString()}`,
	);

	const resetTime = rateLimitInfo.resetTime;
	ctx.asyncWriter.enqueue(() =>
		ctx.dbOps.markAccountRateLimited(account.id, resetTime),
	);

	const rateLimitError = new RateLimitError(
		account.id,
		rateLimitInfo.resetTime,
		rateLimitInfo.remaining,
	);
	logError(rateLimitError, log);
}

/**
 * Handles non-success response for an account (any status code other than 200)
 * @param account - The account that received non-success response
 * @param response - The non-success response
 * @param ctx - The proxy context
 */
export function handleNonSuccessResponse(
	account: Account,
	response: Response,
	_ctx: ProxyContext,
): void {
	log.warn(
		`Account ${account.name} received non-success response: ${response.status} ${response.statusText} - failing over to next account`,
	);

	// Log different types of errors for debugging purposes
	if (response.status >= 500) {
		log.info(`Server error (5xx) detected for account ${account.name}`);
	} else if (response.status >= 400) {
		log.info(`Client error (4xx) detected for account ${account.name}`);
	} else if (response.status >= 300) {
		log.info(`Redirect (3xx) detected for account ${account.name}`);
	}

	// Don't update account metadata for non-success responses
	// Let the next account handle the request
}

/**
 * Updates account metadata in the background
 * @param account - The account to update
 * @param response - The response to extract metadata from
 * @param ctx - The proxy context
 */
export function updateAccountMetadata(
	account: Account,
	response: Response,
	ctx: ProxyContext,
): void {
	// Update basic usage
	ctx.asyncWriter.enqueue(() => ctx.dbOps.updateAccountUsage(account.id));

	// Extract and update rate limit info for every response
	const rateLimitInfo = ctx.provider.parseRateLimit(response);
	// Only update rate limit metadata when we have actual rate limit headers
	if (rateLimitInfo.statusHeader) {
		const status = rateLimitInfo.statusHeader;
		ctx.asyncWriter.enqueue(() =>
			ctx.dbOps.updateAccountRateLimitMeta(
				account.id,
				status,
				rateLimitInfo.resetTime ?? null,
				rateLimitInfo.remaining,
			),
		);
	}

	// Extract tier info if supported
	if (ctx.provider.extractTierInfo) {
		const extractTierInfo = ctx.provider.extractTierInfo.bind(ctx.provider);
		(async () => {
			const tier = await extractTierInfo(response.clone() as Response);
			if (tier && tier !== account.account_tier) {
				log.info(
					`Updating account ${account.name} tier from ${account.account_tier} to ${tier}`,
				);
				ctx.asyncWriter.enqueue(() =>
					ctx.dbOps.updateAccountTier(account.id, tier),
				);
			}
		})();
	}
}

/**
 * Processes a proxy response and determines if failover should occur
 * @param response - The provider response
 * @param account - The account used
 * @param ctx - The proxy context
 * @returns Whether failover should occur (rate-limited or any non-success response)
 */
export function processProxyResponse(
	response: Response,
	account: Account,
	ctx: ProxyContext,
): boolean {
	const isStream = ctx.provider.isStreamingResponse?.(response) ?? false;
	const rateLimitInfo = ctx.provider.parseRateLimit(response);

	log.info(
		`Processing response for account ${account.name}: status=${response.status}, isStream=${isStream}, rateLimited=${rateLimitInfo.isRateLimited}`,
	);

	// Handle rate limit
	if (!isStream && rateLimitInfo.isRateLimited && rateLimitInfo.resetTime) {
		log.warn(`Account ${account.name} is rate limited - triggering failover`);
		handleRateLimitResponse(account, rateLimitInfo, ctx);
		// Also update metadata for rate-limited responses
		updateAccountMetadata(account, response, ctx);
		return true; // Signal rate limit failover
	}

	// Handle all non-success responses (any status code other than 200)
	if (!SUCCESS_STATUS_CODES.has(response.status)) {
		log.warn(
			`Account ${account.name} received non-success status ${response.status} - triggering failover`,
		);
		handleNonSuccessResponse(account, response, ctx);
		// Don't update metadata for non-success responses - let next account handle the request
		return true; // Signal failover for any non-success response
	}

	// Success case
	log.info(
		`Account ${account.name} returned successful response (200) - no failover needed`,
	);
	// Update account metadata in background
	updateAccountMetadata(account, response, ctx);
	return false;
}

/**
 * Handles errors that occur during proxy operations
 * @param error - The error that occurred
 * @param account - The account that failed (optional)
 * @param logger - Logger instance
 */
export function handleProxyError(
	error: unknown,
	account: Account | null,
	logger: Logger,
): void {
	logError(error, logger);
	if (account) {
		logger.error(`Failed to proxy request with account ${account.name}`);
	} else {
		logger.error("Failed to proxy request");
	}
}
