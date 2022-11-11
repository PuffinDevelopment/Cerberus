import { getModelForClass } from "@typegoose/typegoose";
import type { Guild, Snowflake, User } from "discord.js";
import { cases } from "../../models/cases.js";
import { generateCasePayload } from "../logging/generateCasePayload.js";
import { CaseAction, createCase } from "./createCase.js";
import type { RawCase } from "./transformCase.js";

type DeleteCaseOptions = {
	action?: CaseAction | undefined;
	caseId?: number | undefined;
	guild: Guild;
	manual?: boolean | undefined;
	messageId?: Snowflake | undefined;
	reason?: string | null | undefined;
	skipAction?: boolean | undefined;
	target?: User | undefined;
	user?: User | null | undefined;
};

export async function deleteCase({
	guild,
	user = null,
	target,
	caseId,
	reason,
	manual = false,
	skipAction = false,
	action = undefined,
}: DeleteCaseOptions) {
	const mongo = getModelForClass(cases);

	let case_: RawCase | undefined;
	let localReason = reason;

	if (target) {
		case_ = (await mongo
			.find({
				guild_id: guild.id,
				target_id: target.id,
				action: action ?? CaseAction.Ban,
			})
			.sort({
				created_at: -1,
			})
			.limit(1)) as unknown as RawCase;
	}

	if (!target) {
		case_ = (await mongo.findOne({ guild_id: guild.id, case_id: caseId })) as unknown as RawCase;
	}

	if (case_?.action === CaseAction.Timeout) {
		await mongo.findOneAndUpdate({ guild_id: guild.id, case_id: case_.case_id }, { action_processed: true });

		if (manual) {
			localReason = "Manually ended timeout";
		} else {
			localReason = "Timeout expired based on duration";
		}
	}

	const case_action = case_?.action ?? CaseAction.Ban;

	return createCase(
		guild,
		generateCasePayload({
			guildId: guild.id,
			caseId: await mongo.nextCase(guild.id),
			user,
			args: {
				reason: localReason,
				user: {
					user: await guild.client.users.fetch(case_?.target_id ?? target!.id),
					member: await guild.members.fetch(case_?.target_id ?? target!.id).catch(() => null),
				},
				case_reference: case_?.case_id,
			},
			action: case_action === CaseAction.Ban ? CaseAction.Unban : CaseAction.TimeoutEnd,
		}),
		skipAction,
	);
}
