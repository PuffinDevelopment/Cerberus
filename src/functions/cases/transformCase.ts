import type { Snowflake } from "discord.js";
import type { Case } from "./createCase.js";

export type RawCase = {
	action: number;
	action_expiration: string | null;
	action_processed: boolean;
	case_id: number;
	context_message_id: Snowflake | null;
	created_at: Date;
	guild_id: Snowflake;
	mod_id: Snowflake;
	mod_tag: string;
	multi: boolean;
	reason: string | null;
	ref_id: number | null;
	target_id: Snowflake;
	target_tag: string;
};

export function transformCase(case_: RawCase): Case {
	return {
		caseId: case_.case_id,
		guildId: case_.guild_id,
		action: case_.action,
		actionExpiration: case_.action_expiration,
		reason: case_.reason,
		modId: case_.mod_id,
		modTag: case_.mod_tag,
		targetId: case_.target_id,
		targetTag: case_.target_tag,
		contextMessageId: case_.context_message_id,
		refId: case_.ref_id,
		actionProcessed: case_.action_processed,
		multi: case_.multi,
		createdAt: case_.created_at,
	} as const;
}
