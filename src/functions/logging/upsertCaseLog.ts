import { getModelForClass } from "@typegoose/typegoose";
import type { Guild, User } from "discord.js";
import { cases } from "../../models/cases.js";
import type { Case } from "../cases/createCase.js";
import { checkLogChannel } from "../settings/checkLogChannel.js";
import { getGuildSetting, SettingsKeys } from "../settings/getGuildSetting.js";
import { generateCaseEmbed } from "./generateCaseEmbed.js";

export async function upsertCaseLog(guild: Guild, user: User | null | undefined, case_: Case) {
	const mongo = getModelForClass(cases);
	const modLogChannel = checkLogChannel(guild, await getGuildSetting(guild.id, SettingsKeys.ModLogChannelId));

	const embed = await generateCaseEmbed(user, case_);

	if (case_.contextMessageId) {
		const message = await modLogChannel!.messages.fetch(case_.contextMessageId);
		await message.edit({
			embeds: [embed],
		});
	} else {
		const logMessage = await modLogChannel!.send({
			embeds: [embed],
		});

		await mongo.findOneAndUpdate(
			{ guild_id: case_.guildId, case_id: case_.caseId },
			{ context_message_id: logMessage.id },
		);
	}
}
