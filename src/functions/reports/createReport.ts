import { getModelForClass } from "@typegoose/typegoose";
import type { PartialAndUndefinedOnNull } from "@yuudachi/framework/types";
import type { Message, Snowflake } from "discord.js";
import type { CamelCasedProperties } from "type-fest";
import { reports } from "../../models/reports.js";
import { type RawReport, transformReport } from "./transformReport.js";

export type Report = PartialAndUndefinedOnNull<CamelCasedProperties<RawReport>> & {
	status: ReportStatus;
	type: ReportType;
};

export type CreateReport = Omit<Report, "channelId" | "createdAt" | "reportId" | "status"> & {
	channelId?: Snowflake | null | undefined;
	createdAt?: Date | null | undefined;
	message?: Message | null | undefined;
	reportId?: number | null | undefined;
	status?: ReportStatus | null | undefined;
};

export enum ReportType {
	Message,
	User,
}

export enum ReportStatus {
	Pending,
	Approved,
	Rejected,
	Spam,
}

export async function createReport(report: CreateReport): Promise<Report> {
	const mongo = getModelForClass(reports);

	const rawReport = (await mongo.create({
		guild_id: report.guildId,
		report_id: report.reportId,
		type: report.type,
		status: report.status,
		message_id: report.message?.id ?? report.messageId ?? null,
		channel_id: report.message?.channelId ?? report.channelId ?? null,
		target_id: report.targetId,
		target_tag: report.targetTag,
		author_id: report.authorId,
		author_tag: report.authorTag,
		reason: report.reason,
		attachment_url: report.attachmentUrl ?? null,
		log_post_id: report.logPostId ?? null,
		ref_id: report.refId ?? null,
	})) as unknown as RawReport;

	return transformReport(rawReport);
}
