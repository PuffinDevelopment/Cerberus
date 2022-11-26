import type { ArgsParam, InteractionParam } from "@yuudachi/framework/types";
import { channelLink, hyperlink } from "discord.js";
import { resolveReportStatus } from "../../../../functions/logging/generateReportLog.js";
import { upsertReportLog } from "../../../../functions/logging/upsertReportLog.js";
import type { ReportStatus } from "../../../../functions/reports/createReport.js";
import { getReport } from "../../../../functions/reports/getReport.js";
import { updateReport } from "../../../../functions/reports/updateReport.js";
import { checkLogChannel } from "../../../../functions/settings/checkLogChannel.js";
import { getGuildSetting, SettingsKeys } from "../../../../functions/settings/getGuildSetting.js";
import type { ReportUtilsCommand } from "../../../../interactions/index.js";

export async function status(
	interaction: InteractionParam,
	args: ArgsParam<typeof ReportUtilsCommand>["status"],
): Promise<void> {
	const reportLogChannel = checkLogChannel(
		interaction.guild,
		await getGuildSetting(interaction.guildId, SettingsKeys.ReportChannelId),
	);

	if (!reportLogChannel) {
		throw new Error("No report channel has been initialized yet.");
	}

	const originalReport = await getReport(interaction.guildId, args.report);

	if (!originalReport) {
		throw new Error(`Cannot find report \`#${args.report}\``);
	}

	const report = await updateReport(
		{
			reportId: originalReport.reportId,
			guildId: interaction.guildId,
			status: args.status as ReportStatus,
		},
		interaction.user,
	);
	await upsertReportLog(interaction.guild, report);

	await interaction.editReply({
		content: `Successfully set status of report ${hyperlink(
			`#${originalReport.reportId}`,
			channelLink(originalReport.logPostId!, interaction.guildId),
		)} to ${resolveReportStatus(report)}`,
	});
}
