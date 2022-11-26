import { getModelForClass } from "@typegoose/typegoose";
import { removeUndefinedKeys } from "@yuudachi/framework";
import type { User } from "discord.js";
import { reports } from "../../models/reports.js";
import type { CreateReport } from "./createReport.js";
import { type RawReport, transformReport } from "./transformReport.js";

export type PatchReport = Pick<
	Partial<CreateReport>,
	"attachmentUrl" | "guildId" | "message" | "reason" | "refId" | "reportId" | "status"
>;

export async function updateReport(report: PatchReport, moderator?: User) {
	const mongo = getModelForClass(reports);

	const updates: Partial<Record<keyof RawReport, unknown>> = {
		status: report.status,
		attachment_url: report.attachmentUrl,
		reason: report.reason,
		message_id: report.message?.id,
		channel_id: report.message?.channel.id,
		ref_id: report.refId,
		mod_id: moderator?.id,
		mod_tag: moderator?.tag,
	};

	const queries = removeUndefinedKeys(updates);

	const updatedReport = (await mongo.findOneAndUpdate(
		{ guild_id: report.guildId, report_id: report.reportId },
		{ $set: queries },
		{ returnOriginal: false },
	)) as RawReport;

	return transformReport(updatedReport);
}
