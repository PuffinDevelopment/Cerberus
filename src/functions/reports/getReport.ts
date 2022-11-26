import { getModelForClass } from "@typegoose/typegoose";
import { reports } from "../../models/reports.js";
import { type RawReport, transformReport } from "./transformReport.js";

export async function getReport(guildId: string, reportId: number) {
	const mongo = getModelForClass(reports);

	const rawReport = (await mongo.findOne({ guild_id: guildId, report_id: reportId })) as unknown as RawReport;

	if (!rawReport) {
		return null;
	}

	return transformReport(rawReport);
}
