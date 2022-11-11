import { getModelForClass } from "@typegoose/typegoose";
import type { Snowflake } from "discord.js";
import { cases } from "../../models/cases.js";
import { type RawCase, transformCase } from "./transformCase.js";

export async function getCase(guildId: Snowflake, caseId: number) {
	const mongo = getModelForClass(cases);

	const case_ = (await mongo.findOne({ guild_id: guildId, case_id: caseId })) as RawCase;

	if (!case_) {
		return null;
	}

	return transformCase(case_);
}
