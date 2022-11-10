import type { Guild, Snowflake, TextChannel } from "discord.js";

export function checkLogChannel(guild: Guild, logChannelId: Snowflake) {
	return guild.client.channels.resolve(logChannelId) as TextChannel | null;
}
