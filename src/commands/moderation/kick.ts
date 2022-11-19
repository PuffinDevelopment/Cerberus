import { getModelForClass } from "@typegoose/typegoose";
import { Command, logger, createButton, truncateEmbed, createMessageActionRow } from "@yuudachi/framework";
import type { ArgsParam, InteractionParam } from "@yuudachi/framework/types";
import { ComponentType, ButtonStyle } from "discord.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { Redis } from "ioredis";
import { nanoid } from "nanoid";
import { inject, injectable } from "tsyringe";
import { CASE_REASON_MAX_LENGTH } from "../../Constants.js";
import { createCase, CaseAction } from "../../functions/cases/createCase.js";
import { generateCasePayload } from "../../functions/logging/generateCasePayload.js";
import { upsertCaseLog } from "../../functions/logging/upsertCaseLog.js";
import { checkLogChannel } from "../../functions/settings/checkLogChannel.js";
import { getGuildSetting, SettingsKeys } from "../../functions/settings/getGuildSetting.js";
import type { KickCommand } from "../../interactions/index.js";
import { cases } from "../../models/cases.js";
import { kRedis } from "../../tokens.js";
import { generateHistory } from "../../util/generateHistory.js";

@injectable()
export default class extends Command<typeof KickCommand> {
	public constructor(@inject(kRedis) public readonly redis: Redis) {
		super();
	}

	public override async chatInput(interaction: InteractionParam, args: ArgsParam<typeof KickCommand>): Promise<void> {
		const mongo = getModelForClass(cases);
		const reply = await interaction.deferReply({ ephemeral: true });

		const modLogChannel = checkLogChannel(
			interaction.guild,
			await getGuildSetting(interaction.guildId, SettingsKeys.ModLogChannelId),
		);

		if (!modLogChannel) {
			throw new Error("No mod log channel has been initialized yet.");
		}

		if (!args.user.member) {
			throw new Error("The given member is not in this guild.");
		}

		if (!args.user.member.kickable) {
			throw new Error(
				`Missing permissions to kick ${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id})`,
			);
		}

		if (args.reason && args.reason.length >= CASE_REASON_MAX_LENGTH) {
			throw new Error(`Maximum length of \`${CASE_REASON_MAX_LENGTH}\` for reason exceeded.`);
		}

		const kickKey = nanoid();
		const cancelKey = nanoid();

		const kickButton = createButton({
			label: "Kick",
			customId: kickKey,
			style: ButtonStyle.Danger,
		});
		const cancelButton = createButton({
			label: "Cancel",
			customId: cancelKey,
			style: ButtonStyle.Secondary,
		});

		const embed = truncateEmbed(await generateHistory(interaction, args.user));

		await interaction.editReply({
			content: `Do you really want to kick ${args.user.user.toString()} - ${args.user.user.tag} (${
				args.user.user.id
			})?`,
			embeds: [embed],
			components: [createMessageActionRow([cancelButton, kickButton])],
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

		if (collectedInteraction?.customId === cancelKey) {
			await collectedInteraction.update({
				content: `Canceled kick on ${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id})`,
				components: [],
			});
		} else if (collectedInteraction?.customId === kickKey) {
			await collectedInteraction.deferUpdate();

			await this.redis.setex(`guild:${collectedInteraction.guildId}:user:${args.user.user.id}:kick`, 15, "");
			const case_ = await createCase(
				collectedInteraction.guild,
				generateCasePayload({
					guildId: collectedInteraction.guildId,
					caseId: await mongo.nextCase(collectedInteraction.guildId),
					user: collectedInteraction.user,
					args,
					action: CaseAction.Kick,
				}),
			);
			await upsertCaseLog(collectedInteraction.guild, collectedInteraction.user, case_);

			await collectedInteraction.editReply({
				content: `Successfully kicked ${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id})`,
				components: [],
			});
		}
	}
}
