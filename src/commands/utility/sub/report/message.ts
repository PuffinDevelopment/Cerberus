import { getModelForClass } from "@typegoose/typegoose";
import { container, createButton, ellipsis, createMessageActionRow, logger } from "@yuudachi/framework";
import type { ArgsParam, InteractionParam } from "@yuudachi/framework/types";
import { ButtonStyle, ComponentType, hyperlink, type Message, type ModalSubmitInteraction } from "discord.js";
import type { Redis } from "ioredis";
import { nanoid } from "nanoid";
import {
	REPORT_DUPLICATE_EXPIRE_SECONDS,
	REPORT_DUPLICATE_PRE_EXPIRE_SECONDS,
	REPORT_REASON_MAX_LENGTH,
} from "../../../../Constants.js";
import { formatMessageToEmbed } from "../../../../functions/logging/formatMessageToEmbed.js";
import { upsertReportLog } from "../../../../functions/logging/upsertReportLog.js";
import { type Report, createReport, ReportStatus, ReportType } from "../../../../functions/reports/createReport.js";
import { getPendingReportByTarget } from "../../../../functions/reports/getReport.js";
import type { ReportCommand } from "../../../../interactions/index.js";
import { reports } from "../../../../models/reports.js";
import { kRedis } from "../../../../tokens.js";
import { createMessageLinkButton } from "../../../../util/createMessageLinkButton.js";

type MessageReportArgs = Omit<ArgsParam<typeof ReportCommand>["message"], "message_link"> & {
	message: Message;
};

export async function message(
	interaction: InteractionParam | ModalSubmitInteraction<"cached">,
	args: MessageReportArgs,
	pendingReport?: Report | null,
) {
	const redis = container.resolve<Redis>(kRedis);
	const key = `guild:${interaction.guildId}:report:channel:${interaction.channelId!}:message:${args.message.id}`;
	const trimmedReason = args.reason.trim();

	const reportKey = nanoid();
	const cancelKey = nanoid();

	const reportButtonText = pendingReport ? "Forward Message" : "Create Report";
	const reportButton = createButton({
		customId: reportKey,
		label: reportButtonText,
		style: pendingReport ? ButtonStyle.Primary : ButtonStyle.Danger,
	});
	const cancelButton = createButton({
		customId: cancelKey,
		label: "Cancel",
		style: ButtonStyle.Secondary,
	});
	const trustAndSafetyButton = createButton({
		label: "Report to Discord",
		url: "https://support.discord.com/hc/en-us/requests/new",
		style: ButtonStyle.Link,
	});

	const contentParts = [
		`Are you sure you want to report ${hyperlink(
			"this message",
			args.message.url,
		)} to the server moderators?\n**Reason:** ${ellipsis(trimmedReason, REPORT_REASON_MAX_LENGTH)}`,
		"",
		`**Attention:** We are not Discord and we **cannot** moderate ${hyperlink(
			"Trust & Safety",
			"https://support.discord.com/hc/en-us/requests/new",
		)} issues.\n**Creating false reports may lead to moderation actions.**`,
	];

	const reply = await interaction.editReply({
		content: contentParts.join("\n"),
		embeds: [formatMessageToEmbed(args.message as Message<true>)],
		components: [
			createMessageActionRow([
				cancelButton,
				reportButton,
				trustAndSafetyButton,
				createMessageLinkButton(args.message as Message<true>),
			]),
		],
	});

	const collectedInteraction = await reply
		.awaitMessageComponent({
			componentType: ComponentType.Button,
			filter: (collected) => collected.user.id === interaction.user.id,
			time: 120_000,
		})
		.catch(async () => {
			try {
				await interaction.editReply({
					content: "The report has timed out, please try again.",
					components: [],
				});
			} catch (error_) {
				const error = error_ as Error;
				logger.error(error, error.message);
			}

			return undefined;
		});

	if (collectedInteraction?.customId === cancelKey) {
		await collectedInteraction.update({
			content: "Message report canceled.",
			embeds: [],
			components: [],
		});
	} else if (collectedInteraction?.customId === reportKey) {
		await collectedInteraction.deferUpdate();

		const lastReport = await getPendingReportByTarget(interaction.guildId!, args.message.author.id);
		if (lastReport!.messageId!.includes(args.message.id)) {
			await collectedInteraction.editReply({
				content: "This message has already been recently reported, thanks for making our community a better place!",
				embeds: [],
				components: [],
			});

			return;
		}

		await redis.setex(key, REPORT_DUPLICATE_PRE_EXPIRE_SECONDS, "");

		const mongo = getModelForClass(reports);

		const report = await createReport({
			guildId: interaction.guildId,
			reportId: await mongo.nextReport(interaction.guildId),
			authorId: interaction.user.id,
			authorTag: interaction.user.tag,
			reason: trimmedReason,
			status: ReportStatus.Pending,
			targetId: args.message.author.id,
			targetTag: args.message.author.tag,
			message: args.message,
			type: ReportType.Message,
		});

		await upsertReportLog(interaction.guild, report, args.message);
		await redis.setex(key, REPORT_DUPLICATE_EXPIRE_SECONDS, "");

		await collectedInteraction.editReply({
			content: "Successfully reported message, thanks for making our community a better place!",
			components: [createMessageActionRow([trustAndSafetyButton])],
		});
	}
}
