import type { APIEmbed, Message, User } from "discord.js";
import { Color } from "../../Constants.js";
import { type Report, ReportStatus } from "../reports/createReport.js";
import { generateReportLog } from "./generateReportLog.js";

function statusToColor(status: ReportStatus): Color {
	switch (status) {
		case ReportStatus.Pending:
			return Color.DiscordPrimary;
		case ReportStatus.Approved:
			return Color.DiscordSuccess;
		case ReportStatus.Rejected:
			return Color.DiscordWarning;
		case ReportStatus.Spam:
			return Color.DiscordDanger;
		default:
			return Color.DiscordPrimary;
	}
}

export async function generateReportEmbed(user: User, report: Report, message?: Message | null): Promise<APIEmbed> {
	const embed: APIEmbed = {
		author: {
			name: `${user.tag} (${user.id})`,
			icon_url: user.avatarURL()!,
		},
		color: statusToColor(report.status),
		description: await generateReportLog(report, message),
		footer:
			report.status === ReportStatus.Pending
				? {
						text: "Hint: To resolve a report: Change the status forum label, reference it in a case, set the reference for an existing case with /reference, or set the status via /reports status",
						icon_url: user.client.user!.displayAvatarURL(),
				  }
				: undefined,
	};

	if (report.attachmentUrl) {
		embed.image = {
			url: report.attachmentUrl,
		};
	}

	return embed;
}
