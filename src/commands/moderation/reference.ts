import { Command } from "@yuudachi/framework";
import type { ArgsParam, InteractionParam } from "@yuudachi/framework/types";
import { hyperlink, messageLink } from "discord.js";
import { getCase } from "../../functions/cases/getCase.js";
import { updateCase } from "../../functions/cases/updateCase.js";
import { upsertCaseLog } from "../../functions/logging/upsertCaseLog.js";
import { checkLogChannel } from "../../functions/settings/checkLogChannel.js";
import { getGuildSetting, SettingsKeys } from "../../functions/settings/getGuildSetting.js";
import type { ReferenceCommand } from "../../interactions/index.js";

export default class extends Command<typeof ReferenceCommand> {
	public override async chatInput(
		interaction: InteractionParam,
		args: ArgsParam<typeof ReferenceCommand>,
	): Promise<void> {
		await interaction.deferReply({ ephemeral: true });

		const modLogChannel = checkLogChannel(
			interaction.guild,
			await getGuildSetting(interaction.guildId, SettingsKeys.ModLogChannelId),
		);

		if (!modLogChannel) {
			throw new Error("No mod log channel has been initialized yet.");
		}

		const originalCase = await getCase(interaction.guildId, args.case);

		if (!originalCase) {
			throw new Error(`Cannot find case \`#${args.case}\``);
		}

		const referenceCase = await getCase(interaction.guildId, args.reference);

		if (!referenceCase) {
			throw new Error(`Cannot find reference case \`#${args.reference}\``);
		}

		const case_ = await updateCase({
			caseId: originalCase.caseId,
			guildId: interaction.guildId,
			refId: referenceCase.caseId,
		});
		await upsertCaseLog(interaction.guild, interaction.user, case_);

		await interaction.editReply({
			content: `Successfully set the **case reference** for case ${hyperlink(
				`#${originalCase.caseId}`,
				messageLink(modLogChannel.id, originalCase.contextMessageId!, interaction.guildId),
			)} to ${hyperlink(
				`#${referenceCase.caseId}`,
				messageLink(modLogChannel.id, referenceCase.contextMessageId!, interaction.guildId),
			)}`,
		});
	}
}
