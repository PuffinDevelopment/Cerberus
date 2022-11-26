import { getModelForClass } from "@typegoose/typegoose";
import { container, createMessageActionRow, ellipsis, createButton, logger } from "@yuudachi/framework";
import type { ArgsParam, InteractionParam } from "@yuudachi/framework/types";
import {
	type APIEmbed,
	type ModalSubmitInteraction,
	type GuildMember,
	ButtonStyle,
	ComponentType,
	hyperlink,
} from "discord.js";
import type { Redis } from "ioredis";
import { nanoid } from "nanoid";
import {
	Color,
	REPORT_REASON_MAX_LENGTH,
	REPORT_DUPLICATE_EXPIRE_SECONDS,
	REPORT_DUPLICATE_PRE_EXPIRE_SECONDS,
} from "../../../../Constants.js";
import { upsertReportLog } from "../../../../functions/logging/upsertReportLog.js";
import { createReport, ReportStatus, ReportType } from "../../../../functions/reports/createReport.js";
import type { ReportCommand } from "../../../../interactions/index.js";
import { reports } from "../../../../models/reports.js";
import { kRedis } from "../../../../tokens.js";
import { resolveGuildCommand, chatInputApplicationCommandMention } from "../../../../util/commandUtils.js";

type MemberAssuredReportArgs = ArgsParam<typeof ReportCommand>["user"] & { user: { member: GuildMember } };

export async function user(
	interaction: InteractionParam | ModalSubmitInteraction<"cached">,
	args: ArgsParam<typeof ReportCommand>["user"],
) {
	const redis = container.resolve<Redis>(kRedis);
	const key = `guild:${interaction.guildId}:report:user:${args.user.user.id}`;

	const {
		user: { member },
		reason,
		attachment,
	} = args as MemberAssuredReportArgs;
	const trimmedReason = reason.trim();

	if (attachment) {
		const attachmentIsImage = attachment.contentType === "image/jpeg" || attachment.contentType === "image/png";

		if (!attachmentIsImage) {
			throw new Error("Invalid attachment, only images are allowed.");
		}
	}

	const reportKey = nanoid();
	const cancelKey = nanoid();

	const reportButton = createButton({
		customId: reportKey,
		label: "Create Report",
		style: ButtonStyle.Danger,
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
		`Are you sure you want to report ${member.user.toString()} - \`${member.user.tag}\` (${
			member.user.id
		}) to the server moderators?\n**Reason:** ${ellipsis(trimmedReason, REPORT_REASON_MAX_LENGTH)}`,
		"",
	];

	if (!attachment) {
		const reportCommand = !interaction.isChatInputCommand() && (await resolveGuildCommand(interaction.guild, "report"));
		const report_command = reportCommand
			? `${chatInputApplicationCommandMention("report user", reportCommand.id)} command`
			: "attachment option";

		contentParts.push(
			`ℹ️ ***Tip:** If it helps to provide context, you can attach an image to this report using the ${report_command}!*`,
			"",
		);
	}

	contentParts.push(
		`**Attention:** We are not Discord and we **cannot** moderate ${hyperlink(
			"Trust & Safety",
			"https://support.discord.com/hc/en-us/requests/new",
		)} issues.\n**Creating false reports may lead to moderation actions.**`,
	);

	const embed: APIEmbed = {
		author: {
			name: `${member.user.tag} (${member.user.id})`,
			icon_url: member.user.displayAvatarURL(),
		},
		color: Color.DiscordEmbedBackground,
	};

	const reply = await interaction.editReply({
		content: contentParts.join("\n"),
		embeds: [
			{
				...embed,
				image: attachment ? { url: attachment.url } : undefined,
			},
		],
		components: [createMessageActionRow([cancelButton, reportButton, trustAndSafetyButton])],
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
			content: "User report canceled.",
			embeds: [],
			components: [],
		});
	} else if (collectedInteraction?.customId === reportKey) {
		await collectedInteraction.deferUpdate();

		if (await redis.exists(key)) {
			await collectedInteraction.editReply({
				content: "This user has already been recently reported, thanks for making our community a better place!",
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
			targetId: member.id,
			targetTag: member.user.tag,
			attachmentUrl: attachment?.proxyURL,
			type: ReportType.User,
		});

		await upsertReportLog(interaction.guild, report);
		await redis.setex(key, REPORT_DUPLICATE_EXPIRE_SECONDS, "");

		await collectedInteraction.editReply({
			content: "Successfully reported user, thanks for making our community a better place!",
			embeds: [embed],
			components: [createMessageActionRow([trustAndSafetyButton])],
		});
	}
}
