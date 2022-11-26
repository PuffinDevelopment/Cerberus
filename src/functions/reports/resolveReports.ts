import { getModelForClass } from "@typegoose/typegoose";
import { logger } from "@yuudachi/framework";
import type { Guild, User } from "discord.js";
import { reports } from "../../models/reports.js";
import { upsertReportLog } from "../logging/upsertReportLog.js";
import { ReportStatus } from "./createReport.js";
import type { RawReport } from "./transformReport.js";
import { updateReport } from "./updateReport.js";

export async function resolvePendingReports(guild: Guild, targetId: string, caseId: number, moderator: User) {
	const mongo = getModelForClass(reports);

	const pendingReports = (await mongo
		.findOne({
			guild: guild.id,
			status: ReportStatus.Pending,
			$or: [{ target: targetId }, { author: targetId }],
		})
		.sort({ createdAt: 1 })) as unknown as RawReport;

	const arrayReports = [pendingReports];
	for (const report of arrayReports) {
		try {
			const status = report.target_id === targetId ? ReportStatus.Approved : ReportStatus.Spam;

			const updatedReport = await updateReport(
				{
					guildId: guild.id,
					reportId: report.report_id,
					refId: caseId,
					status,
				},
				moderator,
			);

			await upsertReportLog(guild, updatedReport);
		} catch (error) {
			logger.error(
				{
					error,
					reportId: report.report_id,
					targetId,
					moderatorId: moderator.id,
				},
				"Failed to automatically resolve report ",
			);
		}
	}

	return pendingReports;
}
