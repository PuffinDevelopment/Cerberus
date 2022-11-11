import { ApplicationCommandType } from "discord.js";

export const ClearContextCommand = {
	name: "Clear messages to",
	type: ApplicationCommandType.Message,
	default_member_permissions: "0",
} as const;
