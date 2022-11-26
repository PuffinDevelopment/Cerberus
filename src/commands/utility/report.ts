import { Command, logger, createModal, createModalActionRow, createTextComponent } from "@yuudachi/framework";
import type { ArgsParam, InteractionParam, CommandMethod } from "@yuudachi/framework/types";
import { TextInputStyle, ComponentType } from "discord.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { Redis } from "ioredis";
import { nanoid } from "nanoid";
import { inject, injectable } from "tsyringe";
import { REPORT_REASON_MAX_LENGTH, REPORT_REASON_MIN_LENGTH } from "../../Constants.js";
import { checkLogChannel } from "../../functions/settings/checkLogChannel.js";
import { getGuildSetting, SettingsKeys } from "../../functions/settings/getGuildSetting.js";
import type { ReportCommand, ReportMessageContextCommand, ReportUserContextCommand } from "../../interactions/index.js";
import { kRedis } from "../../tokens.js";
import { parseMessageLink, resolveMessage } from "../../util/resolveMessage.js";
import { message } from "./sub/report/message.js";
import { user } from "./sub/report/user.js";

@injectable()
export default class extends Command<
	typeof ReportCommand | typeof ReportMessageContextCommand | typeof ReportUserContextCommand
> {
	public constructor(@inject(kRedis) public readonly redis: Redis) {
		super(["report", "Report message", "Report user"]);
	}

	public override async chatInput(interaction: InteractionParam, args: ArgsParam<typeof ReportCommand>): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const reportChannelId = await getGuildSetting(interaction.guildId, SettingsKeys.ReportChannelId);
		const reportChannel = checkLogChannel(interaction.guild, reportChannelId);
		if (!reportChannel) {
			throw new Error("No report channel has been initialized yet.");
		}

		if (Object.keys(args)[0] === "message") {
			const parsedLink = parseMessageLink(args.message.message_link);

			if (!parsedLink) {
				throw new Error(
					`Provided value \`${args.message.message_link}\` for argument \`message_link\` is not a valid message link.`,
				);
			}

			const { guildId, channelId, messageId } = parsedLink;
			const messageArg = await resolveMessage(guildId!, channelId!, messageId!);

			if (messageArg.author.bot) {
				throw new Error("You cannot report bots.");
			}

			if (messageArg.author.id === interaction.user.id) {
				throw new Error("You cannot report yourself.");
			}

			const key = `guild:${interaction.guildId}:report:channel:${interaction.channelId}:message:${messageArg.id}`;

			if (await this.redis.exists(key)) {
				throw new Error(
					"This message has already been recently reported, thanks for making our community a better place!",
				);
			}

			await message(interaction, {
				reason: args.message.reason,
				message: messageArg,
			});
		} else {
			if (args.user.user.user.bot) {
				throw new Error("You cannot report bots.");
			}

			if (args.user.user.user.id === interaction.user.id) {
				throw new Error("You cannot report yourself.");
			}

			const key = `guild:${interaction.guildId}:report:user:${args.user.user.user.id}`;

			if (await this.redis.exists(key)) {
				throw new Error(
					"This user has already been recently reported, thanks for making our community a better place!",
				);
			}

			if (!args.user.user.member) {
				throw new Error("The given member is not in this guild.");
			}

			await user(interaction, args.user);
		}
	}

	public override async userContext(
		interaction: InteractionParam<CommandMethod.UserContext>,
		args: ArgsParam<typeof ReportUserContextCommand>,
	): Promise<void> {
		const reportChannelId = await getGuildSetting(interaction.guildId, SettingsKeys.ReportChannelId);
		const reportChannel = checkLogChannel(interaction.guild, reportChannelId);
		if (!reportChannel) {
			throw new Error("No report channel has been initialized yet.");
		}

		const modalKey = nanoid();

		if (args.user.user.bot) {
			throw new Error("You cannot report bots.");
		}

		if (args.user.user.id === interaction.user.id) {
			throw new Error("You cannot report yourself.");
		}

		const key = `guild:${interaction.guildId}:report:user:${args.user.user.id}`;

		if (await this.redis.exists(key)) {
			throw new Error("This user has already been recently reported, thanks for making our community a better place!");
		}

		if (!args.user.member) {
			throw new Error("The given member is not in this guild.");
		}

		const modal = createModal({
			customId: modalKey,
			title: "User report",
			components: [
				createModalActionRow([
					createTextComponent({
						customId: "reason",
						label: "The reason for the report",
						minLength: REPORT_REASON_MIN_LENGTH,
						maxLength: REPORT_REASON_MAX_LENGTH,
						placeholder: "Please enter a detailed reason for the report",
						required: true,
						style: TextInputStyle.Paragraph,
					}),
				]),
			],
		});

		await interaction.showModal(modal);

		const modalInteraction = await interaction
			.awaitModalSubmit({
				time: 120_000,
				filter: (component) => component.customId === modalKey,
			})
			.catch(async () => {
				try {
					await interaction.followUp({
						content: "The report has timed out, please try again.",
						ephemeral: true,
						components: [],
					});
				} catch (error_) {
					const error = error_ as Error;
					logger.error(error, error.message);
				}

				return undefined;
			});

		if (!modalInteraction) {
			return;
		}

		await modalInteraction.deferReply({ ephemeral: true });

		const reason = modalInteraction.components
			.flatMap((row) => row.components)
			.map((component) => (component.type === ComponentType.TextInput ? component.value || "" : ""));

		await user(modalInteraction, {
			user: args.user,
			reason: reason.join(" "),
		});
	}

	public override async messageContext(
		interaction: InteractionParam<CommandMethod.MessageContext>,
		args: ArgsParam<typeof ReportMessageContextCommand>,
	): Promise<void> {
		const reportChannelId = await getGuildSetting(interaction.guildId, SettingsKeys.ReportChannelId);
		const reportChannel = checkLogChannel(interaction.guild, reportChannelId);
		if (!reportChannel) {
			throw new Error("No report channel has been initialized yet.");
		}

		const modalKey = nanoid();

		if (args.message.author.bot) {
			throw new Error("You cannot report bots.");
		}

		if (args.message.author.id === interaction.user.id) {
			throw new Error("You cannot report yourself.");
		}

		const key = `guild:${interaction.guildId}:report:channel:${interaction.channelId}:message:${args.message.id}`;

		if (await this.redis.exists(key)) {
			throw new Error(
				"This message has already been recently reported, thanks for making our community a better place!",
			);
		}

		const modal = createModal({
			customId: modalKey,
			title: "Message report",
			components: [
				createModalActionRow([
					createTextComponent({
						customId: "reason",
						label: "The reason for the report",
						minLength: REPORT_REASON_MIN_LENGTH,
						maxLength: REPORT_REASON_MAX_LENGTH,
						placeholder: "Please enter a detailed reason for the report",
						required: true,
						style: TextInputStyle.Paragraph,
					}),
				]),
			],
		});

		await interaction.showModal(modal);

		const modalInteraction = await interaction
			.awaitModalSubmit({
				time: 120_000,
				filter: (component) => component.customId === modalKey,
			})
			.catch(async () => {
				try {
					await interaction.followUp({
						content: "The report has timed out, please try again.",
						ephemeral: true,
						components: [],
					});
				} catch (error_) {
					const error = error_ as Error;
					logger.error(error, error.message);
				}

				return undefined;
			});

		if (!modalInteraction) {
			return;
		}

		await modalInteraction.deferReply({ ephemeral: true });

		const reason = modalInteraction.components
			.flatMap((row) => row.components)
			.map((component) => (component.type === ComponentType.TextInput ? component.value || "" : ""));

		await message(modalInteraction, {
			message: args.message,
			reason: reason.join(" "),
		});
	}
}
