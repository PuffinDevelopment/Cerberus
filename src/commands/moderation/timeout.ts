import { ms } from "@naval-base/ms";
import { getModelForClass } from "@typegoose/typegoose";
import { Command, logger, createButton, truncateEmbed, createMessageActionRow } from "@yuudachi/framework";
import type { ArgsParam, InteractionParam } from "@yuudachi/framework/types";
import { ButtonStyle, ComponentType, PermissionFlagsBits } from "discord.js";
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import type { Redis } from "ioredis";
import { nanoid } from "nanoid";
import { inject, injectable } from "tsyringe";
import { CASE_REASON_MAX_LENGTH } from "../../Constants.js";
import { CaseAction, createCase } from "../../functions/cases/createCase.js";
import { generateCasePayload } from "../../functions/logging/generateCasePayload.js";
import { upsertCaseLog } from "../../functions/logging/upsertCaseLog.js";
import { checkLogChannel } from "../../functions/settings/checkLogChannel.js";
import { getGuildSetting, SettingsKeys } from "../../functions/settings/getGuildSetting.js";
import type { TimeoutCommand } from "../../interactions/moderation/timeout.js";
import { cases } from "../../models/cases.js";
import { kRedis } from "../../tokens.js";
import { generateHistory } from "../../util/generateHistory.js";

@injectable()
export default class extends Command<typeof TimeoutCommand> {
	public constructor(@inject(kRedis) public readonly redis: Redis) {
		super();
	}

	public override async chatInput(
		interaction: InteractionParam,
		args: ArgsParam<typeof TimeoutCommand>,
	): Promise<void> {
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

		if (Date.now() < (args.user.member.communicationDisabledUntilTimestamp ?? 0)) {
			throw new Error(
				`${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id}) is already in timeout`,
			);
		}

		if (
			!args.user.member.moderatable ||
			!interaction.guild.members.me?.permissions.has(PermissionFlagsBits.ModerateMembers)
		) {
			throw new Error(
				`Missing permissions to time out ${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id})`,
			);
		}

		if (args.reason && args.reason.length >= CASE_REASON_MAX_LENGTH) {
			throw new Error(`Maximum length of \`${CASE_REASON_MAX_LENGTH}\` for reason exceeded.`);
		}

		const timeoutKey = nanoid();
		const cancelKey = nanoid();

		const timeoutButton = createButton({
			label: "Timeout",
			customId: timeoutKey,
			style: ButtonStyle.Danger,
		});
		const cancelButton = createButton({
			label: "Cancel",
			customId: cancelKey,
			style: ButtonStyle.Secondary,
		});

		const embed = truncateEmbed(await generateHistory(interaction, args.user));

		await interaction.editReply({
			content: `Do you really want to time out ${args.user.user.toString()} - ${args.user.user.tag} (${
				args.user.user.id
			})?`,
			embeds: [embed],
			components: [createMessageActionRow([cancelButton, timeoutButton])],
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
				content: `Canceled timeout for ${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id})`,
				components: [],
			});
		} else if (collectedInteraction?.customId === timeoutKey) {
			await collectedInteraction.deferUpdate();

			await this.redis.setex(`guild:${collectedInteraction.guildId}:user:${args.user.user.id}:timeout`, 15, "");
			const case_ = await createCase(
				collectedInteraction.guild,
				generateCasePayload({
					guildId: collectedInteraction.guildId,
					caseId: await mongo.nextCase(collectedInteraction.guildId),
					user: collectedInteraction.user,
					args,
					duration: ms(args.duration),
					action: CaseAction.Timeout,
				}),
			);
			await upsertCaseLog(collectedInteraction.guild, collectedInteraction.user, case_);

			await collectedInteraction.editReply({
				content: `Successfully timed out ${args.user.user.toString()} - ${args.user.user.tag} (${args.user.user.id})`,
				components: [],
			});
		}
	}
}
