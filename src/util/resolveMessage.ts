import { container } from "@yuudachi/framework";
import { type Snowflake, Client } from "discord.js";

export function parseMessageLink(link: string) {
	const linkRegex =
		/(?:https?:\/\/(?:ptb\.|canary\.)?discord\.com\/channels\/(?<guildId>\d{17,20})\/(?<channelId>\d{17,20})\/(?<messageId>\d{17,20}))/gi;
	const groups = linkRegex.exec(link)?.groups;

	if (!groups) {
		return null;
	}

	const { guildId, channelId, messageId } = groups;
	return { guildId, channelId, messageId };
}

export async function resolveMessage(guildId: Snowflake, channelId: Snowflake, messageId: Snowflake) {
	const client = container.resolve<Client<true>>(Client);

	const guild = client.guilds.resolve(guildId);

	if (!guild) {
		throw new Error(`Could not find guild ${guildId}`);
	}

	const channel = guild.channels.resolve(channelId);

	if (!channel?.isTextBased()) {
		throw new Error(`Could not find channel ${channelId} in guild ${guild.name}`);
	}

	try {
		return await channel.messages.fetch(messageId);
	} catch {
		// eslint-disable-next-line @typescript-eslint/no-base-to-string
		throw new Error(`Could not find message ${messageId} in channel ${channel.toString()}`);
	}
}
