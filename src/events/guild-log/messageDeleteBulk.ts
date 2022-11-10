import { Buffer } from "node:buffer";
import { on } from "node:events";
import { addFields, truncateEmbed } from "@yuudachi/framework";
import type { Event } from "@yuudachi/framework/types";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import utc from "dayjs/plugin/utc.js";
import { Client, Events, type Snowflake } from "discord.js";
import { injectable } from "tsyringe";
import { formatMessagesToAttachment } from "../../functions/logging/formatMessagesToAttachment.js";
import { checkLogChannel } from "../../functions/settings/checkLogChannel.js";
import { getGuildSetting, SettingsKeys } from "../../functions/settings/getGuildSetting.js";
import { Color } from "../../util/constants.js";

dayjs.extend(relativeTime);
dayjs.extend(utc);

@injectable()
export default class implements Event {
	public name = "Guild log message bulk delete";

	public event = Events.MessageBulkDelete as const;

	public constructor(public readonly client: Client<true>) {}

	public async execute(): Promise<void> {
		for await (const [messages] of on(this.client, this.event)) {
			const userMessages = messages.filter((message) => !message.author?.bot);
			const firstMessage = userMessages.first();

			if (!firstMessage?.inGuild()) {
				continue;
			}

			const channel = checkLogChannel(
				firstMessage.guild,
				await getGuildSetting(firstMessage.guild.id, SettingsKeys.GuildLogChannelId),
			);

			if (!channel) {
				continue;
			}

			const uniqueAuthors = new Set<Snowflake>();
			for (const message of userMessages.values()) {
				if (message.author) {
					uniqueAuthors.add(message.author.id);
				}
			}

			const embed = addFields({
				author: {
					name:
						uniqueAuthors.size === 1 ? `${firstMessage.author.tag} (${firstMessage.author.id})` : "Multiple authors",
					icon_url:
						uniqueAuthors.size === 1 ? firstMessage.author.displayAvatarURL() : this.client.user.displayAvatarURL(),
				},
				color: Color.LogsMessageDelete,
				title: "Message deleted bulk",
				// eslint-disable-next-line @typescript-eslint/no-base-to-string
				description: `• Channel: ${firstMessage.channel.toString()} - ${
					firstMessage.inGuild() ? firstMessage.channel.name : ""
				} (${firstMessage.channel.id})\n• Logs: See attachment file for full logs (possibly above this embed)`,
				timestamp: new Date().toISOString(),
			});

			await channel.send({
				embeds: [truncateEmbed(embed)],
				files: [{ name: "logs.txt", attachment: Buffer.from(formatMessagesToAttachment(userMessages), "utf8") }],
			});
		}
	}
}
