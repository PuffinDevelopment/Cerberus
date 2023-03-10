import { getModelForClass } from "@typegoose/typegoose";
import { SNOWFLAKE_MIN_LENGTH } from "@yuudachi/framework";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime.js";
import type { Snowflake } from "discord.js";
import { reports } from "../../models/reports.js";

dayjs.extend(relativeTime);

export async function findReports(phrase: string, guildId: Snowflake) {
	const mongo = getModelForClass(reports);

	if (!phrase.length) {
		return mongo.find({ guild_id: guildId }).sort({ created_at: -1 }).limit(25);
	}

	if (!Number.isNaN(Number.parseInt(phrase, 10)) && phrase.length < SNOWFLAKE_MIN_LENGTH) {
		return mongo.find({ guild_id: guildId, report_id: phrase });
	}

	return mongo
		.find({
			guild_id: guildId,
			$or: [
				{ author_id: phrase },
				{ author_tag: { $regex: phrase } },
				{ target_id: { $regex: phrase } },
				{ target_tag: { $regex: phrase } },
				{ reason: { $regex: phrase } },
			],
		})
		.sort({ created_at: -1 })
		.limit(25);
}
