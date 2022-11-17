import { ApplicationCommandOptionType, ApplicationCommandType } from "discord.js";

export const GithubCommand = {
	type: ApplicationCommandType.ChatInput,
	name: "github",
	description: "Query an issue, pullrequest or commit-like from the provided repository",
	options: [
		{
			name: "query",
			description: "Issue, PR number, commit-like expression or direct link to a GitHub Issue or PR",
			type: ApplicationCommandOptionType.String,
			required: true,
		},
		{
			name: "repository",
			description: "Project repository (default: Cerberus)",
			type: ApplicationCommandOptionType.String,
		},
		{
			name: "owner",
			description: "Repository owner (default: PuffinDevelopment)",
			type: ApplicationCommandOptionType.String,
		},
	],
} as const;
