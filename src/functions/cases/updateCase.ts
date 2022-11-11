import { getModelForClass } from "@typegoose/typegoose";
import { removeUndefinedKeys } from "@yuudachi/framework";
import { cases } from "../../models/cases.js";
import type { CreateCase } from "./createCase.js";
import { type RawCase, transformCase } from "./transformCase.js";

export type PatchCase = Pick<
	CreateCase,
	"actionExpiration" | "caseId" | "contextMessageId" | "guildId" | "reason" | "refId"
>;

export async function updateCase(case_: PatchCase) {
	const mongo = getModelForClass(cases);

	const updates: Partial<Record<keyof RawCase, unknown>> = {
		action_expiration: case_.actionExpiration,
		reason: case_.reason,
		context_message_id: case_.contextMessageId,
		ref_id: case_.refId,
	};

	const queries = removeUndefinedKeys(updates);

	const updatedCase = (await mongo.findOneAndUpdate(
		{ guild_id: case_.guildId, case_id: case_.caseId },
		queries,
	)) as RawCase;

	return transformCase(updatedCase);
}
