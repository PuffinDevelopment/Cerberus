import { Buffer } from "node:buffer";
import { ms } from "@naval-base/ms";
import {
	Command,
	logger,
	createButton,
	addFields,
	truncateEmbed,
	createMessageActionRow,
	validateSnowflake,
} from "@yuudachi/framework";
import type { ArgsParam, InteractionParam, CommandMethod } from "@yuudachi/framework/types";
import dayjs from "dayjs";
import {
	type APIButtonComponent,
	type APIEmbed,
	ButtonStyle,
	ComponentType,
	type Webhook,
	type Message,
	type TextChannel,
} from "discord.js";
import { nanoid } from "nanoid";
import { inject, injectable } from "tsyringe";
import { formatMessageToEmbed } from "../../functions/logging/formatMessageToEmbed.js";
import { formatMessagesToAttachment } from "../../functions/logging/formatMessagesToAttachment.js";
import { fetchMessages, orderMessages, pruneMessages } from "../../functions/pruning/pruneMessages.js";
import { checkLogChannel } from "../../functions/settings/checkLogChannel.js";
import { getGuildSetting, SettingsKeys } from "../../functions/settings/getGuildSetting.js";
import type { ClearCommand, ClearContextCommand } from "../../interactions/index.js";
import { kWebhooks } from "../../tokens.js";
import { Color, DATE_FORMAT_LOGFILE } from "../../util/constants.js";
import { createMessageLinkButton } from "../../util/createMessageLinkButton.js";
import { parseMessageLink, resolveMessage } from "../../util/resolveMessage.js";

async function resolveSnowflakeOrLink(interaction: InteractionParam, arg: string, argumentName: string) {
	if (validateSnowflake(arg)) {
		return resolveMessage(interaction.guildId, interaction.channelId, arg);
	}

	const parsedLink = parseMessageLink(arg);
	if (!parsedLink) {
		throw new Error(`Provided value ${arg} for argument ${argumentName} is not a valid message link.`);
	}

	const { guildId, channelId, messageId } = parsedLink;
	return resolveMessage(guildId!, channelId!, messageId!);
}

@injectable()
export default class extends Command<typeof ClearCommand | typeof ClearContextCommand> {
	public constructor(@inject(kWebhooks) public readonly webhooks: Map<string, Webhook>) {
		super(["clear", "Clear messages to"]);
	}

