import { on } from "node:events";
import { logger, addFields, truncateEmbed } from "@yuudachi/framework";
import type { Event } from "@yuudachi/framework/types";
import { ChannelType, Client, Events, messageLink, type Message, MessageType } from "discord.js";
import { injectable } from "tsyringe";
import { checkLogChannel } from "../../functions/settings/checkLogChannel.js";
import { getGuildSetting, SettingsKeys } from "../../functions/settings/getGuildSetting.js";
import { Color } from "../../util/constants.js";

@injectable()
export default class implements Event {
	public name = "Guild log message delete";

	public event = Events.MessageDelete as const;

	public constructor(public readonly client: Client<true>) {}

	public async execute(): Promise<void> {
		for await (const [message] of on(this.client, this.event) as AsyncIterableIterator<[Message]>) {
			if (message.author.bot) {
				continue;
			}

			if (!message.inGuild()) {
				continue;
			}

			if (!message.content.length && !message.embeds.length && !message.attachments.size && !message.stickers.size) {
				continue;
			}

			const channel = checkLogChannel(
				message.guild,
				await getGuildSetting(message.guild.id, SettingsKeys.GuildLogChannelId),
			);

			if (!channel) {
				continue;
			}

			logger.info(
				{
					event: { name: this.name, event: this.event },
					guildId: message.guild.id,
					memberId: message.author.id,
					channelId: message.channelId,
					channelType: ChannelType[message.channel.type],
				},
				`Message by ${message.author.id} deleted in channel ${message.channelId}`,
			);

			const infoParts = [
				// eslint-disable-next-line @typescript-eslint/no-base-to-string
				`• Channel: ${message.channel.toString()} - ${message.channel.name} (${message.channel.id})`,
			];

			let embed = addFields({
				author: {
					name: `${message.author.tag} (${message.author.id})`,
					icon_url: message.author.displayAvatarURL(),
				},
				color: Color.LogsMessageDelete,
				title: "Message deleted",
				description: `${message.content.length ? message.content : "No message content"}`,
				footer: { text: message.id },
				timestamp: new Date().toISOString(),
			});

			if (!message.content && message.embeds.length) {
				infoParts.push(`• Embeds: ${message.embeds.length}`);
			}

			if (message.attachments.size) {
				const attachmentParts = [];
				let counter = 1;
				for (const attachment of message.attachments.values()) {
					attachmentParts.push(`[${counter}](${attachment.proxyURL})`);
					counter++;
				}

				infoParts.push(`• Attachments: ${attachmentParts.join(" ")}`);
			}

			if (message.stickers.size) {
				infoParts.push(`• Stickers: ${message.stickers.map((sticker) => `\`${sticker.name}\``).join(", ")}`);
			}

			infoParts.push(`• [Jump to](${message.url})`);

			if (message.type === MessageType.Reply && message.reference && message.mentions.repliedUser) {
				const { channelId, messageId, guildId } = message.reference;
				const replyURL = messageLink(channelId, messageId!, guildId!);

				infoParts.push(
					message.mentions.users.has(message.mentions.repliedUser.id)
						? `• @Replying to [${messageId}](${replyURL}) by \`${message.mentions.repliedUser.tag}\` (${message.mentions.repliedUser.id})`
						: `• Replying to [${messageId}](${replyURL}) by \`${message.mentions.repliedUser.tag}\` (${message.mentions.repliedUser.id})`,
				);
			}

			embed = addFields(embed, {
				name: "\u200B",
				value: infoParts.join("\n"),
			});

			await channel.send({
				embeds: [truncateEmbed(embed)],
			});
		}
	}
}
