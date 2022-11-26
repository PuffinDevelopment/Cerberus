import { getModelForClass } from "@typegoose/typegoose";
import { truncateEmbed, createMessageActionRow } from "@yuudachi/framework";
import type { ArgsParam, InteractionParam } from "@yuudachi/framework/types";
import type { Message } from "discord.js";
import { OP_DELIMITER } from "../../../../Constants.js";
import { formatMessageToEmbed } from "../../../../functions/logging/formatMessageToEmbed.js";
import { generateReportEmbed } from "../../../../functions/logging/generateReportEmbed.js";
import { ReportType } from "../../../../functions/reports/createReport.js";
import { type RawReport, transformReport } from "../../../../functions/reports/transformReport.js";
import type { ReportUtilsCommand } from "../../../../interactions/index.js";
import { reports } from "../../../../models/reports.js";
import { createMessageLinkButton } from "../../../../util/createMessageLinkButton.js";
import { generateHistory, generateUserInfo, HistoryType } from "../../../../util/generateHistory.js";
import { resolveMemberAndUser } from "../../../../util/resolveMemberAndUser.js";
import { resolveMessage } from "../../../../util/resolveMessage.js";

export async function lookup(
	interaction: InteractionParam,
	args: ArgsParam<typeof ReportUtilsCommand>["lookup"],
): Promise<void> {
	const mongo = getModelForClass(reports);
	const [cmd, id] = args.phrase.split(OP_DELIMITER);

	if (cmd === "history" && id) {
		const data = await resolveMemberAndUser(interaction.guild, id);

		const embed = truncateEmbed(await generateHistory(interaction, data, HistoryType.Report));

		await interaction.editReply({
			embeds: [embed],
		});
		return;
	}

	if (!Number.isNaN(Number.parseInt(args.phrase, 10))) {
		const report = await mongo.findOne({
			guild_id: interaction.guildId,
			report_id: args.phrase,
		});

		if (!report) {
			throw new Error("Could not resolve the provided option. Make sure to select an autocomplete option.");
		}

		let message: Message<true> | null = null;

		try {
			message = report.message_id ? await resolveMessage(report.guild_id, report.channel_id, report.message_id) : null;
		} catch {}

		const author = await interaction.client.users.fetch(report.author_id);

		const embeds = [
			truncateEmbed(await generateReportEmbed(author, transformReport(report as unknown as RawReport), message)),
		];

		if (message) {
			embeds.push(truncateEmbed(formatMessageToEmbed(message)));
		}

		if (report.type === ReportType.User) {
			const target = await resolveMemberAndUser(interaction.guild, report.target_id);
			embeds.push(truncateEmbed(generateUserInfo(target)));
		}

		await interaction.editReply({
			embeds,
			components: message ? [createMessageActionRow([createMessageLinkButton(message)])] : [],
		});
		return;
	}

	throw new Error("Could not resolve the provided option. Make sure to select an autocomplete option.");
}
