export const ACCESS_TOKEN_MAX_AGE = 1800; // 30 minutes in seconds
export function getAccessTokenExp() {
    return Math.floor(Date.now() / 1000) + ACCESS_TOKEN_MAX_AGE;
}

export const REFRESH_TOKEN_MAX_AGE = 7_776_000; // 90 days in seconds
export function getRefreshTokenExp() {
    return Math.floor(Date.now() / 1000) + REFRESH_TOKEN_MAX_AGE;
}

export const INTERNAL_ERROR_MESSAGE =
    "We are currently experiencing an internal issue that’s affecting this request. Our team is actively investigating and working to resolve it as quickly as possible.";

export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
