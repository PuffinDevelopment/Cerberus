import { ApplicationCommandOptionType } from "discord.js";
import { CASE_REASON_MAX_LENGTH, CASE_REASON_MIN_LENGTH } from "../../util/constants.js";

export const ReasonCommand = {
	name: "reason",
	description: "Change the reason of actions",
	options: [
		{
			name: "case",
			description: "The first case to change",
			type: ApplicationCommandOptionType.Integer,
			required: true,
		},
		{
			name: "reason",
			description: "The reason",
			type: ApplicationCommandOptionType.String,
			required: true,
			autocomplete: true,
			min_length: CASE_REASON_MIN_LENGTH,
			max_length: CASE_REASON_MAX_LENGTH,
		},
		{
			name: "last_case",
			description: "The last case to change",
			type: ApplicationCommandOptionType.Integer,
		},
	],
	default_member_permissions: "0",
} as const;
