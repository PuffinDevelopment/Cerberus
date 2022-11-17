/* eslint-disable n/no-extraneous-import */
export const enum Color {
	DiscordEmbedBackground = 0x2f3136,
	DiscordSuccess = 0x57f287,
	DiscordDanger = 0xed4245,
	DiscordWarning = 0xfee75c,
	DiscordPrimary = 0x5865f2,
	DiscordGem = 0xeb459e,
	LogsMessageDelete = 0xb75cff,
	LogsMessageUpdate = 0x5c6cff,
}

export enum Colors {
	White = 0xffffff,
	Red = 0xff5c5c,
	Orange = 0xf79454,
	Yellow = 0xffdb5c,
	Green = 0x5cff9d,
	Blue = 0x5c6cff,
	Pink = 0xb75cff,
	Dark = 0x2f3136,
	DiscordSuccess = 0x3ba55d,
	DiscordDanger = 0xed4245,
}

export const enum ThreatLevelColor {
	Level0 = 0x7ef31f,
	Level1 = 0x80f31f,
	Level2 = 0xa5de0b,
	Level3 = 0xc7c101,
	Level4 = 0xe39e03,
	Level5 = 0xf6780f,
	Level6 = 0xfe5326,
	Level7 = 0xfb3244,
}

export const DEFAULT_REPO_OWNER = "PuffinDevelopment";
export const DEFAULT_REPO = "Cerberus";
export const GITHUB_BASE_URL = "https://api.github.com/graphql";
export const GITHUB_EMOJI_PR_OPEN = "<:pr_open:852715356622553088>";
export const GITHUB_EMOJI_PR_CLOSED = "<:pr_closed:852715338268409887>";
export const GITHUB_EMOJI_PR_MERGED = "<:pr_merge:852715380282753044>";
export const GITHUB_EMOJI_PR_DRAFT = "<:pr_draft:852715368888008714>";
export const GITHUB_EMOJI_ISSUE_OPEN = "<:issue_open:852714230280486942>";
export const GITHUB_EMOJI_ISSUE_CLOSED = "<:issue_closed:852714146335555594>";
export const GITHUB_EMOJI_COMMIT = "<:commit:852713964889702410>";

export const CASE_REASON_MAX_LENGTH = 500;
export const CASE_REASON_MIN_LENGTH = 3;
export const HISTORY_DESCRIPTION_MAX_LENGTH = 80;

export const MENTION_THRESHOLD = 10;
export const MENTION_EXPIRE_SECONDS = 60;
export const SCAM_THRESHOLD = 3;
export const SCAM_EXPIRE_SECONDS = 5 * 60;
export const SPAM_THRESHOLD = 4;
export const SPAM_EXPIRE_SECONDS = 30;

export const AUDIT_LOG_WAIT_SECONDS = 2.5;

export const DATE_FORMAT_LOGFILE = "YYYY-MM-DD_HH-mm-ss";
export const DATE_FORMAT_WITH_SECONDS = "YYYY/MM/DD HH:mm:ss";

export const DISCORD_USER_FLAG_SPAMMER = 1 << 20;

export const TAB = "\u200B \u200B \u200B" as const;

export const EMOJI_NEWBIE = "<:newbie:962332319623049226>" as const;
