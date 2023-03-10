import { getModelForClass } from "@typegoose/typegoose";
import { reports } from "../../models/reports.js";
import type { Report } from "./createReport.js";
import { ReportStatus } from "./createReport.js";
import { type RawReport, transformReport } from "./transformReport.js";

export async function getReport(guildId: string, reportId: number) {
	const mongo = getModelForClass(reports);

	const rawReport = (await mongo.findOne({ guild_id: guildId, report_id: reportId })) as unknown as RawReport;

	if (!rawReport) {
		return null;
	}

	return transformReport(rawReport);
}

export async function getPendingReportByTarget(guildId: string, targetId: string): Promise<Report | null> {
	const mongo = getModelForClass(reports);

	const rawReport = await mongo
		.findOne({
			guild_id: guildId,
			target_id: targetId,
			status: ReportStatus.Pending,
		})
		.sort({ created_at: -1 })
		.limit(1);

	if (!rawReport) {
		return null;
	}

	return transformReport(rawReport.toObject());
}
