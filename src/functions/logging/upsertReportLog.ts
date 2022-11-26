import { Buffer } from "node:buffer";
import { getModelForClass } from "@typegoose/typegoose";
import type { APIEmbed, Embed, Guild, Message } from "discord.js";
import { REPORT_MESSAGE_CONTEXT_LIMIT } from "../../Constants.js";
import { reports } from "../../models/reports.js";
import { generateUserInfo } from "../../util/generateHistory.js";
import { resolveMemberAndUser } from "../../util/resolveMemberAndUser.js";
import { resolveMessage } from "../../util/resolveMessage.js";
import { type Report, ReportType, ReportStatus } from "../reports/createReport.js";
import { checkReportForum } from "../settings/checkLogChannel.js";
import type { ReportStatusTagTuple, ReportTypeTagTuple } from "../settings/getGuildSetting.js";
import { getGuildSetting, SettingsKeys } from "../settings/getGuildSetting.js";
import { formatMessageToEmbed } from "./formatMessageToEmbed.js";
import { formatMessagesToAttachment } from "./formatMessagesToAttachment.js";
import { generateReportEmbed } from "./generateReportEmbed.js";

export async function upsertReportLog(guild: Guild, report: Report, message?: Message) {
	const mongo = getModelForClass(reports);
	const reportForum = checkReportForum(guild, await getGuildSetting(guild.id, SettingsKeys.ReportChannelId));
	const reportStatusTags = await getGuildSetting<ReportStatusTagTuple>(guild.id, SettingsKeys.ReportStatusTags);
	const reportTypeTags = await getGuildSetting<ReportTypeTagTuple>(guild.id, SettingsKeys.ReportTypeTags);

	let localMessage = message;

	try {
		if (!localMessage && report.messageId) {
			localMessage = await resolveMessage(report.guildId, report.channelId!, report.messageId);
		}
	} catch {}

	const author = await guild.client.users.fetch(report.authorId);

	const embeds: (APIEmbed | Embed)[] = [await generateReportEmbed(author, report, localMessage)];
	if (localMessage?.inGuild()) {
		embeds.push(formatMessageToEmbed(localMessage));
	}

	if (report.type === ReportType.User) {
		const target = await resolveMemberAndUser(guild, report.targetId);

		embeds.push(generateUserInfo(target));
	}

	const statusTag = reportStatusTags[report.status];
	const typeTag = reportTypeTags[report.type];

	const reportPost = await reportForum!.threads.fetch(report.logPostId ?? "1").catch(() => null);
	const messageContext = localMessage?.inGuild()
		? await localMessage.channel.messages
				.fetch({ around: localMessage.id, limit: REPORT_MESSAGE_CONTEXT_LIMIT })
				.catch(() => null)
		: null;

	if (!reportPost) {
		const reportPost = await reportForum!.threads.create({
			name: `Report ${report.reportId} - ${report.targetTag} (${report.targetId})`,
			message: {
				embeds,
				files:
					messageContext && localMessage
						? [
								{
									name: "messagecontext.ansi",
									attachment: Buffer.from(
										formatMessagesToAttachment(
											messageContext,
											[localMessage.id],
											messageContext
												.filter((message: Message) => message.author.id === report.targetId)
												.map((message) => message.id),
										),
									),
								},
						  ]
						: undefined,
			},
			reason: `reported by ${report.authorTag} (${report.authorId})`,
			appliedTags: [typeTag, statusTag],
		});

		await mongo.findOneAndUpdate(
			{ guild_id: report.guildId, report_id: report.reportId },
			{ log_post_id: reportPost.id },
		);

		return reportPost;
	}

	const shouldUpdateTags = [statusTag, typeTag].some((required) => !reportPost.appliedTags.includes(required));

	if (reportPost.archived || shouldUpdateTags) {
		await reportPost.edit({
			archived: false,
			appliedTags: [typeTag, statusTag],
		});
	}

	const starter = await reportPost.messages.fetch(reportPost.id);
	await starter?.edit({ embeds });

	if (report.status !== ReportStatus.Pending) {
		await reportPost.edit({ archived: true });
	}

	return reportPost;
}
