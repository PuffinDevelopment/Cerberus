import { on } from "node:events";
import { logger, addFields, truncateEmbed } from "@yuudachi/framework";
import type { Event } from "@yuudachi/framework/types";
import { diffLines, diffWords } from "diff";
import { Client, Events, type Message, escapeMarkdown } from "discord.js";
import { injectable } from "tsyringe";
import { Color } from "../../Constants.js";
import { checkLogChannel } from "../../functions/settings/checkLogChannel.js";
import { getGuildSetting, SettingsKeys } from "../../functions/settings/getGuildSetting.js";

@injectable()
export default class implements Event {
	public name = "Guild log message update";

	public event = Events.MessageUpdate as const;

	public constructor(public readonly client: Client<true>) {}

	public async execute(): Promise<void> {
		for await (const [oldMessage, newMessage] of on(this.client, this.event) as AsyncIterableIterator<
			[Message, Message]
		>) {
			if (newMessage.author.bot) {
				continue;
			}

			if (!newMessage.inGuild()) {
				continue;
			}

			if (escapeMarkdown(oldMessage.content) === escapeMarkdown(newMessage.content)) {
				continue;
			}

			const channel = checkLogChannel(
				newMessage.guild,
				await getGuildSetting(newMessage.guild.id, SettingsKeys.GuildLogChannelId),
			);

			if (!channel) {
				continue;
			}

			logger.info(
				{
					event: { name: this.name, event: this.event },
					guildId: newMessage.guild.id,
					memberId: newMessage.author.id,
				},
				`Member ${newMessage.author.id} updated a message`,
			);

			let description = "";

			// eslint-disable-next-line prefer-named-capture-group
			if (/```(.*?)```/s.test(oldMessage.content) && /```(.*?)```/s.test(newMessage.content)) {
				// eslint-disable-next-line unicorn/no-unsafe-regex, prefer-named-capture-group
				const strippedOldMessage = /```(?:(\S+)\n)?\s*([^]+?)\s*```/.exec(oldMessage.content);

				if (!strippedOldMessage?.[2]) {
					continue;
				}

				// eslint-disable-next-line unicorn/no-unsafe-regex, prefer-named-capture-group
				const strippedNewMessage = /```(?:(\S+)\n)?\s*([^]+?)\s*```/.exec(newMessage.content);

				if (!strippedNewMessage?.[2]) {
					continue;
				}

				if (strippedOldMessage[2] === strippedNewMessage[2]) {
					continue;
				}

				const diffMessage = diffLines(strippedOldMessage[2], strippedNewMessage[2], { newlineIsToken: true });

				for (const part of diffMessage) {
					if (part.value === "\n") {
						continue;
					}

					const deleted = part.added ? "+ " : part.removed ? "- " : "";
					description += `${deleted}${part.value.replaceAll("\n", "")}\n`;
				}

				const prepend = "```diff\n";
				const append = "\n```";
				description = `${prepend}${description.slice(0, 3_900)}${append}`;
			} else {
				const diffMessage = diffWords(escapeMarkdown(oldMessage.content), escapeMarkdown(newMessage.content));

				for (const part of diffMessage) {
					const markdown = part.added ? "**" : part.removed ? "~~" : "";
					description += `${markdown}${part.value}${markdown}`;
				}

				description = `${description.slice(0, 3_900)}` || "\u200B";
			}

			// eslint-disable-next-line @typescript-eslint/no-base-to-string
			const info = `• Channel: ${newMessage.channel.toString()} - ${
				newMessage.inGuild() ? newMessage.channel.name : ""
			}(${newMessage.channel.id})\n• [Jump to](${newMessage.url})`;
			const embed = addFields(
				{
					author: {
						name: `${newMessage.author.tag} (${newMessage.author.id})`,
						icon_url: newMessage.author.displayAvatarURL(),
					},
					color: Color.LogsMessageUpdate,
					title: "Message updated",
					description,
					footer: { text: newMessage.id },
					timestamp: new Date().toISOString(),
				},
				{
					name: "\u200B",
					value: info,
				},
			);

			await channel.send({
				embeds: [truncateEmbed(embed)],
			});
		}
	}
}
