import { getModelForClass } from "@typegoose/typegoose";
import { logger, container } from "@yuudachi/framework";
import { Client, time, TimestampStyles } from "discord.js";
import { cases } from "../../models/cases.js";
import { type Case, CaseAction } from "../cases/createCase.js";

export async function generateCaseLog(case_: Case) {
	const client = container.resolve<Client<true>>(Client);
	const mongo = getModelForClass(cases);

	let action = CaseAction[case_.action];

	if ((case_.action === CaseAction.Role || case_.action === CaseAction.Unrole) && case_.roleId) {
		try {
			const guild = client.guilds.cache.get(case_.guildId)!;
			const role = guild.roles.cache.get(case_.roleId);

			if (role) {
				action += ` \`${role.name}\` (${role.id})`;
			} else {
				action += ` \`Unknown\` (${case_.roleId})`;
			}
		} catch (error_) {
			const error = error_ as Error;
			logger.error(error, error.message);
		}
	}

	let msg = `**Member**: \`${case_.targetTag}\` (${case_.targetId})\n**Action**: ${action}`;

	if (case_.actionExpiration) {
		msg += `\n**Expiration**: ${time(new Date(case_.actionExpiration), TimestampStyles.RelativeTime)}`;
	}

	if (case_.contextMessageId) {
		const contextMessage = await mongo.findOne(
			{ guild_id: case_.guildId },
			{ context_message_id: case_.contextMessageId },
		);
		if (Reflect.has(contextMessage ?? {}, "channel_id")) {
			msg += `**Context:** ["Beam me up Cerr"](${case_.contextMessageId})`;
		}
	}

	if (case_.reason) {
		msg += `\n**Reason:** ${case_.reason}`;
	} else {
		msg += `\n**Reason:** Use \`/reason ${case_.caseId} <...reason>\` to set a reason for this case`;
	}

	if (case_.refId) {
		const reference = await mongo.findOne({ guild_id: case_.guildId }, { ref_id: case_.refId });

		if (Reflect.has(reference ?? {}, "log_message_id")) {
			msg += `\n**Case Reference:** [#${case_.refId}](${reference!.context_message_id!})`;
		}
	}

	return msg;
}
