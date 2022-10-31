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

export const DATE_FORMAT_LOGFILE = "YYYY-MM-DD_HH-mm-ss";
export const DATE_FORMAT_WITH_SECONDS = "YYYY/MM/DD HH:mm:ss";

export const DISCORD_USER_FLAG_SPAMMER = 1 << 20;

export const TAB = "\u200B \u200B \u200B" as const;

export const FAIL_PREFIX = "`❌ Error`";
export const EMOJI_NEWBIE = "<:newbie:962332319623049226>" as const;
