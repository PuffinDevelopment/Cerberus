/* eslint-disable @typescript-eslint/padding-line-between-statements */
import { getModelForClass } from "@typegoose/typegoose";
import { ellipsis } from "@yuudachi/framework";
import {
	type Message,
	codeBlock,
	hyperlink,
	messageLink,
	userMention,
	channelMention,
	time,
	TimestampStyles,
} from "discord.js";
import { REPORT_REASON_MAX_LENGTH } from "../../Constants.js";
import { cases } from "../../models/cases.js";
import type { Report } from "../reports/createReport.js";
import { getGuildSetting, SettingsKeys } from "../settings/getGuildSetting.js";

enum ReportStatus {
	Pending,
	// eslint-disable-next-line typescript-sort-keys/string-enum
	Approved,
	Rejected,
	Spam,
}

export async function generateReportLog(report: Report, message?: Message | null): Promise<string> {
	const mongo = getModelForClass(cases);

	const parts = [
		`**Reported User:** ${userMention(report.targetId)} - \`${report.targetTag}\` (${report.targetId})}`,
		`**Reason:**\n${codeBlock(ellipsis(report.reason.trim(), REPORT_REASON_MAX_LENGTH * 2))}`,
	];

	if (message || report.messageId) {
		parts.push(
			`**Message:** ${message ? hyperlink("Beam me up, Cerr", message.url) : "Message deleted"} (${channelMention(
				report.channelId!,
			)})`,
		);
	}

	if (report.refId) {
		const reference = await mongo.findOne({ guild_id: report.guildId, case_id: report.refId });

		const modLogChannelId = await getGuildSetting(report.guildId, SettingsKeys.ModLogChannelId);

		if (modLogChannelId && Reflect.has(reference ?? {}, "context_message_id")) {
			parts.push(
				`**Case Reference:** ${hyperlink(
					`#${report.refId}`,
					messageLink(modLogChannelId, reference!.context_message_id!, report.guildId),
				)}`,
			);
		}
	}

	parts.push(`**Status:** ${resolveReportStatus(report)}`);

	if (report.modId && report.modTag) {
		parts.push(
			"",
			`**Moderator:** \`${report.modTag}\` (${report.modId})`,
			`**Updated at:** ${time(new Date(report.updatedAt ?? report.createdAt), TimestampStyles.ShortDateTime)}`,
		);
	}

	return parts.join("\n");
}

export function resolveReportStatus(report: Report) {
	let statusMessage = "";
	switch (report.status) {
		case ReportStatus.Pending: {
			statusMessage = "Pending";
			break;
		}
		case ReportStatus.Approved: {
			statusMessage = "Approved";
			break;
		}
		case ReportStatus.Rejected: {
			statusMessage = "Rejected";
			break;
		}
		case ReportStatus.Spam: {
			statusMessage = "Spam";
			break;
		}
		default: {
			break;
		}
	}
	return statusMessage;
}
