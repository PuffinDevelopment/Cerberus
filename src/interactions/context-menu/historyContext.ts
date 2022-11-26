import { ApplicationCommandType } from "discord.js";

export const HistoryUserContextCommand = {
	name: "History",
	type: ApplicationCommandType.User,
	default_member_permissions: "0",
} as const;
