import { truncateEmbed } from "@yuudachi/framework";
import type { Message } from "discord.js";
import { Color } from "../../util/constants.js";

export function formatMessageToEmbed(message: Message<true>) {
	let embed = truncateEmbed({
		author: {
			name: `${message.author.tag} (${message.author.id})`,
			url: message.url,
			icon_url: message.author.displayAvatarURL(),
		},
		description: message.content.length ? message.content : "No message content",
		timestamp: message.createdAt.toISOString(),
		footer: {
			text: `#${message.channel.name}`,
		},
		color: Color.DiscordEmbedBackground,
	});

	const attachment = message.attachments.first();
	const attachmentIsImage = ["image/jpeg", "image/png", "image/gif"].includes(attachment?.contentType ?? "");
	const attachmentIsImageNaive = [".jpg", ".png", ".gif"].some((ext) => attachment?.name?.endsWith(ext));

	if (attachment && (attachmentIsImage || attachmentIsImageNaive)) {
		embed = {
			...embed,
			image: {
				url: attachment.url,
			},
		};
	}

	return embed;
}
