import { ms } from "@naval-base/ms";
import { Command } from "@yuudachi/framework";
import type { ArgsParam, InteractionParam } from "@yuudachi/framework/types";
import { hyperlink, messageLink } from "discord.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { Redis } from "ioredis";
import { inject, injectable } from "tsyringe";
import { CaseAction } from "../../functions/cases/createCase.js";
import { getCase } from "../../functions/cases/getCase.js";
import { updateCase } from "../../functions/cases/updateCase.js";
import { upsertCaseLog } from "../../functions/logging/upsertCaseLog.js";
import { checkLogChannel } from "../../functions/settings/checkLogChannel.js";
import { getGuildSetting, SettingsKeys } from "../../functions/settings/getGuildSetting.js";
import type { DurationCommand } from "../../interactions/index.js";
import { kRedis } from "../../tokens.js";

@injectable()
export default class extends Command<typeof DurationCommand> {
	public constructor(@inject(kRedis) public readonly redis: Redis) {
		super();
	}

	public override async chatInput(
		interaction: InteractionParam,
		args: ArgsParam<typeof DurationCommand>,
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

		if (originalCase.actionProcessed) {
			const user = await interaction.client.users.fetch(originalCase.targetId);
			throw new Error(
				`${user.toString()} - ${user.tag} (${user.id}) with case ${hyperlink(
					`#${originalCase.caseId}`,
					messageLink(modLogChannel.id, originalCase.contextMessageId!, interaction.guildId),
				)} has no running restrictions.`,
			);
		}

		const parsedDuration = ms(args.duration);

		if (parsedDuration < 300_000 || parsedDuration > 2_419_200_000 || Number.isNaN(parsedDuration)) {
			throw new Error("Wrong duration format.");
		}

		const actionExpiration = Date.now() + parsedDuration;

		if (originalCase.action === CaseAction.Timeout) {
			try {
				const member = await interaction.guild.members.fetch(originalCase.targetId);
				await this.redis.setex(`guild:${member.guild.id}:user:${member.user.id}:timeout`, 15, "");
				await member.disableCommunicationUntil(actionExpiration);
			} catch {
				throw new Error(
					`Could not change the duration of the timeout for case ${hyperlink(
						`#${originalCase.caseId}`,
						messageLink(modLogChannel.id, originalCase.contextMessageId!, interaction.guildId),
					)}`,
				);
			}
		}

		const case_ = await updateCase({
			caseId: originalCase.caseId,
			guildId: interaction.guildId,
			actionExpiration: new Date(actionExpiration),
		});
		await upsertCaseLog(interaction.guild, interaction.user, case_);

		await interaction.editReply({
			content: `Successfully set duration for case ${hyperlink(
				`#${originalCase.caseId}`,
				messageLink(modLogChannel.id, originalCase.contextMessageId!, interaction.guildId),
			)}`,
		});
	}
}
