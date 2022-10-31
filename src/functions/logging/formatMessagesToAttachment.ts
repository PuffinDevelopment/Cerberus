import dayjs from "dayjs";
import {
	type Collection,
	type Message,
	messageLink,
	MessageType,
	type PartialMessage,
	type Snowflake,
} from "discord.js";
import kleur from "kleur";
import { DATE_FORMAT_WITH_SECONDS } from "../../util/constants.js";

kleur.enabled = true;

export function formatMessagesToAttachment(
	messages: Collection<Snowflake, Message | PartialMessage>,
	primaryHighlightMessageIds: Snowflake[] = [],
	secondaryHighlighMessageIds: Snowflake[] = [],
) {
	return messages
		.map((message) => {
			const isPrimaryHighlight = primaryHighlightMessageIds.includes(message.id);
			const isSecondaryHighlight = secondaryHighlighMessageIds.includes(message.id);
			const outParts = [
				`[${dayjs(message.createdTimestamp).utc().format(DATE_FORMAT_WITH_SECONDS)} (UTC)] ${
					message.author?.tag ?? "Unknown author"
				} (${message.author?.id ?? "Unknown author"}): ${
					message.cleanContent ? message.cleanContent.replace(/\n/g, "\n") : ""
				}`,
			];

			if (message.attachments.size) {
				outParts.push(message.attachments.map((attachment) => `↳ Attachment: ${attachment.proxyURL}`).join("\n"));
			}

			if (message.stickers.size) {
				outParts.push(message.stickers.map((sticker) => `↳ Sticker: ${sticker.name}`).join("\n"));
			}

			if (message.type === MessageType.Reply && message.reference && message.mentions.repliedUser) {
				const { channelId, messageId, guildId } = message.reference;
				const replyURL = messageLink(channelId, messageId!, guildId!);

				outParts.push(
					message.mentions.users.has(message.mentions.repliedUser.id)
						? `↳ @Replying to ${messageId} (${replyURL}) by ${message.mentions.repliedUser.tag} (${message.mentions.repliedUser.id})`
						: `↳ Replying to ${messageId} (${replyURL}) by ${message.mentions.repliedUser.tag} (${message.mentions.repliedUser.id})`,
				);
			}

			const outSection = outParts.join("\n");
			return isPrimaryHighlight
				? kleur.yellow(outSection)
				: isSecondaryHighlight
				? kleur.white(outSection)
				: outSection;
		})
		.join("\n");
}
