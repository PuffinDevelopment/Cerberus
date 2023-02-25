import { ms } from "@naval-base/ms";
import { getModelForClass } from "@typegoose/typegoose";
import { messageLink, time, TimestampStyles } from "discord.js";
import { cases } from "../../models/cases.js";
import { type Case, CaseAction } from "../cases/createCase.js";
import { getGuildSetting, SettingsKeys } from "../settings/getGuildSetting.js";

export async function generateCaseLog(case_: Case) {
	const mongo = getModelForClass(cases);
	const modLogChannelId = await getGuildSetting(case_.guildId, SettingsKeys.ModLogChannelId);

	const action = CaseAction[case_.action];

	let msg = `**Member**: \`${case_.targetTag}\` (${case_.targetId})\n**Action**: ${action}`;

	if (case_.actionExpiration) {
		const expirationDate = new Date(case_.actionExpiration);

		msg += `\n**Expiration**: \`${ms(expirationDate.getTime() - Date.now())}\` ${time(
			expirationDate,
			TimestampStyles.RelativeTime,
		)}`;
	}

	if (case_.contextMessageId) {
		const contextMessage = await mongo.findOne(
			{ guild_id: case_.guildId },
			{ context_message_id: case_.contextMessageId },
		);
		if (Reflect.has(contextMessage ?? {}, "channel_id")) {
			msg += `**Context:** ["Beam me up Cerby"](${messageLink(
				case_.guildId,
				modLogChannelId,
				case_.contextMessageId,
			)})`;
		}
	}

	if (case_.reason) {
		msg += `\n**Reason:** ${case_.reason}`;
	} else {
		msg += `\n**Reason:** Use \`/reason ${case_.caseId} <...reason>\` to set a reason for this case`;
	}

	if (case_.refId) {
		const reference = await mongo.findOne({ guild_id: case_.guildId }, { ref_id: case_.refId });

		if (Reflect.has(reference ?? {}, "context_message_id")) {
			msg += `\n**Case Reference:** [#${case_.refId}](${messageLink(
				modLogChannelId,
				reference!.context_message_id!,
				case_.guildId,
			)})`;
		}
	}

	return msg;
}
