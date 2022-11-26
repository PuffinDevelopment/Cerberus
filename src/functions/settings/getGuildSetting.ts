import { getModelForClass } from "@typegoose/typegoose";
import type { Snowflake } from "discord.js";
import { settings } from "../../models/settings.js";

export enum SettingsKeys {
	GuildLogChannelId = "guild_log_channel_id",
	ModLogChannelId = "mod_log_channel_id",
	ModRoleId = "mod_role_id",
	ReportChannelId = "report_channel_id",
	ReportStatusTags = "report_status_tags",
	ReportTypeTags = "report_type_tags",
}

export type ReportStatusTagTuple = [string, string, string, string, string, string];
export type ReportTypeTagTuple = [string, string];

const mongo = getModelForClass(settings);

export async function getGuildSetting<T = string>(guildId: Snowflake, prop: SettingsKeys) {
	const guildSetting = await mongo.findOne({ guild_id: guildId });
	return (guildSetting![prop] ?? null) as unknown as T;
}
