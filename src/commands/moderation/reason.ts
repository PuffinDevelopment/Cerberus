import { Command, logger, createButton, truncate, createMessageActionRow } from "@yuudachi/framework";
import type { ArgsParam, InteractionParam } from "@yuudachi/framework/types";
import { ComponentType, ButtonStyle, hyperlink, messageLink } from "discord.js";
import { nanoid } from "nanoid";
import type { Case } from "../../functions/cases/createCase.js";
import { getCase } from "../../functions/cases/getCase.js";
import { updateCase } from "../../functions/cases/updateCase.js";
import { upsertCaseLog } from "../../functions/logging/upsertCaseLog.js";
import { checkLogChannel } from "../../functions/settings/checkLogChannel.js";
import { getGuildSetting, SettingsKeys } from "../../functions/settings/getGuildSetting.js";
import type { ReasonCommand } from "../../interactions/index.js";
import { CASE_REASON_MAX_LENGTH } from "../../util/constants.js";

export default class extends Command<typeof ReasonCommand> {
	public override async chatInput(interaction: InteractionParam, args: ArgsParam<typeof ReasonCommand>): Promise<void> {
		const reply = await interaction.deferReply({ ephemeral: true });

		const modLogChannel = checkLogChannel(
			interaction.guild,
			await getGuildSetting(interaction.guildId, SettingsKeys.ModLogChannelId),
		);

		if (!modLogChannel) {
			throw new Error("No mod log channel has been initialized yet.");
		}

		if (args.reason && args.reason.length >= CASE_REASON_MAX_LENGTH) {
			throw new Error(`Maximum length of ${CASE_REASON_MAX_LENGTH} for reason exceeded.`);
		}

		const lower = Math.min(args.case, args.last_case ?? args.case);
		const upper = Math.max(args.case, args.last_case ?? args.case);

		if (lower < 1 || upper < 1) {
			await interaction.editReply({
				content: "Case ids have to be above `0`",
			});
			return;
		}

		let originalCaseLower: Case | null;
		let originalCaseUpper: Case | null;

		if (args.last_case) {
			const changeKey = nanoid();
			const cancelKey = nanoid();

			const changeButton = createButton({
				label: "Set Reason",
				customId: changeKey,
				style: ButtonStyle.Danger,
			});
			const cancelButton = createButton({
				label: "Cancel",
				customId: cancelKey,
				style: ButtonStyle.Secondary,
			});

			originalCaseLower = await getCase(interaction.guildId, lower);
			originalCaseUpper = await getCase(interaction.guildId, upper);

			if (!originalCaseLower || !originalCaseUpper) {
				await interaction.editReply({
					content: `Invalid case range \`#${lower}\` to \`#${upper}\``,
					components: [],
				});
				return;
			}

			await interaction.editReply({
				content: `Do you really want to set a reason for case range ${hyperlink(
					`#${lower}`,
					messageLink(modLogChannel.id, originalCaseLower.contextMessageId!, interaction.guildId),
				)} to ${hyperlink(
					`#${upper}`,
					messageLink(modLogChannel.id, originalCaseUpper.contextMessageId!, interaction.guildId),
				)} (${upper - lower + 1} cases)?`,
				components: [createMessageActionRow([cancelButton, changeButton])],
			});

			const collectedInteraction = await reply
				.awaitMessageComponent({
					filter: (collected) => collected.user.id === interaction.user.id,
					componentType: ComponentType.Button,
					time: 15_000,
				})
				.catch(async () => {
					try {
						await interaction.editReply({
							content: "Action timer ran out.",
							components: [],
						});
					} catch (error_) {
						const error = error_ as Error;
						logger.error(error, error.message);
					}

					return undefined;
				});

			if (
				collectedInteraction &&
				(collectedInteraction.customId === cancelKey || collectedInteraction.customId !== changeKey)
			) {
				await collectedInteraction.update({
					content: "Canceled setting reason.",
					components: [],
				});
				return;
			} else if (!collectedInteraction) {
				return;
			}
		} else {
			originalCaseLower = await getCase(interaction.guildId, lower);

			if (!originalCaseLower) {
				await interaction.editReply({
					content: `Cannot find case \`#${lower}\``,
					components: [],
				});
				return;
			}
		}

		const success: number[] = [];

		for (let caseId = lower; caseId <= upper; caseId++) {
			const originalCase = await getCase(interaction.guildId, caseId);

			if (!originalCase) {
				continue;
			}

			const case_ = await updateCase({
				caseId: originalCase.caseId,
				guildId: interaction.guildId,
				contextMessageId: originalCase.contextMessageId,
				reason: args.reason,
			});

			await upsertCaseLog(interaction.guild, interaction.user, case_);
			success.push(caseId);
		}

		const message = args.last_case
			? `Successfully set reason for case range ${hyperlink(
					`#${lower}`,
					messageLink(modLogChannel.id, originalCaseLower.contextMessageId!, interaction.guildId),
			  )} to ${hyperlink(
					`#${upper}`,
					messageLink(modLogChannel.id, originalCaseUpper!.contextMessageId!, interaction.guildId),
			  )} (\`${success.length}/${upper - lower + 1}\` cases)`
			: `Successfully set reason for case ${hyperlink(`#${lower}`, originalCaseLower.contextMessageId!)}`;

		await interaction.editReply({
			content: truncate(message, 1_000, ""),
			components: [],
		});
	}
}
