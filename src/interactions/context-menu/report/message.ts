import { ApplicationCommandType } from "discord.js";

export const ReportMessageContextCommand = {
	name: "Report message",
	type: ApplicationCommandType.Message,
} as const;
