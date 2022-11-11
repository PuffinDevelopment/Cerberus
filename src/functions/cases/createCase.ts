import { getModelForClass } from "@typegoose/typegoose";
import { logger } from "@yuudachi/framework";
import type { PartialAndUndefinedOnNull } from "@yuudachi/framework/types";
import type { Guild, GuildMember, Snowflake } from "discord.js";
import type { CamelCasedProperties } from "type-fest";
import { cases } from "../../models/cases.js";
import { type RawCase, transformCase } from "./transformCase.js";

export enum CaseAction {
	Warn,
	Kick,
	Softban,
	Ban,
	Unban,
	Timeout,
	TimeoutEnd,
}

export type Case = PartialAndUndefinedOnNull<CamelCasedProperties<RawCase>>;

export type CreateCase = Omit<
	Case,
	"actionExpiration" | "actionProcessed" | "caseId" | "createdAt" | "logMessageId" | "modId" | "modTag" | "multi"
> & {
	actionExpiration?: Date | null | undefined;
	caseId?: number | null | undefined;
	contextMessageId?: Snowflake | null | undefined;
	deleteMessageDays?: number | null | undefined;
	modId?: Snowflake | null | undefined;
	modTag?: string | null | undefined;
	multi?: boolean | null | undefined;
	target?: GuildMember | null | undefined;
};

export async function createCase(
	guild: Guild,
	case_: CreateCase & { target?: GuildMember | null | undefined },
	skipAction = false,
) {
	const mongo = getModelForClass(cases);

	const reason = case_.modTag
		? `Mod: ${case_.modTag}${case_.reason ? ` | ${case_.reason.replaceAll("`", "")}` : ""}`
		: case_.reason ?? undefined;

	try {
		if (!skipAction) {
			switch (case_.action) {
				case CaseAction.TimeoutEnd:
				case CaseAction.Warn:
					break;
				case CaseAction.Kick: {
					await case_.target!.kick(reason);
					break;
				}

				case CaseAction.Softban: {
					await guild.bans.create(case_.targetId, { deleteMessageDays: case_.deleteMessageDays ?? 1, reason });
					await guild.bans.remove(case_.targetId, reason);
					break;
				}

				case CaseAction.Ban: {
					await guild.bans.create(case_.targetId, { deleteMessageDays: case_.deleteMessageDays ?? 0, reason });
					break;
				}

				case CaseAction.Unban:
					await guild.bans.remove(case_.targetId, reason);
					break;
				case CaseAction.Timeout:
					await case_.target!.disableCommunicationUntil(case_.actionExpiration ?? null, reason);
					break;

				default:
					break;
			}
		}
	} catch (error_) {
		const error = error_ as Error;
		logger.error(error, error.message);
	}

	const newCase = (await mongo.create({
		guild_id: case_.guildId,
		case_id: case_.caseId,
		mod_id: case_.modId ?? null,
		mod_tag: case_.modTag ?? null,
		target_id: case_.targetId,
		target_tag: case_.targetTag,
		action: case_.action,
		action_expiration: case_.actionExpiration ?? null,
		action_processed: !case_.actionExpiration,
		reason: case_.reason ?? null,
		context_message_id: case_.contextMessageId ?? null,
		ref_id: case_.refId ?? null,
		multi: case_.multi ?? false,
	})) as unknown as RawCase;

	return transformCase(newCase);
}
