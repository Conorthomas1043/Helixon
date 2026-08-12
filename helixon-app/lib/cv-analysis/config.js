export const MODEL = "claude-sonnet-5";

export const RUBRIC_VERSION = "3.0.0";

export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export const CURRENT_YEAR = new Date().getFullYear();

export const CACHE_SIZE = 200;

export const MAX_RETRIES = 3;

export const DEFAULT_TIMEOUT = 60000;

export const SCORE_WEIGHTS = {

    required:40,

    experience:25,

    preferred:15,

    industry:10,

    career:10

};

export const IMPORTANCE_MULTIPLIER = {

    Critical:3,

    High:2,

    Medium:1,

    Low:0.5

};

export const KNOCKOUT_CAP = 40;