	private async handle(
		interaction: InteractionParam | InteractionParam<CommandMethod.MessageContext>,
		firstMessage: Message,
		lastMessage?: Message | undefined,
	): Promise<void> {
		const reply = await interaction.deferReply({ ephemeral: true, fetchReply: true });

		if (lastMessage && firstMessage.channelId !== lastMessage.channelId) {
			throw new Error("The provided messages have to be from the same channel.");
		}

		const { oldest } = orderMessages(firstMessage, lastMessage);
		const messages = await fetchMessages(firstMessage, lastMessage);

		if (messages.size < 1) {
			throw new Error("Could not find messages in the provided range that are younger than 12 hours.");
		}

		const uniqueAuthors = new Set(messages.map((message) => message.author.id));
		const latest = messages.first()!;
		const earliest = messages.last()!;
		const delta = latest.createdTimestamp - earliest.createdTimestamp;

		const clearKey = nanoid();
		const cancelKey = nanoid();

		const clearButton = createButton({
			label: `Clear ${messages.size} message(s)`,
			customId: clearKey,
			style: ButtonStyle.Danger,
		});
		const cancelButton = createButton({
			label: "Cancel",
			customId: cancelKey,
			style: ButtonStyle.Secondary,
		});

		const confirmParts = [
			`You are about to clear ${messages.size} message(s) by ${uniqueAuthors.size} authors sent in ${ms(
				delta,
				true,
			)}. Are you sure?`,
		];

		const embeds: APIEmbed[] = [];
		const buttons: APIButtonComponent[] = [cancelButton, clearButton];

		if (!messages.has(oldest.id)) {
			embeds.push(formatMessageToEmbed(earliest as Message<true>));
			buttons.push(createMessageLinkButton(earliest as Message<true>));
			confirmParts.push(
				`Note: You can only clear messages that are up to 12 hours old. The oldest message that will be cleared is shown below.`,
				"",
			);
		}

		await interaction.editReply({
			content: confirmParts.join("\n"),
			components: [createMessageActionRow(buttons)],
			embeds,
		});

		const collectedInteraction = await reply
			.awaitMessageComponent({
				filter: (collected) => collected.user.id === interaction.user.id,
				componentType: ComponentType.Button,
				time: 15_000,
			})
			.catch(async () => {
				try {
					await interaction.editReply({
						content: "Action timer ran out",
						components: [],
						embeds: [],
					});
				} catch (error_) {
					const error = error_ as Error;
					logger.error(error, error.message);
				}

				return undefined;
			});

		if (collectedInteraction?.customId === cancelKey) {
			await collectedInteraction.update({
				content: "Cancelled clearing messages",
				components: [],
				embeds: [],
			});
		} else if (collectedInteraction?.customId === clearKey) {
			logger.info(`Pruning messages`, {
				amount: messages.size,
				timespan: ms(delta, true),
				unique_authors: uniqueAuthors.size,
			});

			await collectedInteraction.deferUpdate();
			const prunedMessages = await pruneMessages(messages);

			const prunedUniqueAuthors = new Set(messages.map((message) => message.author.id));
			const prunedLatest = messages.first()!;
			const prunedEarliest = messages.last()!;
			const prunedDelta = prunedLatest.createdTimestamp - prunedEarliest.createdTimestamp;

			await collectedInteraction.editReply({
				content: `Successfully cleared ${prunedMessages.size} messages by ${
					prunedUniqueAuthors.size
				} authors sent in ${ms(prunedDelta, true)}`,
				components: [],
				embeds: [],
			});

			try {
				const channel = checkLogChannel(
					interaction.guild,
					await getGuildSetting(interaction.guild.id, SettingsKeys.GuildLogChannelId!),
				) as unknown as TextChannel;

				const descriptionParts = [
					`• Messages: ${prunedMessages.size}`,
					`• Authors: ${prunedUniqueAuthors.size}`,
					`• Timespan: ${prunedDelta}`,
				];

				const embed = addFields({
					author: {
						name: `Moderator: ${interaction.user.tag} (${interaction.user.id})`,
						icon_url: interaction.member.displayAvatarURL(),
					},
					description: descriptionParts.join("\n"),
					title: "Messages cleared",
					timestamp: new Date().toISOString(),
					color: Color.DiscordWarning,
				});

				const logDate = dayjs().format(DATE_FORMAT_LOGFILE);
				await channel.send({
					embeds: [truncateEmbed(embed)],
					files: [
						{
							name: `${logDate}-clear-logs.txt`,
							attachment: Buffer.from(formatMessagesToAttachment(prunedMessages), "utf8"),
						},
					],
				});
			} catch (error_) {
				const error = error_ as Error;
				logger.error(error.message, error);
			}
		}
	}

	public override async chatInput(interaction: InteractionParam, args: ArgsParam<typeof ClearCommand>): Promise<void> {
		const lastMessage = await resolveSnowflakeOrLink(interaction, args.last_message, "last_message");
		const firstMessage = args.first_message
			? await resolveSnowflakeOrLink(interaction, args.first_message, "first_message")
			: undefined;

		await this.handle(interaction, lastMessage, firstMessage);
	}

	public override async messageContext(
		interaction: InteractionParam<CommandMethod.MessageContext>,
		args: ArgsParam<typeof ClearContextCommand>,
	): Promise<void> {
		await this.handle(interaction, args.message);
	}
}
